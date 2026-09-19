import { describe, expect, it } from 'vitest';
import { DIRS, DX, DY, dirOf } from '../core/dir';
import { createRng } from '../core/rng';
import { newGame } from '../state/game-state';
import { EnemyState, FLOOR, blocksMove, createEnemy } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { BURROWS_NOISE_MULT, OSSUARY_RISE_HP, OSSUARY_STIR, OSSUARY_STIR_AFTER } from '../data/laws';
import { CRACK_BLOWS, CRACK_NOISE, Crack } from '../data/walls';
import { startRun } from '../systems/run';
import { World } from '../world/world';

interface Private {
  resolvePlayerAttack(): void;
  killEnemy(e: EnemyState): void;
  breakProp(p: unknown): void;
}
const priv = (w: World) => w as unknown as Private;

function run(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

function world(seed: number, biome: string): World {
  const state = newGame(createRng(seed));
  startRun(state, seed);
  const w = new World(state);
  w.floor.enemies = [];
  w.floor.traps = [];
  w.floor.biome = biome;
  return w;
}

/** A dead skeleton a few tiles from the player, killed just now. */
function corpse(w: World, id = 'skeleton'): EnemyState {
  const p = w.player;
  const e = createEnemy(enemyDef(id), p.x + 3, p.y, 0, `c_${id}`, 1);
  e.ai = 'dead';
  e.hp = 0;
  e.deadT = 0;
  w.floor.enemies.push(e);
  return e;
}

/** Stand facing a cracked wall. */
function facingCrack(w: World): Crack {
  const f = w.floor;
  for (const c of f.cracks ?? []) for (const d of DIRS) {
    const px = c.x - DX[d], py = c.y - DY[d];
    if (blocksMove(f, px, py)) continue;
    const facing = dirOf(DX[d], DY[d])!;
    Object.assign(w.player, { x: px, y: py, facing });
    Object.assign(w.anim, { fromX: px, fromY: py });
    return c;
  }
  throw new Error('no crack');
}

describe('the Ossuary: the dead do not stay down', () => {
  it('undead remains stir, then stand at half health, once', () => {
    const w = world(501, 'crypt');
    const e = corpse(w);
    run(w, OSSUARY_STIR_AFTER - 0.5);
    expect(e.stirT).toBeUndefined();
    run(w, 1);
    expect(e.stirT).toBeDefined();
    run(w, OSSUARY_STIR + 0.1);
    expect(e.ai).not.toBe('dead');
    expect(e.risen).toBe(true);
    expect(e.hp).toBe(Math.round(e.maxHp * OSSUARY_RISE_HP));
    priv(w).killEnemy(e);
    e.deadT = 0;
    run(w, OSSUARY_STIR_AFTER + OSSUARY_STIR + 1);
    expect(e.ai).toBe('dead');
  });

  it('shattered or sanctified remains, the living, and other floors stay down', () => {
    for (const [biome, id, remains] of [['crypt', 'skeleton', 'shattered'], ['crypt', 'skeleton', 'sanctified'], ['crypt', 'goblin', undefined], ['catacombs', 'skeleton', undefined]] as const) {
      const w = world(502, biome);
      const e = corpse(w, id);
      if (remains) e.remains = remains;
      run(w, OSSUARY_STIR_AFTER + OSSUARY_STIR + 1);
      expect(e.ai, `${biome} ${id} ${remains}`).toBe('dead');
    }
  });

  it('corpses long dead do not all stand when you come back', () => {
    const w = world(503, 'crypt');
    const e = corpse(w);
    e.deadT = 60;
    run(w, OSSUARY_STIR + 1);
    expect(e.ai).toBe('dead');
  });
});

describe('the Deep Mines: braced walls come down hard', () => {
  it('a wall brought down crushes and staggers what stands beside it', () => {
    for (const biome of ['mines', 'crypt']) {
      const w = world(504, biome);
      const c = facingCrack(w);
      const beside = DIRS.map((d) => ({ x: c.x + DX[d], y: c.y + DY[d] }))
        .find((t) => w.floor.tiles[t.y * w.floor.width + t.x] === FLOOR && !(t.x === w.player.x && t.y === w.player.y))!;
      const e = createEnemy(enemyDef('skeleton'), beside.x, beside.y, 0, 'victim', 1);
      e.maxHp = e.hp = 500;
      w.floor.enemies.push(e);
      for (let i = 0; i < CRACK_BLOWS; i++) priv(w).resolvePlayerAttack();
      expect(c.broken).toBe(true);
      if (biome === 'mines') {
        expect(e.hp, biome).toBeLessThan(500);
        expect(e.ai).toBe('recover');
      } else {
        expect(e.hp, biome).toBe(500);
      }
    }
  });
});

describe('the Vermin Burrows: noise carries', () => {
  it('a cracked wall is heard further', () => {
    const far = Math.round(CRACK_NOISE * BURROWS_NOISE_MULT);
    for (const biome of ['burrows', 'crypt']) {
      const w = world(505, biome);
      const c = facingCrack(w);
      const f = w.floor;
      let spot: { x: number; y: number } | null = null;
      for (let y = 1; y < f.height - 1 && !spot; y++) for (let x = 1; x < f.width - 1 && !spot; x++) {
        const d = Math.abs(x - c.x) + Math.abs(y - c.y);
        if (d > CRACK_NOISE && d <= far && f.tiles[y * f.width + x] === FLOOR) spot = { x, y };
      }
      const e = createEnemy(enemyDef('rat'), spot!.x, spot!.y, 0, 'ear', 1);
      w.floor.enemies.push(e);
      priv(w).resolvePlayerAttack();
      expect(e.alert > 0, biome).toBe(biome === 'burrows');
    }
  });

  it('a broken root cache draws monsters to the cache', () => {
    const w = world(506, 'burrows');
    const p = w.player;
    const cache = { id: 'rc', kind: 'root_cache', x: p.x + 2, y: p.y, used: false, tier: 'none', blocking: true, mimic: false };
    const e = createEnemy(enemyDef('rat'), p.x + 6, p.y, 0, 'lured', 1);
    w.floor.enemies.push(e);
    priv(w).breakProp(cache);
    expect(e.alert).toBeGreaterThan(0);
    expect([e.lastSeenX, e.lastSeenY]).toEqual([cache.x, cache.y]);
  });
});
