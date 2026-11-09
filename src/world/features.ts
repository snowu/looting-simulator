/**
 * What a floor is given when you first arrive: its lieutenant, a rite
 * carving to study (and the King's own), and an Oath's hunter mark. Placed
 * from World.changeFloor; studied and settled from interact and killEnemy.
 */
import { Dir, DIRS, DX, DY } from '../core/dir';
import { manhattan } from '../core/math';
import { createRng, hashString, Rng } from '../core/rng';
import { eligibleTraits } from '../data/elites';
import { enemyDef } from '../data/enemies';
import { isGoblin, LIEUTENANT_MIN_DISTANCE, lieutenantChance, LieutenantId, LIEUTENANTS, QUARTERMASTER_MIN_GOBLINS, ROUT_SECONDS } from '../data/lieutenants';
import { HUNTER_DEPTHS } from '../data/oaths';
import { findRite, rite, RITE_CARVING_DEPTH, RITE_KING_KNOWN, RITE_MILESTONES, riteFloorChance, RiteId, RITES, ROAD_RITES } from '../data/rites';
import { ROAD_DEPTHS } from '../data/routes';
import { blocksMove, createEnemy, doorAt, enemyAt, EnemyState, Floor, FLOOR, inRoom, promoteElite, Prop, propAt, stairsAt, stairsFront, tileAt, trapAt } from '../systems/dungeon';
import { runOath } from '../systems/oaths';
import { reachable, splitsNothing, surfaceAt } from '../systems/surfaces';
import type { World } from './world';
import * as Loot from './loot';

/**
 * A freshly generated floor from depth 2 may get a lieutenant, on its own
 * stream: a Goblin Quartermaster where there are goblins to command, or the
 * Hoarder anywhere. Placed far from the arrival stair, and announced by a
 * clue rather than by name.
 */
export function placeLieutenant(w: World, f: Floor): void {
  if (f.rooms.some((r) => r.role === 'throne')) return;
  const rng = createRng(hashString(`lt:${w.run.seed}:${f.depth}`));
  if (!rng.chance(lieutenantChance(f.depth) * w.diff.lieutenantChance)) return;
  const goblins = f.enemies.filter((e) => e.ai !== 'dead' && isGoblin(e.def));
  const options: LieutenantId[] = goblins.length >= QUARTERMASTER_MIN_GOBLINS ? ['quartermaster', 'hoarder'] : ['hoarder'];
  const id = rng.pick(options);
  const up = f.stairs.find((st) => !st.down);
  const busy = new Set(f.enemies.filter((e) => e.ai !== 'dead').map((e) => `${e.x},${e.y}`));
  const roomOf = (x: number, y: number) => f.rooms.find((r) => inRoom(r, x, y));
  const tiles = (r: (typeof f.rooms)[number]) => {
    const out: [number, number][] = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (blocksMove(f, x, y) || busy.has(`${x},${y}`) || stairsAt(f, x, y)) continue;
      if (up && manhattan(x, y, up.x, up.y) < LIEUTENANT_MIN_DISTANCE) continue;
      out.push([x, y]);
    }
    return out;
  };
  const rooms = f.rooms.filter((r) => r.role !== 'start' && r.role !== 'secret' && tiles(r).length);
  if (!rooms.length) return;
  // A Quartermaster stands with the most goblins; the Hoarder anywhere.
  const room = id === 'quartermaster'
    ? [...rooms].sort((a, b) => goblins.filter((g) => roomOf(g.x, g.y) === b).length - goblins.filter((g) => roomOf(g.x, g.y) === a).length)[0]
    : rng.pick(rooms);
  const [x, y] = rng.pick(tiles(room));
  const def = LIEUTENANTS[id];
  const e = createEnemy(enemyDef(def.enemy), x, y, rng.int(0, 3) as Dir, `lt${f.depth}`, f.depth, w.difficultyId);
  e.lieutenant = id;
  f.enemies.push(e);
  w.msg(def.clue, def.color);
}

/** A lieutenant dies: its floor changes, and it pays in kind. */
export function lieutenantFalls(w: World, e: EnemyState): void {
  if (e.lieutenant === 'quartermaster') {
    let routed = 0;
    for (const g of w.floor.enemies) {
      if (g.ai === 'dead' || !isGoblin(g.def)) continue;
      g.ai = 'flee';
      g.alert = Math.max(g.alert, ROUT_SECONDS);
      routed++;
    }
    const rng = createRng(hashString(`strongbox:${w.floor.seed}:${e.id}`));
    const box = Loot.containerLoot(w, rng, 'vault');
    Loot.dropLoot(w, e.x, e.y, box.items, box.gold);
    w.msg(routed ? 'The banner falls. The goblins break and run! The strongbox key is yours.' : 'The banner falls. The strongbox key is yours.', LIEUTENANTS.quartermaster.color);
  } else if (e.lieutenant === 'hoarder') {
    const n = e.hoard?.length ?? 0;
    Loot.dropLoot(w, e.x, e.y, e.hoard ?? [], e.hoardGold ?? 0);
    delete e.hoard;
    delete e.hoardGold;
    w.msg(n ? 'The sack splits. Everything the Hoarder gathered spills across the floor.' : 'The sack splits, heavy with coin.', LIEUTENANTS.hoarder.color);
  }
}

/**
 * The rite this delve's next carving would teach, or none: one carving per
 * delve, never a rite you know. Your first is always Meteor, the one the
 * tablet was built around; after that the Frozen Road teaches Glacial Tomb
 * when it is still to come, and otherwise it is drawn from those left.
 */
export function nextRite(w: World, rng: Rng): RiteId | null {
  if (w.run.riteCarved) return null;
  const known = w.state.ritesKnown ?? [];
  const left = RITES.filter((r) => !known.includes(r.id));
  if (!left.length) return null;
  if (!known.length && left.some((r) => r.id === 'meteor')) return 'meteor';
  const road = w.run.road && ROAD_RITES[w.run.road];
  if (road && ROAD_DEPTHS.includes(w.run.depth) && left.some((r) => r.id === road)) return road;
  return rng.pick(left).id;
}

/**
 * A rite carving, laid after generation like surfaces and quirks, so the
 * generated floor underneath never moves: no golden hash changes, and the
 * roll has its own stream. Guaranteed on the first floor that reaches a
 * milestone you have not yet studied a rite for (depth 3, then depth 5),
 * else a small chance on every floor from depth 3. It waits in the vault,
 * else the secret room, else any normal room, so it is still found.
 */
export function placeRiteCarving(w: World, f: Floor): void {
  if (f.depth < RITE_CARVING_DEPTH) return;
  if (f.props.some((p) => p.kind === 'carving')) return;
  const rng = createRng(hashString(`rite:${w.run.seed}:${f.depth}`));
  const known = (w.state.ritesKnown ?? []).length;
  const owed = RITE_MILESTONES.some((m) => f.depth >= m.depth && known < m.known);
  // Roll even when owed, so the draw below never depends on the milestone.
  const lucky = rng.chance(riteFloorChance(f.depth));
  if (!owed && !lucky) return;
  const id = nextRite(w, rng);
  if (!id) return;
  const vault = f.rooms.find((r) => r.role === 'vault');
  const secret = f.rooms.find((r) => r.role === 'secret');
  const normals = f.rooms.filter((r) => r.role === 'normal');
  for (const room of [...(vault ? [vault] : []), ...(secret ? [secret] : []), ...normals]) {
    if (layCarving(w, f, id, rng.shuffle(carvingTiles(w, f, room)))) return;
  }
}

/**
 * Your first King kill promises a rite, as it promises a flask shard: a
 * carving rises beside the portal, unless this delve already laid one.
 */
export function placeKingCarving(w: World, x: number, y: number): void {
  const f = w.floor;
  if ((w.state.ritesKnown ?? []).length >= RITE_KING_KNOWN) return;
  if (f.props.some((p) => p.kind === 'carving' && !p.used)) return;
  const rng = createRng(hashString(`rite:king:${w.run.seed}`));
  const id = nextRite(w, rng);
  if (!id) return;
  const near: { x: number; y: number }[] = [];
  for (let r = 2; r <= 5 && near.length < 12; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const t = { x: x + dx, y: y + dy };
      if (carvingFits(w, f, t.x, t.y, carvingLandings(w, f)) && !(t.x === w.player.x && t.y === w.player.y)) near.push(t);
    }
  }
  if (layCarving(w, f, id, near)) w.msg('Where the King fell, the stone remembers a mark.', rite(id).color);
}

export function carvingLandings(w: World, f: Floor): Set<number> {
  return new Set(f.stairs.map((s) => { const p = stairsFront(s); return p.y * f.width + p.x; }));
}

/**
 * The slab blocks its tile, so it follows the barrel rules: never in or
 * beside a doorway, on a stair's landing, a trap or a pool, and never
 * where it would cut anything off.
 */
export function carvingFits(w: World, f: Floor, x: number, y: number, landings: Set<number>): boolean {
  if (tileAt(f, x, y) !== FLOOR || propAt(f, x, y) || stairsAt(f, x, y) || enemyAt(f, x, y)) return false;
  if (doorAt(f, x, y) || DIRS.some((d) => doorAt(f, x + DX[d], y + DY[d])) || landings.has(y * f.width + x)) return false;
  if (f.pickups.some((p) => p.x === x && p.y === y)) return false;
  return !trapAt(f, x, y) && !surfaceAt(f, x, y) && splitsNothing(f, x, y);
}

export function carvingTiles(w: World, f: Floor, room: { x: number; y: number; w: number; h: number }): { x: number; y: number }[] {
  const landings = carvingLandings(w, f);
  const free: { x: number; y: number }[] = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) if (carvingFits(w, f, x, y, landings)) free.push({ x, y });
  }
  return free;
}

/** Stand the slab on the first tile that leaves everything reachable. */
export function layCarving(w: World, f: Floor, id: RiteId, tiles: readonly { x: number; y: number }[]): boolean {
  const before = reachable(f);
  for (const t of tiles) {
    const slab: Prop = {
      id: `carving_${f.depth}_${id}`, kind: 'carving', x: t.x, y: t.y,
      used: false, tier: 'none', blocking: true, mimic: false, rite: id,
    };
    f.props.push(slab);
    if (reachable(f) >= before - 1) {
      w.run.riteCarved = id;
      return true;
    }
    f.props.pop();
  }
  return false;
}

/** Read where it stands: a studied carving teaches its rite for good. */
export function studyCarving(w: World, p: Prop): void {
  const def = findRite(p.rite);
  if (!def) return;
  w.state.ritesKnown ??= [];
  if (w.state.ritesKnown.includes(def.id)) {
    w.msg('The mark is familiar: you already know this rite.', '#888');
    return;
  }
  w.state.ritesKnown.push(def.id);
  p.used = true;
  w.sfx('secret', p.x, p.y);
  w.emit({ type: 'float', x: p.x, y: p.y, text: def.name, color: '#c8a0ff' });
  const many = w.state.ritesKnown.length > 1;
  w.msg(many
    ? `You study the carving: ${def.name}. Hold X and draw its mark — the tablet knows which rite you mean by what you draw.`
    : `You study the carving: ${def.name}. Hold X and trace its mark to cast it — two charges each time, with no floor limit.`, def.color);
}

/**
 * Hunter: a freshly generated floor on one of the hunt's depths gets its
 * mark. One of the three toughest monsters far from the stairs is chosen on
 * the run's own stream, promoted to an elite if it is not one, and marked. Placed when the
 * floor is first generated, so a floor is only ever marked once.
 */
export function placeHunterMark(w: World, f: Floor): void {
  const oath = runOath(w.run, 'hunter');
  if (!oath || !HUNTER_DEPTHS.includes(f.depth) || (oath.placed ?? []).includes(f.depth)) return;
  const up = f.stairs.find((st) => !st.down);
  const far = (e: EnemyState) => up ? manhattan(e.x, e.y, up.x, up.y) : 0;
  const pool = f.enemies.filter((e) => e.ai !== 'dead' && !e.lurk && enemyDef(e.def).behavior !== 'boss' && far(e) >= 8);
  const quarry = pool.length ? pool : f.enemies.filter((e) => e.ai !== 'dead' && !e.lurk && enemyDef(e.def).behavior !== 'boss');
  if (!quarry.length) return;
  // Quarry worth the name: one of the three toughest on the floor, never
  // whatever rat happened to be furthest from the stairs.
  const rng = createRng(hashString(`hunt:${w.run.seed}:${f.depth}`));
  const toughest = [...quarry].sort((a, b) => enemyDef(b.def).hp - enemyDef(a.def).hp || a.id.localeCompare(b.id)).slice(0, 3);
  const e = rng.pick(toughest);
  if (!e.elite) {
    const traits = eligibleTraits(enemyDef(e.def));
    if (traits.length) promoteElite(e, rng.pick(traits));
  }
  e.marked = true;
  (oath.placed ??= []).push(f.depth);
}
