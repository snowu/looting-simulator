/**
 * Sigils: the run's one carried sign (Wardcry, Snuff, Sounding, Temper)
 * and what each does when its cast resolves. castSigil on World starts the
 * cast; resolveSigil lands it.
 */
import { manhattan } from '../core/math';
import { itemBase } from '../data/items';
import { sigil, SigilId } from '../data/spells';
import { enemyAt, inBounds, portalAt, trapAt } from '../systems/dungeon';
import { durability } from '../systems/items';
import { metaLevel } from '../systems/meta';
import { EnemyDef, EQUIP_SLOTS, EquipSlot, Item } from '../types';
import type { World } from './world';
import { GUARD_DOWN, TRAPS } from './world';
import * as Combat from './combat';
import * as EnemyAi from './enemy-ai';

/**
 * Each sigil's own colour for the wash that plays when it lands.
 *
 * Casting had no moment: the stamina went, the cooldown started, and unless
 * you happened to be looking at the one thing that got pushed there was
 * nothing to tell you it had worked. Four of the five do something you cannot
 * see from where you stand.
 */
const SIGIL_FLASH: Record<SigilId, [number, number, number, number]> = {
  wardcry: [0.95, 0.85, 0.55, 0.5],
  snuff: [0.05, 0.04, 0.10, 0.6],
  sounding: [0.55, 0.75, 1.0, 0.38],
  threshold: [1.0, 0.82, 0.45, 0.42],
  temper: [0.75, 0.95, 0.7, 0.36],
};

export function resolveSigil(w: World, id: SigilId): void {
  const def = sigil(id);
  switch (id) {
    case 'wardcry': castWardcry(w); break;
    case 'snuff': castSnuff(w); break;
    case 'sounding': castSounding(w); break;
    case 'threshold': w.anim.ward = { x: w.player.x, y: w.player.y, t: 8 }; break;
    case 'temper': castTemper(w); break;
  }
  if (w.run.sigil) w.run.sigil.cd = def.cooldown;
  const [r, g, b, strength] = SIGIL_FLASH[id];
  w.emit({ type: 'sigil', r, g, b, strength });
  w.emit({ type: 'shake', amount: id === 'wardcry' ? 0.5 : 0.2 });
  w.emit({ type: 'float', x: w.player.x, y: w.player.y, text: def.name.replace('Sigil of ', ''), color: '#c8b8ff' });
  w.sfx('sigil_land');
  w.msg(`${def.name} answers.`, '#c8b8ff');
}

export function castWardcry(w: World): void {
  EnemyAi.breakSilence(w, 'Your shout rings down the halls');
  for (const e of w.floor.enemies) {
    if (e.ai === 'dead' || manhattan(e.x, e.y, w.player.x, w.player.y) > EnemyAi.noise(w, 8)) continue;
    e.alert = Math.max(e.alert, 8);
    e.lastSeenX = w.player.x;
    e.lastSeenY = w.player.y;
  }
  const front = w.frontTile();
  const e = enemyAt(w.floor, front.x, front.y);
  if (!e) return;
  const enemy = Combat.view(w, e);
  if (enemy.behavior === 'boss') {
    e.attackCd = Math.max(e.attackCd, 0.5);
    return;
  }
  e.ai = 'recover';
  e.timer = Math.max(e.timer, 1.2);
  e.attackCd = Math.max(e.attackCd, 1.4);
  if (enemy.shield) { e.guard = 'down'; e.guardT = GUARD_DOWN; e.blocks = 0; }
  const destination = w.frontTile(2);
  const portal = portalAt(w.floor, destination.x, destination.y);
  if (EnemyAi.canStep(w, e, destination.x, destination.y) && !portal) {
    EnemyAi.stepEnemy(w, e, destination.x, destination.y);
    return;
  }
  const other = enemyAt(w.floor, destination.x, destination.y);
  if (other) {
    other.ai = 'recover';
    other.timer = Math.max(other.timer, 0.6);
    other.attackCd = Math.max(other.attackCd, 0.6);
    return;
  }
  e.timer = Math.max(e.timer, 1.8);
  const damage = Math.min(25, Math.round(e.maxHp * 0.1));
  e.hp -= Math.round(damage * (enemy.resist.blunt ?? 1));
  e.hurtT = 0.3;
  if (e.hp <= 0) Combat.killEnemy(w, e);
}

export function castSnuff(w: World): void {
  for (const e of w.floor.enemies) {
    if (e.ai === 'dead' || e.ai === 'windup' || manhattan(e.x, e.y, w.player.x, w.player.y) > 12) continue;
    e.alert = 0;
    if (e.ai === 'chase') e.ai = 'idle';
  }
  w.anim.snuffT = 8;
  w.anim.unseenT = 3;
  w.sfx('snuff');
}

export function castSounding(w: World): void {
  const f = w.floor;
  for (let y = w.player.y - 6; y <= w.player.y + 6; y++) for (let x = w.player.x - 6; x <= w.player.x + 6; x++) {
    if (!inBounds(f, x, y) || manhattan(x, y, w.player.x, w.player.y) > 6) continue;
    f.explored[y * f.width + x] = 1;
    const trap = trapAt(f, x, y);
    if (trap && !trap.found) {
      trap.found = true;
      w.msg(TRAPS[trap.kind].spotted, '#e0c060');
    }
  }
  for (const e of f.enemies) {
    if (e.lurk !== 'ceiling' || e.spotted || e.ai === 'dead') continue;
    if (manhattan(e.x, e.y, w.player.x, w.player.y) > 6) continue;
    e.spotted = true;
    w.msg('Something clings to the ceiling nearby.', '#d0b080');
  }
  for (const secret of f.secrets) {
    const dx = secret.x - w.player.x, dy = secret.y - w.player.y;
    if (secret.found || Math.abs(dx) + Math.abs(dy) > 6) continue;
    const bearing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north');
    w.msg(`Stone rings hollow to the ${bearing}.`, '#e8d8a0');
  }
}

export function castTemper(w: World): void {
  const slots = w.derived.twoHanded ? EQUIP_SLOTS.filter((s) => s !== 'offhand') : EQUIP_SLOTS;
  const worst = slots.map((slot) => ({ slot, item: w.state.equipment[slot] }))
    .filter((v): v is { slot: EquipSlot; item: Item } => !!v.item && durability(v.item).max > 0)
    .sort((a, b) => durability(a.item).frac - durability(b.item).frac)[0];
  if (!worst) return;
  const d = durability(worst.item);
  worst.item.dur = Math.min(d.max, (worst.item.dur ?? d.max) + Math.round(d.max * 0.25));
  w.refreshDerived();
}

/** A separate flavor stream must never move combat, loot or dungeon RNG. */
export function rockAndStone(w: World): void {
  const weapon = w.state.equipment.weapon;
  if (weapon && itemBase(weapon.ref).weaponClass === 'pick' && w.flavorRng.chance(0.01)) {
    w.msg('Rock and Stone!', '#d8b878');
  }
}

export function refundSigil(w: World, def: EnemyDef, mult = 1): void {
  const active = w.run.sigil;
  if (!active || active.cd <= 0) return;
  const spell = sigil(active.id);
  const base = (2 + 8 * Math.min(1, def.hp / 140)) * mult;
  const multiplier = 1 + 0.25 * metaLevel(w.state.meta, 'attunement') + w.derived.stats.focus / 100;
  active.cd = Math.max(0, active.cd - Math.min(base * multiplier, spell.cooldown * 0.2));
}
