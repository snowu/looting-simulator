import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { rollRarity, rollEquipment, itemValue } from '../systems/items';
import { Rarity, RARITY_ORDER } from '../types';
import { playtest, geared, MID_META } from '../../scripts/playtest';
import { LADDER } from '../../scripts/tables';

/**
 * Loot-find regression pins.
 *
 * The find formula (`rollRarity`: find divides the Common weight and
 * multiplies the rest) is due a rewrite, and its effects fan out through
 * rarity mix, drop value, gold income and kill pace. These tests pin the
 * behaviour at both ends so a rewrite either stays consistent or fails
 * loudly:
 *
 * - Layer 1 (pure functions, 360 deterministic rolls): the rarity vectors
 *   are exact — any formula change moves them and must update them on
 *   purpose. The ordering asserts state the promise find must keep.
 * - Layer 2 (bot end-to-end, 6 fixed-seed runs): wide bands on game-level
 *   consequences. They catch pipeline breakage (loot stops flowing,
 *   everybody dies on D1), not tuning opinions.
 *
 * Re-baselining after an intentional change: run this file, read the
 * failure diff, confirm the new numbers are the intended ones, update.
 * Deeper analysis lives in `scripts/find.bench.ts` (`npm run find`).
 */

function rarityMix(find: number): { counts: number[]; meanValue: number } {
  const counts = [0, 0, 0, 0, 0];
  let value = 0, n = 0;
  for (let depth = 1; depth <= 6; depth++) {
    for (let s = 0; s < 60; s++) {
      counts[RARITY_ORDER[rollRarity(createRng(find * 100000 + depth * 1000 + s), depth, find)]]++;
      const item = rollEquipment(createRng(find * 777777 + depth * 1000 + s), depth, find);
      value += itemValue(item) * (item.qty ?? 1);
      n++;
    }
  }
  return { counts, meanValue: value / n };
}

describe('loot find formula', () => {
  it('pins the rarity mix at find 0 and find 60', () => {
    // Exact: 360 deterministic rolls per level. A rewrite moves these;
    // moving them back without thought defeats the test.
    expect(rarityMix(0).counts).toEqual([258, 77, 22, 3, 0]);
    expect(rarityMix(60).counts).toEqual([192, 142, 22, 4, 0]);
  });

  it('find buys quality, never less of it', () => {
    const base = rarityMix(0);
    const boosted = rarityMix(60);
    const plus = (c: number[]) => c[1] + c[2] + c[3] + c[4];
    // The promise: more find shifts Common up the ladder (visible here as
    // Common -> Uncommon) and never shifts anything down.
    expect(plus(boosted.counts)).toBeGreaterThan(plus(base.counts));
    expect(boosted.counts[2] + boosted.counts[3] + boosted.counts[4])
      .toBeGreaterThanOrEqual(base.counts[2] + base.counts[3] + base.counts[4]);
    expect(boosted.meanValue).toBeGreaterThan(base.meanValue);
    // ...within sane bounds: find 60 roughly doubles Uncommons, not 10x.
    expect(boosted.meanValue).toBeLessThan(base.meanValue * 2);
  });

  it('bot end-to-end economy stays in band (geared D4, careful, 6 seeds)', () => {
    const gearAt = (d: number) => LADDER.find((l) => l.depth === d)!.make;
    const reps = playtest({
      runs: 6,
      seed: 9000,
      prepare: (s) => geared(gearAt(4), MID_META)(s),
      policy: { parrySkill: 0.55, drinkAt: 0.6, fleeAt: 0.45, targetDepth: 4 },
    });
    expect(reps.filter((r) => r.outcome === 'timeout')).toHaveLength(0);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const gold = avg(reps.map((r) => r.gold));
    const value = avg(reps.map((r) => r.valueKept));
    const deepest = avg(reps.map((r) => r.deepest));
    const kills = avg(reps.map((r) => r.kills));
    // Material-identity pass: ~610 kept value in this six-seed sample; bands are wide
    // on purpose — they catch breakage, not tuning.
    expect(deepest).toBeGreaterThanOrEqual(2.5);
    expect(gold).toBeGreaterThanOrEqual(20);
    expect(gold).toBeLessThanOrEqual(400);
    expect(value).toBeGreaterThanOrEqual(40);
    expect(value).toBeLessThanOrEqual(700);
    expect(kills).toBeGreaterThanOrEqual(10);
    expect(reps.filter((r) => r.outcome === 'extracted').length).toBeGreaterThanOrEqual(1);
  }, 120000);
});
