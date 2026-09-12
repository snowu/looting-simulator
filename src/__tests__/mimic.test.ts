import { describe, expect, it } from 'vitest';
import { DIRS, DX, DY } from '../core/dir';
import { createRng } from '../core/rng';
import { newGame } from '../state/game-state';
import { FLOOR, chestIsMimic } from '../systems/dungeon';
import { startRun } from '../systems/run';
import { World } from '../world/world';

function arena(seed = 71): World {
  const state = newGame(createRng(seed));
  startRun(state, seed);
  const w = new World(state);
  const f = w.floor;
  f.enemies = [];
  f.props = f.props.filter((p) => !p.blocking);
  const free = (x: number, y: number) =>
    f.tiles[y * f.width + x] === FLOOR && !f.doors.some((d) => d.x === x && d.y === y) && !f.stairs.some((s) => s.x === x && s.y === y);
  for (let y = 2; y < f.height - 2; y++) for (let x = 2; x < f.width - 2; x++) for (const d of DIRS) {
    if (!free(x, y) || !free(x + DX[d], y + DY[d])) continue;
    Object.assign(w.player, { x, y, facing: d });
    Object.assign(w.anim, { fromX: x, fromY: y, yaw: d * Math.PI / 2, yawTo: d * Math.PI / 2 });
    return w;
  }
  throw new Error('no mimic arena');
}

describe('mimics', () => {
  it('rolls on a deterministic stream at roughly the intended rate', () => {
    const rolls = Array.from({ length: 1000 }, (_, i) => chestIsMimic(12345, `p${i}`));
    expect(rolls.filter(Boolean).length).toBeGreaterThan(90);
    expect(rolls.filter(Boolean).length).toBeLessThan(150);
    expect(Array.from({ length: 1000 }, (_, i) => chestIsMimic(12345, `p${i}`))).toEqual(rolls);
  });

  it('turns into one enemy without yielding immediate loot', () => {
    const w = arena();
    const t = w.frontTile();
    w.floor.props.push({ id: 'bait', kind: 'chest', x: t.x, y: t.y, used: false, tier: 'vault', blocking: true, mimic: true });
    const gold = w.run.gold;
    const pickups = w.floor.pickups.length;

    w.interact();

    expect(w.floor.props.some((p) => p.id === 'bait')).toBe(false);
    expect(w.floor.pickups).toHaveLength(pickups);
    expect(w.run.gold).toBe(gold);
    expect(w.floor.enemies).toHaveLength(1);
    const mimic = w.floor.enemies[0];
    expect(mimic.def).toBe('mimic');
    expect(mimic.ai).toBe('recover');
    expect(mimic.alert).toBeGreaterThan(0);
    expect(mimic.maxHp).toBe(52);
    expect(mimic.mimicTier).toBe('vault');

    w.interact();
    expect(w.floor.enemies).toHaveLength(1);
  });

  it('releases the disguised chest tier when slain', () => {
    const w = arena(72);
    const t = w.frontTile();
    w.floor.props.push({ id: 'hoard', kind: 'chest', x: t.x, y: t.y, used: false, tier: 'secret', blocking: true, mimic: true });
    w.interact();
    const mimic = w.floor.enemies[0];

    (w as unknown as { killEnemy(e: typeof mimic): void }).killEnemy(mimic);

    expect(w.run.stats.kills).toBe(1);
    const loot = w.floor.pickups.find((p) => p.x === t.x && p.y === t.y);
    expect(loot).toBeDefined();
    expect(loot!.gold).toBeGreaterThan(0);
    expect(loot!.items.length).toBeGreaterThan(0);
  });
});
