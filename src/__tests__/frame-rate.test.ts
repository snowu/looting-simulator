import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { FLOOR, createEnemy } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';

/**
 * The world runs on whatever dt the display gives it. A rule that rolls once
 * per tick instead of once per second plays differently on a 144 Hz monitor
 * than on a phone at 30 fps. These pin rules that must not.
 */

/** A cleared floor with the player facing five open tiles. */
function arena(seed: number): World {
  const state = newGame(createRng(seed));
  state.difficulty = 'hard';
  startRun(state, seed);
  const w = new World(state);
  const f = w.floor;
  f.enemies = [];
  f.traps = [];
  f.props = f.props.filter((p) => !p.blocking);
  const free = (x: number, y: number) =>
    f.tiles[y * f.width + x] === FLOOR && !f.doors.some((d) => d.x === x && d.y === y) && !f.stairs.some((s) => s.x === x && s.y === y);
  for (let y = 2; y < f.height - 6; y++) for (let x = 2; x < f.width - 6; x++) {
    for (const d of DIRS) {
      let ok = free(x, y);
      for (let k = 1; k <= 5 && ok; k++) ok = free(x + DX[d] * k, y + DY[d] * k);
      if (ok) {
        Object.assign(w.player, { x, y, facing: d });
        Object.assign(w.anim, { fromX: x, fromY: y, yaw: (d * Math.PI) / 2, yawTo: (d * Math.PI) / 2 });
        return w;
      }
    }
  }
  throw new Error('no arena');
}

/**
 * Share of trials in which a badly hurt skittish monster, standing beside you
 * between swings, turns to flee within `window` seconds. Standing still is
 * where it decides every tick; mid-step it decides once per step.
 */
function fleeRate(dt: number, trials: number, window = 0.5): number {
  let fled = 0;
  for (let i = 0; i < trials; i++) {
    const w = arena(1);
    w.rng = createRng(9000 + i);
    const t = w.frontTile(1);
    const e = createEnemy(enemyDef('spore_hunter'), t.x, t.y, turnAround(w.player.facing), `fr${i}`, 3);
    e.hp = Math.floor(e.maxHp * 0.2);
    e.alert = 8;
    e.attackCd = 5;
    w.floor.enemies.push(e);
    for (let s = 0; s < window && e.ai !== 'flee'; s += dt) w.update(dt);
    if (e.ai === 'flee') fled++;
  }
  return fled / trials;
}

describe('frame-rate independence', () => {
  it('a wounded skittish monster beside you flees at the same rate at 30 and 144 fps', () => {
    // Tuned at 60 fps: 2% a tick there is 1 - 0.98^30, about 45%, over half a second.
    const slow = fleeRate(1 / 30, 300);
    const fast = fleeRate(1 / 144, 300);
    expect(slow).toBeGreaterThan(0.33);
    expect(slow).toBeLessThan(0.58);
    expect(fast).toBeGreaterThan(0.33);
    expect(fast).toBeLessThan(0.58);
    expect(Math.abs(fast - slow)).toBeLessThan(0.12);
  });
});
