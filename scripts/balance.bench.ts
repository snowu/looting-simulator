/*
 * The entry point for `npm run playtest`.
 *
 * Writes its report to a file rather than stdout because vitest swallows
 * console output under the default reporter, and the whole point of this thing
 * is that two reports can be diffed.
 *
 * Four profiles, because "is it too hard" has four different answers depending
 * on who is asking: someone on their first delve, the same person with the
 * parry taken away, someone who has played a dozen runs, and someone in the
 * best gear the game makes. The last two are run twice — once by a bot that
 * fights to almost nothing and never retreats, and once by one that drinks
 * early and leaves while it still can. The gap between those two is roughly
 * the gap between a bad player and a careful one.
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { allTables, LADDER } from './tables';
import { playtest, summarise, geared, MID_META, DEEP_META, Policy } from './playtest';
import { addItem } from '../src/state/inventory';
import { makeConsumable } from '../src/systems/items';

const OUT = process.env.PLAYTEST_OUT ?? 'playtest-report.txt';
const RUNS = Number(process.env.PLAYTEST_RUNS ?? 24);

/** Drinks early, leaves while it still can. What a person actually does. */
const CAREFUL: Partial<Policy> = { parrySkill: 0.55, drinkAt: 0.6, fleeAt: 0.45 };

it('balance report', () => {
  const parts: string[] = [allTables(), ''];
  const gearAt = (d: number) => LADDER.find((l) => l.depth === d)!.make;

  // The same seeds for both sides of the parry comparison, so the only thing
  // that differs between the two reports is the parry. Different seed sets
  // measured the seeds.
  const SEED = 1000;
  parts.push(summarise(playtest({ runs: RUNS, seed: SEED, policy: { parrySkill: 0.35 } }), 'fresh character, parry 35%'), '');
  parts.push(summarise(playtest({ runs: RUNS, seed: SEED, policy: { parrySkill: 0 } }), 'fresh character, no parry'), '');

  for (const [name, depth, meta] of [['iron Rare kit', 4, MID_META], ['moonsilver Epic kit', 6, DEEP_META]] as const) {
    parts.push(summarise(playtest({ runs: RUNS, seed: 9000, prepare: geared(gearAt(depth), meta) }), `geared: ${name}, reckless`), '');
    parts.push(summarise(playtest({ runs: RUNS, seed: 21000, prepare: geared(gearAt(depth), meta), policy: CAREFUL }), `geared: ${name}, careful`), '');
  }

  // The question the other four profiles cannot answer: is the bottom floor
  // reachable by someone who actually prepares for it? Endgame gear, a pack
  // full of Greater Healing, a Scroll of Recall, walking past the urns, and
  // going down rather than clearing floors. If this one stops reaching depth 6,
  // the floor multiplier in depthPower() is the knob that has gone too far.
  const equip = geared(gearAt(6), DEEP_META);
  parts.push(summarise(playtest({
    runs: RUNS, seed: 21000,
    prepare: (state) => {
      equip(state);
      addItem(state.stash, makeConsumable('greater_healing', 20));
      addItem(state.stash, makeConsumable('scroll_recall', 1));
    },
    policy: { parrySkill: 0.8, drinkAt: 0.6, fleeAt: 0.15, lootUrns: false, floorBudget: 45 },
  }), 'a prepared expedition: deep gear, 20 greater heals, straight down'), '');

  writeFileSync(OUT, parts.join('\n') + '\n');
});
