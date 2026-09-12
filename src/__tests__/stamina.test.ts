import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY } from '../core/dir';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { FLOOR } from '../systems/dungeon';

function tick(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

function arena(seed = 1): World {
  const state = newGame(createRng(seed));
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
      let ok = free(x, y) && free(x - DX[d], y - DY[d]);
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

/** Swing until the swing is refused or the cap is hit; returns swings landed. */
function swingUntilSpent(w: World, cap = 60): number {
  let swings = 0;
  for (let i = 0; i < cap; i++) {
    const before = w.anim.attack;
    w.attack();
    if (w.anim.attack === before) break;
    swings++;
    tick(w, w.derived.swing.windup + w.derived.swing.recovery + 1 / 30);
  }
  return swings;
}

describe('stamina', () => {
  it('refuses to swing on an empty bar', () => {
    const w = arena();
    w.player.stamina = 0;
    w.attack();
    expect(w.anim.attack).toBe('idle');
  });

  it('refuses a swing it cannot pay for in full', () => {
    const w = arena();
    // A sliver used to be enough, and the trickle of regen at the end of every
    // recovery always leaves a sliver — which is how the free swings survived.
    w.player.stamina = w.derived.swing.staminaCost - 0.1;
    w.attack();
    expect(w.anim.attack).toBe('idle');
    w.player.stamina = w.derived.swing.staminaCost;
    w.attack();
    expect(w.anim.attack).toBe('windup');
  });

  it('lands a weaker blow the more tired you are', () => {
    const full = arena();
    full.attack();
    const tired = arena();
    tired.player.stamina = tired.derived.swing.staminaCost;
    tired.attack();
    expect(tired.anim.attackPower).toBeLessThan(full.anim.attackPower);
    expect(tired.anim.attackPower).toBeGreaterThanOrEqual(0.4);
  });

  it('runs a full bar dry rather than swinging for free forever', () => {
    const w = arena();
    const cost = w.derived.swing.staminaCost;
    const swings = swingUntilSpent(w);
    // A bar buys a bounded number of swings; it used to buy unlimited ones.
    expect(swings).toBeLessThanOrEqual(Math.ceil(w.derived.maxStamina / cost) + 1);
    expect(w.player.stamina).toBeLessThan(cost);
    expect(swingUntilSpent(w, 5)).toBe(0);
  });

  it('recovers after backing off, and swings again', () => {
    const w = arena();
    swingUntilSpent(w);
    expect(w.player.stamina).toBeLessThan(w.derived.swing.staminaCost);
    tick(w, 2);
    expect(w.player.stamina).toBeGreaterThan(0);
    w.attack();
    expect(w.anim.attack).toBe('windup');
  });
});
