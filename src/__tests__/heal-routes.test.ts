import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { DifficultyId } from '../data/difficulty';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { FLOOR, createEnemy } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';

/**
 * Every heal answers to the same rules — half_healing (the Eulogy Plate's
 * "all healing at x0.5"), Normal's healing, Last Flask — because every heal
 * goes through World.heal(). These pin the routes that used to go around it.
 */

function arena(difficulty: DifficultyId, seed = 1): World {
  const state = newGame(createRng(seed));
  state.difficulty = difficulty;
  startRun(state, seed);
  const w = new World(state);
  const f = w.floor;
  f.enemies = [];
  f.traps = [];
  f.props = f.props.filter((p) => !p.blocking);
  const free = (x: number, y: number) =>
    f.tiles[y * f.width + x] === FLOOR && !f.doors.some((d) => d.x === x && d.y === y) && !f.stairs.some((s) => s.x === x && s.y === y);
  for (let y = 2; y < f.height - 4; y++) for (let x = 2; x < f.width - 4; x++) {
    for (const d of DIRS) {
      if (!free(x, y) || !free(x + DX[d], y + DY[d])) continue;
      Object.assign(w.player, { x, y, facing: d });
      Object.assign(w.anim, { fromX: x, fromY: y, yaw: (d * Math.PI) / 2, yawTo: (d * Math.PI) / 2 });
      return w;
    }
  }
  throw new Error('no arena');
}

function tick(w: World, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds; t += 1 / 60) {
    w.update(1 / 60);
    w.drainEvents();
    each?.();
  }
}

/** Health one shield chip leeches back, from 1 hp, with the given healing multiplier. */
function chipLeech(difficulty: DifficultyId, healing: number): number {
  const w = arena(difficulty);
  const t = w.frontTile(1);
  const e = createEnemy(enemyDef('goblin_shield'), t.x, t.y, turnAround(w.player.facing), 'shield', 1);
  e.hp = e.maxHp = 1_000_000;
  w.floor.enemies.push(e);
  w.derived.stats.leech = 100;
  w.derived.traits.healing = healing;
  w.player.hp = 1;
  w.rng = createRng(5);
  const world = w as unknown as { shieldChip(e: unknown, def: unknown): void; view(e: unknown): unknown };
  world.shieldChip(e, world.view(e));
  return w.player.hp - 1;
}

describe('leech off a shield', () => {
  it('answers to half_healing like any other leech', () => {
    const full = chipLeech('hard', 1);
    const half = chipLeech('hard', 0.5);
    expect(full).toBeGreaterThan(1);
    expect(half).toBe(Math.round(full * 0.5));
  });

  it('answers to Normal\'s healing', () => {
    // Same seed, same blow: Normal thins the shield too, so compare against its own raw leech.
    const w = arena('normal');
    expect(w.diff.playerHealing).toBeGreaterThan(1);
    const normal = chipLeech('normal', 1);
    const unscaled = chipLeech('normal', 1 / w.diff.playerHealing);
    expect(normal).toBeGreaterThan(unscaled);
  });
});

describe('Normal\'s rest mending', () => {
  it('keeps health whole while it mends', () => {
    const w = arena('normal');
    w.player.hp = 1;
    const seen = new Set<number>();
    tick(w, 30, () => seen.add(w.player.hp));
    expect(w.player.hp).toBeGreaterThan(1);
    for (const hp of seen) expect(Number.isInteger(hp)).toBe(true);
  });

  it('mends at half the pace under half_healing', () => {
    const gained = (healing: number) => {
      const w = arena('normal');
      w.player.hp = 1;
      w.derived.traits.healing = healing;
      tick(w, 15);
      return w.player.hp - 1;
    };
    const full = gained(1);
    const half = gained(0.5);
    expect(full).toBeGreaterThan(4);
    expect(Math.abs(half - full / 2)).toBeLessThanOrEqual(1);
  });
});
