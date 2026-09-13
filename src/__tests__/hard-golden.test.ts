import { describe, it, expect } from 'vitest';
import { createRng, hashString } from '../core/rng';
import { Dir } from '../core/dir';
import { ENEMIES, enemyDef } from '../data/enemies';
import { createEnemy, generateFloor } from '../systems/dungeon';
import { derivePlayer, emptyEquipment } from '../systems/player';
import { rollEnemyLoot, rollContainerLoot, rollEquipment } from '../systems/items';
import golden from './fixtures/hard-golden.json';

/**
 * Hard is the game as it was — pinned to numbers, not to itself.
 *
 * The tests in difficulty.test.ts prove that `'hard'` and the old two-argument
 * call shape agree. That is worth having, but it compares this branch against
 * this branch: change a constant in enemies.ts or the curve in depthPower and
 * both sides move together and the test still passes.
 *
 * So the fixture beside this file was captured by running these exact
 * computations against the commit *before* difficulty levels existed, and the
 * values are frozen there. It is the only check that still means something
 * once this branch is master and there is no old version left to diff against.
 *
 * The original health, loot and player baselines remain frozen. Biome variety
 * deliberately changes whole floors, so their new hash is pinned separately;
 * the old hash stays in the fixture as the historical reference.
 */

const scrub = (v: unknown) => JSON.stringify(v, (k, x) => (k === 'uid' ? undefined : x));
const hash = (parts: string[]) => hashString(parts.join(' ')).toString(16);

describe('hard matches the pre-difficulty game, to the number', () => {
  it('generates the same 1,200 floors', () => {
    const out: string[] = [];
    for (let seed = 0; seed < 200; seed++) {
      for (let depth = 1; depth <= 6; depth++) out.push(scrub(generateFloor(seed, depth, 'hard')));
    }
    expect(hash(out)).toBe(golden.varietyFloorHash);
    // Generating 1,200 floors outruns the default 5s budget when the suite
    // runs its files in parallel.
  }, 60_000);

  it('rolls the same 1,800 piles of loot', () => {
    const out: string[] = [];
    for (let seed = 0; seed < 200; seed++) {
      const depth = 1 + (seed % 6);
      const find = (seed * 7) % 200;
      for (const id of ['rat', 'skeleton', 'ghoul', 'hollow_knight', 'ashen_king']) {
        out.push(scrub(rollEnemyLoot(createRng(seed), enemyDef(id), depth, find, undefined, {}, undefined, [], 'hard')));
      }
      for (const tier of ['urn', 'chest', 'vault', 'secret'] as const) {
        out.push(scrub(rollContainerLoot(createRng(seed), depth, find, tier, undefined, {}, [], 'hard')));
      }
    }
    expect(hash(out)).toBe(golden.lootHash);
  }, 60_000);

  it('spawns every monster with the same health at every depth', () => {
    const table: Record<string, number[]> = {};
    for (const def of ENEMIES.filter((e) => e.id in golden.enemyHp)) {
      table[def.id] = [1, 2, 3, 4, 5, 6].map((d) => createEnemy(def, 1, 1, Dir.N, 'x', d, 'hard').hp);
    }
    expect(table).toEqual(golden.enemyHp);
  });

  it('gives the player the same health in the same gear', () => {
    // Fractional stats would have made the new Math.round() move a number that
    // the old bare addition left alone; sixty random kits say it does not.
    const out: number[] = [];
    for (let seed = 0; seed < 60; seed++) {
      const rng = createRng(seed + 7777);
      const eq = emptyEquipment();
      for (const slot of ['weapon', 'head', 'chest', 'hands', 'legs', 'offhand'] as const) {
        if (rng.chance(0.8)) (eq as Record<string, unknown>)[slot] = rollEquipment(rng, rng.int(1, 6), rng.int(0, 120));
      }
      out.push(derivePlayer(eq, { toughness: seed % 6 }, 'hard').maxHp);
    }
    expect(out).toEqual(golden.playerHp);
  });
});
