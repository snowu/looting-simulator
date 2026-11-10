/**
 * Things that must hold in a live world after every tick, whatever was
 * pressed. The fuzzer (fuzz.bench.ts, and a short version in npm test) runs
 * the playtest bot with random inputs mixed in and checks these each tick.
 *
 * Each check returns a short key plus detail, so a report can group a
 * thousand ticks of the same fault into one line.
 */
import { blocksMove } from '../src/systems/dungeon';
import { flaskMax } from '../src/systems/healing';
import { Item } from '../src/types';
import type { World } from '../src/world/world';

export interface Violation {
  key: string;
  detail: string;
}

const finite = (n: number) => Number.isFinite(n);

/** Every item the save can reach right now, with where it is. */
function everyItem(w: World): [Item, string][] {
  const s = w.state;
  const out: [Item, string][] = [];
  for (const it of s.stash.items) out.push([it, 'stash']);
  for (const it of s.loadout.items) out.push([it, 'loadout']);
  for (const [slot, it] of Object.entries(s.equipment)) if (it) out.push([it, `equipped ${slot}`]);
  for (const it of w.run.backpack.items) out.push([it, 'backpack']);
  for (const it of s.grave?.items ?? []) out.push([it, 'grave']);
  w.run.floors.forEach((f, i) => {
    if (!f) return;
    for (const pk of f.pickups) for (const it of pk.items) out.push([it, `floor ${i + 1} pickup`]);
    for (const e of f.enemies) {
      for (const it of e.stolen ?? []) out.push([it, `floor ${i + 1} ${e.def} stolen`]);
      for (const it of e.hoard ?? []) out.push([it, `floor ${i + 1} ${e.def} hoard`]);
    }
  });
  return out;
}

export function invariants(w: World, opts: { items?: boolean } = {}): Violation[] {
  const out: Violation[] = [];
  const bad = (key: string, detail: string) => out.push({ key, detail });
  const p = w.player;
  const d = w.derived;
  const f = w.floor;
  const alive = w.run.outcome === 'active';

  if (!finite(p.hp)) bad('player hp not finite', `${p.hp}`);
  else {
    if (!Number.isInteger(p.hp)) bad('player hp not whole', `${p.hp}`);
    if (p.hp > d.maxHp) bad('player hp above max', `${p.hp}/${d.maxHp}`);
    if (alive && p.hp <= 0) bad('player alive at 0 hp', `${p.hp}`);
  }
  if (!finite(p.stamina) || p.stamina < -1e-6 || p.stamina > d.maxStamina + 1e-6) bad('stamina out of range', `${p.stamina}/${d.maxStamina}`);
  if (alive && !w.moving && blocksMove(f, p.x, p.y)) bad('player inside something solid', `${p.x},${p.y}`);

  const flask = w.run.flask;
  if (flask) {
    const max = flaskMax(w.state.flask?.shards ?? 0, w.diff.flaskBonus);
    if (!Number.isInteger(flask.charges) || flask.charges < 0 || flask.charges > max) bad('flask charges out of range', `${flask.charges}/${max}`);
  }
  const pool = w.run.conduit;
  if (pool && (!finite(pool.charges) || pool.charges < 0 || (d.conduit && pool.charges > d.conduit.charges))) {
    bad('conduit charges out of range', `${pool.charges}/${d.conduit?.charges ?? '-'}`);
  }
  if (w.run.sigil && (!finite(w.run.sigil.cd) || w.run.sigil.cd < 0)) bad('sigil cooldown negative', `${w.run.sigil.cd}`);
  if (!finite(w.run.gold) || w.run.gold < 0) bad('run gold negative', `${w.run.gold}`);
  if (!finite(w.state.gold) || w.state.gold < 0) bad('gold negative', `${w.state.gold}`);

  const standing = new Map<string, string>();
  for (const e of f.enemies) {
    if (e.ai === 'dead') continue;
    if (!finite(e.hp) || !finite(e.maxHp) || e.maxHp <= 0) bad('monster hp not finite', `${e.def} ${e.hp}/${e.maxHp}`);
    else if (e.hp > e.maxHp) bad('monster hp above max', `${e.def} ${e.hp}/${e.maxHp}`);
    if (e.lurk) continue;
    const at = `${e.x},${e.y}`;
    const other = standing.get(at);
    if (other) bad('two monsters on one tile', `${other} and ${e.def} at ${at}`);
    standing.set(at, e.def);
    if (e.moveT >= 1 && blocksMove(f, e.x, e.y) && f.tiles[e.y * f.width + e.x] !== 1) bad('monster inside a wall', `${e.def} at ${at}`);
  }
  for (const pr of w.projectiles) {
    if (!finite(pr.x) || !finite(pr.y) || !finite(pr.dx) || !finite(pr.dy)) bad('projectile position not finite', `${pr.sprite}`);
  }

  // The item walk is the expensive one; callers sample it.
  if (opts.items) {
    const seen = new Map<string, string>();
    for (const [it, where] of everyItem(w)) {
      if (!it.uid) continue;
      const was = seen.get(it.uid);
      if (was) bad('one item in two places', `${it.ref} in ${was} and ${where}`);
      seen.set(it.uid, where);
      if (!Number.isInteger(it.qty) || it.qty <= 0) bad('item quantity not a positive whole number', `${it.ref} x${it.qty} in ${where}`);
    }
  }
  return out;
}
