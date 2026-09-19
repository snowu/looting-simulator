import { describe, it, expect } from 'vitest';
import { createRng, hashString } from '../core/rng';
import { Dir } from '../core/dir';
import { ENEMIES, enemyDef } from '../data/enemies';
import { Floor, createEnemy, generateFloor } from '../systems/dungeon';
import { ELITE_HP_MULT, IRONHIDE_HP_MULT } from '../data/elites';
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
 * Historical values remain frozen. Intentional material-identity, crafting, biome and weapon-roster changes
 * are pinned separately so later drift is still visible without rewriting history.
 */

const scrub = (v: unknown) => JSON.stringify(v, (k, x) => (k === 'uid' ? undefined : x));
const hash = (parts: string[]) => hashString(parts.join(' ')).toString(16);

/**
 * Undo the post-generation passes on a copy of the floor: `promoteElite` (the
 * trait goes, and the health it baked in), the ambush pass (placed ceiling
 * droppers removed, buried stalkers stood back up) and the cracked walls.
 */
function demote(f: Floor): Floor {
  const copy: Floor = JSON.parse(JSON.stringify(f));
  copy.enemies = copy.enemies.filter((e) => !e.id.startsWith('amb') && e.id !== 'grave0');
  delete copy.cracks;
  for (const e of copy.enemies) delete e.lurk;
  for (const e of copy.enemies) {
    if (!e.elite) continue;
    const mult = ELITE_HP_MULT * (e.elite === 'ironhide' ? IRONHIDE_HP_MULT : 1);
    const base = [-1, 0, 1].map((d) => Math.round(e.maxHp / mult) + d).find((c) => Math.round(c * mult) === e.maxHp)!;
    e.maxHp = e.hp = base;
    delete e.elite;
  }
  return copy;
}

describe('Hard generation, loot and stats have explicit balance baselines', () => {
  it('generates the pinned 1,200 expanded floors', () => {
    const out: string[] = [];
    const withElites: string[] = [];
    for (let seed = 0; seed < 200; seed++) {
      for (let depth = 1; depth <= 6; depth++) {
        const f = generateFloor(seed, depth, 'hard');
        withElites.push(scrub(f));
        out.push(scrub(demote(f)));
      }
    }
    // Material rolls embedded in pickups now use consistent family tier weights.
    // Re-pinned on 2026-09-19 when the Goblin Cutpurse's spawn weight went from
    // 3 to 1: once it stole from the pack, a quarter of every depth-1 floor
    // being pickpockets was too many.
    // Elites are stripped first: they are rolled on their own stream after
    // generation, so with them undone every floor must be byte-identical to the
    // one pinned before they existed.
    expect(hash(out)).toBe(golden.materialFloorHash);
    // And the elites and ambushers themselves, pinned separately.
    expect(hash(withElites)).toBe(golden.passesFloorHash);
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
    // The vault/secret good-consumable pool grew from two scrolls to four
    // (Flash, Backstep), so this moved off materialLootHash — which stays
    // frozen in the fixture as the pre-scroll record — onto scrollLootHash.
    expect(hash(out)).toBe(golden.scrollLootHash);
  }, 60_000);

  it('spawns every monster with the same health at every depth', () => {
    const table: Record<string, number[]> = {};
    for (const def of ENEMIES.filter((e) => e.id in golden.enemyHp)) {
      table[def.id] = [1, 2, 3, 4, 5, 6].map((d) => createEnemy(def, 1, 1, Dir.N, 'x', d, 'hard').hp);
    }
    expect(table).toEqual(golden.enemyHp);
  });

  it('pins player health after the material identity changes', () => {
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
    const expected = golden.materialPowerPlayerHp;
    expect(out).toEqual(expected);
  });
});
