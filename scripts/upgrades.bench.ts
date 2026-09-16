/*
 * What each Warden upgrade is actually worth, now that the dungeon changed.
 *
 * The renown tree was priced against a game where nothing could kill you and
 * the floor handed you forty items. Both of those moved, so the value of every
 * upgrade moved with them — Pack Mule guards against a full pack that no longer
 * fills, while the flask (and the dungeon food around it) is the one resource
 * depth six is actually short of. This runs the same seeds with each upgrade
 * maxed and alone, and reports the delta against no upgrades at all.
 *
 * Four of the eleven are town-side (prices, identification, crafting, market
 * intelligence) and the bot never visits town. Those are reported as UNMEASURED
 * rather than as zero, because a zero here would be a statement about the
 * harness, not about the upgrade.
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { META_UPGRADES, MetaLevels } from '../src/systems/meta';
import { LADDER } from './tables';
import { geared, playtest, RunReport, Policy } from './playtest';

const RUNS = Number(process.env.PLAYTEST_RUNS ?? 24);
const SEED = 31000;

/** Upgrades whose whole effect is in town, where the bot never goes. */
const TOWN_SIDE = new Set(['haggler', 'insider', 'master_smith', 'appraiser']);

/**
 * The bot is handed the whole floor layout and never needs to see, so carried
 * light is invisible to it. Reporting the zero it measures would be a statement
 * about the harness rather than about the Lantern Wick.
 */
const BLIND_SPOT = new Set(['lantern']);

const POLICY: Partial<Policy> = { parrySkill: 0.55, drinkAt: 0.6, fleeAt: 0.45 };

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

interface Score {
  depth: number;
  survived: number;
  banked: number;
  renown: number;
}

function score(reports: RunReport[]): Score {
  return {
    depth: avg(reports.map((r) => r.deepest)),
    survived: reports.filter((r) => r.outcome === 'extracted').length / reports.length,
    banked: avg(reports.map((r) => r.gold + r.valueKept)),
    renown: avg(reports.map((r) => r.renown)),
  };
}

function run(meta: MetaLevels): Score {
  // The deep kit, not a mid one. A character that only reaches depth 2 cannot
  // show what Pack Mule is worth, because it never fills a pack — measuring
  // it there says "nothing happens".
  const kit = LADDER.find((l) => l.depth === 6)!.make;
  return score(playtest({ runs: RUNS, seed: SEED, prepare: geared(kit, meta), policy: POLICY }));
}

it('what each upgrade is worth', () => {
  const L: string[] = [
    `--- marginal value of each Warden upgrade (${RUNS} seeds each, same seeds throughout) ---`,
    'Mid-depth kit, careful policy. Each upgrade maxed ALONE against no upgrades at all.',
    'depth = average deepest floor, out = share of runs that came home, banked = gold + kept item value.',
    '',
  ];
  const base = run({});
  L.push(`baseline (no upgrades):  depth ${base.depth.toFixed(2)}  out ${(base.survived * 100).toFixed(0)}%  banked ${base.banked.toFixed(0)}g  renown ${base.renown.toFixed(1)}`);
  L.push('');
  // No composite score. An earlier version mixed depth, survival and haul into
  // one "worth" number, and it ranked the old Supply Crate WORST in the tree —
  // because healing takes the bot deeper, and going deeper is how it dies. That is a
  // property of a policy that pushes until it dies, not of the upgrade. Raw
  // deltas, read with judgement, and the survival column read with suspicion.
  L.push('upgrade          cost   depth      out      banked    depth/100rn   g/renown');
  for (const u of META_UPGRADES) {
    const cost = u.costs.reduce((a, b) => a + b, 0);
    if (TOWN_SIDE.has(u.id)) {
      L.push(`${u.id.padEnd(15)} ${String(cost).padStart(4)}   UNMEASURED — its whole effect is in town, and the bot never goes`);
      continue;
    }
    if (BLIND_SPOT.has(u.id)) {
      L.push(`${u.id.padEnd(15)} ${String(cost).padStart(4)}   UNMEASURED — the bot is given the floor layout, so light buys it nothing`);
      continue;
    }
    const maxed: MetaLevels = { [u.id]: u.costs.length };
    const s = run(maxed);
    const dDepth = s.depth - base.depth;
    const dOut = (s.survived - base.survived) * 100;
    const dBank = s.banked - base.banked;
    L.push(
      `${u.id.padEnd(15)} ${String(cost).padStart(4)}   ${dDepth >= 0 ? '+' : ''}${dDepth.toFixed(2)}    ${dOut >= 0 ? '+' : ''}${dOut.toFixed(0)}%    ${dBank >= 0 ? '+' : ''}${dBank.toFixed(0)}g      ${(dDepth / cost * 100).toFixed(2)}   ${(dBank / cost).toFixed(1)}`,
    );
  }
  L.push('');
  L.push('');
  L.push('NOTE on "banked": 24 runs cannot resolve an economic upgrade. A single Epic drop');
  L.push('swings the haul by hundreds of gold, which swamps a ten-percent effect. For the');
  L.push('loot upgrades, `npm run find` asks the drop tables directly over 60 deterministic');
  L.push('seeds and is the measurement to trust; this column is only a sanity check.');
  L.push('');
  L.push('NOTE on the "out" column: more resources take this bot deeper, and deeper is');
  L.push('where it dies. A negative survival delta next to a positive depth delta means');
  L.push('the upgrade worked, not that it hurt.');
  L.push('');
  L.push(`whole tree: ${META_UPGRADES.reduce((sum, u) => sum + u.costs.reduce((a, b) => a + b, 0), 0)} renown`);
  writeFileSync(process.env.OUT ?? 'upgrades.txt', L.join('\n') + '\n');
});
