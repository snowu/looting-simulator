import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIFFICULTIES, difficultyOf } from '../data/difficulty';
import { enemyDef } from '../data/enemies';
import { createEnemy, depthPower, generateFloor } from '../systems/dungeon';
import { derivePlayer, emptyEquipment, BASE_HP } from '../systems/player';
import { rollEnemyLoot, rollContainerLoot, makeConsumable } from '../systems/items';
import { newGame } from '../state/game-state';
import { parseSave, serializeSave } from '../state/save-format';
import { migrateSave } from '../state/migrations';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { addItem } from '../state/inventory';
import { Dir, turnAround } from '../core/dir';

/**
 * Difficulty levels: Hard is the game as it was, Normal is the gentler one.
 *
 * The first block is the load-bearing one. Hard's whole contract is that it
 * computes the old numbers, so these tests pin it down three ways: the config
 * is all ones and zeroes, generation with an explicit 'hard' is identical to
 * generation without one, and spot formulas (enemy HP, player HP, loot gold)
 * match the pre-difficulty arithmetic exactly.
 */
describe('hard is the game as it was', () => {
  it('has identity tuning: every multiplier 1, every bonus 0', () => {
    const h = DIFFICULTIES.hard;
    for (const [k, v] of Object.entries(h)) {
      if (typeof v !== 'number') continue;
      expect(v, k).toBe(k === 'findBonus' ? 0 : 1);
    }
  });

  it('is the fallback for anything unknown or absent', () => {
    expect(difficultyOf(undefined).id).toBe('hard');
    expect(difficultyOf(null).id).toBe('hard');
    expect(difficultyOf('nightmare').id).toBe('hard');
    expect(difficultyOf('normal').id).toBe('normal');
  });

  it('generates bit-identical floors to the old call shape', () => {
    // Item uids carry a timestamp and a counter, so they differ between any
    // two calls by design; everything the player can ever see must not.
    // Wide net on purpose: every depth, seven seeds. Note that this compares
    // the branch against itself — it proves the optional argument defaults to
    // Hard, not that Hard still computes the old numbers. hard-golden.test.ts
    // is the one that pins the actual values, against a fixture captured from
    // the commit before difficulty levels existed.
    const scrub = (f: unknown) => JSON.stringify(f, (k, v) => (k === 'uid' ? undefined : v));
    for (const seed of [1, 2, 3, 42, 777, 1234, 9999]) {
      for (const depth of [1, 2, 3, 4, 5, 6]) {
        const oldShape = generateFloor(seed, depth);
        const explicit = generateFloor(seed, depth, 'hard');
        expect(scrub(explicit)).toBe(scrub(oldShape));
      }
    }
  });

  it('hard matches the default call shape across hundreds of seeds', () => {
    // The spot checks above pin a few seeds; this hammers the whole surface
    // so a divergence cannot hide between sampled points. Same uid caveat.
    const scrub = (f: unknown) => JSON.stringify(f, (k, v) => (k === 'uid' ? undefined : v));
    for (let seed = 0; seed < 200; seed++) {
      const depth = 1 + (seed % 6);
      const find = seed % 40;
      expect(scrub(generateFloor(seed, depth, 'hard'))).toBe(scrub(generateFloor(seed, depth)));
      for (const id of ['rat', 'ghoul', 'hollow_knight', 'ashen_king']) {
        expect(createEnemy(enemyDef(id), 0, 0, Dir.N, 'x', depth, 'hard'))
          .toEqual(createEnemy(enemyDef(id), 0, 0, Dir.N, 'x', depth));
      }
      expect(scrub(rollEnemyLoot(createRng(seed), enemyDef('ghoul'), depth, find, undefined, {}, {}, [], 'hard')))
        .toBe(scrub(rollEnemyLoot(createRng(seed), enemyDef('ghoul'), depth, find)));
      for (const tier of ['urn', 'chest', 'vault', 'secret'] as const) {
        expect(scrub(rollContainerLoot(createRng(seed), depth, find, tier, undefined, {}, [], 'hard')))
          .toBe(scrub(rollContainerLoot(createRng(seed), depth, find, tier)));
      }
    }
  });

  it('computes the old enemy health on hard', () => {
    for (const id of ['rat', 'skeleton', 'ghoul', 'hollow_knight', 'ashen_king']) {
      const def = enemyDef(id);
      for (const depth of [1, 4, 6]) {
        const e = createEnemy(def, 0, 0, Dir.N, 'x', depth, 'hard');
        expect(e.hp).toBe(Math.round(def.hp * depthPower(def, depth)));
        expect(e.maxHp).toBe(e.hp);
      }
    }
  });

  it('computes the old player health on hard', () => {
    expect(derivePlayer(emptyEquipment(), {}, 'hard').maxHp).toBe(BASE_HP);
    expect(derivePlayer(emptyEquipment(), {}, 'hard').maxHp)
      .toBe(derivePlayer(emptyEquipment(), {}).maxHp);
  });

  it('rolls the old loot gold on hard', () => {
    // Same uid caveat as floors above: compare loot with uids scrubbed.
    const scrub = (l: unknown) => JSON.stringify(l, (k, v) => (k === 'uid' ? undefined : v));
    for (const seed of [3, 11, 99]) {
      const a = rollEnemyLoot(createRng(seed), enemyDef('ghoul'), 4, 10);
      const b = rollEnemyLoot(createRng(seed), enemyDef('ghoul'), 4, 10, undefined, {}, {}, [], 'hard');
      expect(scrub(b)).toBe(scrub(a));
      const c = rollContainerLoot(createRng(seed), 4, 10, 'chest');
      const d = rollContainerLoot(createRng(seed), 4, 10, 'chest', undefined, {}, [], 'hard');
      expect(scrub(d)).toBe(scrub(c));
    }
  });
});

describe('normal tones it down and pays slightly better', () => {
  it('softens monsters and traps while padding the player', () => {
    const n = DIFFICULTIES.normal;
    expect(n.enemyHp).toBeLessThan(1);
    expect(n.enemyDamage).toBeLessThan(1);
    expect(n.enemyDefense).toBeLessThan(1);
    expect(n.trapDamage).toBeLessThan(1);
    expect(n.playerHp).toBeGreaterThan(1);
    expect(n.playerHealing).toBeGreaterThan(1);
    expect(n.staminaRegen).toBeGreaterThan(1);
    expect(n.parryGrace).toBeCloseTo(5 / 3);
    expect(n.gold).toBeGreaterThan(1);
    expect(n.findBonus).toBeGreaterThan(0);
    expect(n.dropChance).toBeGreaterThan(1);
  });

  it('spawns weaker monsters with the same power curve underneath', () => {
    const def = enemyDef('skeleton');
    const hard = createEnemy(def, 0, 0, Dir.N, 'h', 4, 'hard');
    const normal = createEnemy(def, 0, 0, Dir.N, 'n', 4, 'normal');
    expect(normal.hp).toBeLessThan(hard.hp);
    expect(normal.hp).toBe(Math.round(hard.hp * DIFFICULTIES.normal.enemyHp));
    expect(normal.power).toBe(hard.power);
  });

  it('pads player health', () => {
    const hard = derivePlayer(emptyEquipment(), {}, 'hard').maxHp;
    const normal = derivePlayer(emptyEquipment(), {}, 'normal').maxHp;
    expect(normal).toBe(Math.round(hard * DIFFICULTIES.normal.playerHp));
    expect(normal).toBeGreaterThan(hard);
  });

  it('pays at least as much gold for the same draw', () => {
    for (const seed of [5, 23]) {
      const hard = rollEnemyLoot(createRng(seed), enemyDef('ghoul'), 4, 0, undefined, {}, {}, [], 'hard');
      const normal = rollEnemyLoot(createRng(seed), enemyDef('ghoul'), 4, 0, undefined, {}, {}, [], 'normal');
      expect(normal.gold).toBeGreaterThanOrEqual(hard.gold);
    }
  });
});

describe('difficulty and runs', () => {
  it('defaults new games to hard and snapshots the run at start', () => {
    const s = newGame(createRng(1));
    expect(s.difficulty).toBe('hard');
    s.difficulty = 'normal';
    startRun(s, 11);
    expect(s.run!.difficulty).toBe('normal');
    // The snapshot sticks even if town moves afterwards.
    s.difficulty = 'hard';
    expect(s.run!.difficulty).toBe('normal');
  });

  it('starts a delve at full health for the difficulty', () => {
    // startRun derives the player itself to seed hp/stamina; forgetting to
    // pass the difficulty there left a Normal run opening at Hard's maximum,
    // i.e. visibly short of full on the very first frame.
    for (const id of ['hard', 'normal'] as const) {
      const s = newGame(createRng(31));
      s.difficulty = id;
      const run = startRun(s, 31);
      expect(run.player.hp).toBe(derivePlayer(s.equipment, s.meta, id).maxHp);
      expect(new World(s).derived.maxHp).toBe(run.player.hp);
    }
  });

  it('migrates old saves — in town or mid-delve — to hard', () => {
    // Simulate saves written before difficulty existed: the field is gone AND
    // the revision predates it, since a current revision with no field would
    // mean "already migrated" and migrations would (correctly) not run.
    const fresh = newGame(createRng(2));
    const raw = JSON.parse(serializeSave(fresh)) as Record<string, unknown>;
    delete raw.difficulty;
    raw.revision = 16;
    startRun(fresh, 13);
    const midRun = JSON.parse(serializeSave(fresh)) as Record<string, unknown>;
    delete (midRun as { difficulty?: unknown }).difficulty;
    delete ((midRun.run ?? {}) as Record<string, unknown>).difficulty;
    midRun.revision = 16;
    const townSave = parseSave(JSON.stringify(raw))!;
    expect(townSave.difficulty).toBe('hard');
    const runSave = parseSave(JSON.stringify(midRun))!;
    expect(runSave.difficulty).toBe('hard');
    expect(runSave.run!.difficulty).toBe('hard');
  });

  it('keeps a chosen normal through a save round trip', () => {
    const s = newGame(createRng(3));
    s.difficulty = 'normal';
    startRun(s, 17);
    const back = parseSave(serializeSave(s))!;
    expect(back.difficulty).toBe('normal');
    expect(back.run!.difficulty).toBe('normal');
  });

  it('migrating twice changes nothing', () => {
    const s = parseSave(serializeSave(newGame(createRng(4))))!;
    const again = migrateSave(JSON.parse(JSON.stringify(s)));
    expect(again).toEqual(s);
  });
});

describe('difficulty in the world', () => {
  function worldAt(seed: number, difficulty: 'normal' | 'hard'): World {
    const state = newGame(createRng(seed));
    state.difficulty = difficulty;
    startRun(state, seed);
    const w = new World(state);
    w.floor.enemies = [];
    return w;
  }

  function tick(w: World, seconds: number): void {
    for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
  }

  it('reads the run snapshot, not live town state', () => {
    const state = newGame(createRng(5));
    state.difficulty = 'normal';
    startRun(state, 5);
    // Town moves afterwards; the delve does not follow. This is the whole
    // reason the switch locks mid-run: no softening a boss fight halfway.
    state.difficulty = 'hard';
    const w = new World(state);
    expect(w.difficultyId).toBe('normal');
    expect(w.diff.id).toBe('normal');
    expect(w.derived.maxHp).toBe(derivePlayer(state.equipment, state.meta, 'normal').maxHp);
  });

  it('a skeleton hits softer on normal for the same fight', () => {
    const hard = worldAt(6, 'hard');
    const normal = worldAt(6, 'normal');
    for (const w of [hard, normal]) {
      const t = w.frontTile(1);
      // Identical monsters in both worlds, so the only difference is the
      // difficulty scaling on the way in.
      w.floor.enemies.push(createEnemy(enemyDef('skeleton'), t.x, t.y, turnAround(w.player.facing), 'hitter', 1));
    }
    const hardHp = hard.player.hp;
    const normalHp = normal.player.hp;
    tick(hard, 4);
    tick(normal, 4);
    const hardLoss = hardHp - hard.player.hp;
    const normalLoss = normalHp - normal.player.hp;
    expect(hardLoss).toBeGreaterThan(0);
    expect(normalLoss).toBeGreaterThan(0);
    expect(normalLoss).toBeLessThan(hardLoss);
  });

  it('a draught mends more on normal', () => {
    const hard = worldAt(7, 'hard');
    const normal = worldAt(7, 'normal');
    for (const w of [hard, normal]) {
      addItem(w.run.backpack, makeConsumable('healing_draught', 1));
      w.player.hp = 10;
    }
    const healed = (w: World): number => {
      const before = w.player.hp;
      w.use(w.run.backpack.items.find((i) => i.ref === 'healing_draught')!.uid);
      return w.player.hp - before;
    };
    expect(healed(normal)).toBeGreaterThan(healed(hard));
  });
});
