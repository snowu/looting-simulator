/**
 * Traps: spotting them as you walk (Lantern Wick and trap sense reach
 * further), springing them, revealing a floor's worth, and disarming one
 * for salvage.
 */
import { DIRS, DX, DY, turnLeft, turnRight } from '../core/dir';
import { manhattan } from '../core/math';
import { enemyDef } from '../data/enemies';
import { blocksSight, EnemyState, lurkerAt, Trap, trapAt } from '../systems/dungeon';
import { makeMaterial } from '../systems/items';
import * as Combat from './combat';
import * as EnemyAi from './enemy-ai';
import * as Loot from './loot';
import type { World } from './world';
import { TRAPS } from './world';

/**
 * Notice the seam in the flagstones on the tile in front of you. Only the
 * tile you are about to step onto and the ones beside you, so a corridor
 * taken at a run is a corridor taken blind.
 */
export function spotTraps(w: World): void {
  const f = w.floor;
  const p = w.player;
  const look: { x: number; y: number }[] = [];
  for (let d = 1; d <= w.lookAhead; d++) look.push(w.frontTile(d));
  for (const d of DIRS) look.push({ x: p.x + DX[d], y: p.y + DY[d] });
  // The same look reads the ceiling: whatever clings up there is found by
  // the same glance that finds a seam in the flagstones.
  for (const t of look) {
    const up = lurkerAt(f, t.x, t.y);
    if (!up || up.lurk !== 'ceiling' || up.spotted) continue;
    if (!w.los(p.x, p.y, t.x, t.y)) continue;
    up.spotted = true;
    w.msg('Something clings to the ceiling ahead.', '#d0b080');
    w.sfx('ui');
  }
  if (!f.traps?.length) return;
  for (const t of look) {
    const trap = trapAt(f, t.x, t.y);
    if (!trap || trap.found || !trap.armed) continue;
    if (!w.los(p.x, p.y, t.x, t.y)) continue;
    // The far tile is only readable if you are facing straight down it.
    if (manhattan(t.x, t.y, p.x, p.y) > 1 && blocksSight(f, t.x, t.y)) continue;
    trap.found = true;
    w.msg(TRAPS[trap.kind].spotted, '#e0c060');
    w.sfx('ui');
  }
}

/**
 * Set a trap off. `victim` is the monster that stood on it, or null for you —
 * monsters blunder into them too, which is the whole reason to back through
 * one you have already found.
 */
export function springTrap(w: World, trap: Trap, victim: EnemyState | null): void {
  const def = TRAPS[trap.kind];
  trap.armed = false;
  trap.found = true;
  const depth = w.run.depth;
  w.emit({ type: 'trap', id: trap.id, x: trap.x, y: trap.y, kind: trap.kind });
  w.sfx(def.sfx, trap.x, trap.y);

  if (trap.kind === 'alarm') {
    // No damage — it just tells the floor exactly where you are.
    let woken = 0;
    for (const e of w.floor.enemies) {
      if (e.ai === 'dead') continue;
      if (manhattan(e.x, e.y, trap.x, trap.y) > EnemyAi.noise(w, 12)) continue;
      e.alert = Math.max(e.alert, 10);
      e.lastSeenX = trap.x;
      e.lastSeenY = trap.y;
      woken++;
    }
    if (!victim) {
      EnemyAi.breakSilence(w, 'The ward shrieks');
      w.msg(woken ? 'A ward shrieks. Something heard that.' : 'A ward shrieks into an empty floor.', '#ff9070');
      w.emit({ type: 'shake', amount: 0.2 });
    }
    return;
  }

  const damage = Math.round(def.base + def.perDepth * depth);
  if (victim) {
    // Monsters take the hit raw; they have no armour model for hazards.
    // Deliberately unscaled by difficulty: a softer trap that still thins
    // the pack for you is help enough on Normal.
    const dealt = Math.max(1, Math.round(damage * 0.8));
    w.hurt(victim, dealt, `${dealt}`, '#ffb060');
    const vdef = enemyDef(victim.def);
    if (victim.hp <= 0) {
      w.msg(`The ${vdef.name} blunders into ${def.source}.`, '#e0c060');
      Combat.killEnemy(w, victim);
    }
    return;
  }
  w.msg(def.hit, '#ff7070');
  Combat.damagePlayer(w, Math.max(1, Math.round(damage * w.diff.trapDamage)), def.damageType, trap.x, trap.y, def.source);
}

/** Mark tiles near and in view as explored (automap fog). */
export function reveal(w: World): void {
  const f = w.floor;
  const { x, y } = w.player;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const tx = x + dx, ty = y + dy;
    if (tx < 0 || ty < 0 || tx >= f.width || ty >= f.height) continue;
    if (Math.abs(dx) + Math.abs(dy) <= 3 && w.los(x, y, tx, ty, true)) f.explored[ty * f.width + tx] = 1;
  }
  // Straight ahead down the corridor.
  for (let d = 1; d <= 8; d++) {
    const t = w.frontTile(d);
    if (t.x < 0 || t.y < 0 || t.x >= f.width || t.y >= f.height) break;
    f.explored[t.y * f.width + t.x] = 1;
    for (const side of [turnLeft(w.player.facing), turnRight(w.player.facing)]) {
      const sx = t.x + DX[side], sy = t.y + DY[side];
      if (sx >= 0 && sy >= 0 && sx < f.width && sy < f.height) f.explored[sy * f.width + sx] = 1;
    }
    if (blocksSight(f, t.x, t.y)) break;
  }
  spotTraps(w);
}

/**
 * Disarming always works — the skill was noticing it, not fiddling with it.
 * The salvage is what makes clearing one worth the detour instead of just
 * stepping around it.
 */
export function disarm(w: World, trap: Trap): void {
  trap.armed = false;
  const def = TRAPS[trap.kind];
  w.sfx('craft', trap.x, trap.y);
  w.msg(def.disarmed, '#a8d8a0');
  const salvage = trap.kind === 'alarm' ? 0.25 : 0.6;
  if (w.rng.chance(salvage)) {
    const pool = trap.kind === 'dart' ? ['iron', 'timber'] : trap.kind === 'spikes' ? ['iron', 'copper'] : ['bone', 'linen'];
    const id = w.rng.pick(pool);
    Loot.dropLoot(w, trap.x, trap.y, [makeMaterial(id, 1)], 0);
  }
}
