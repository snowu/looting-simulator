/**
 * The simulation fuzzer: the playtest bot plays real delves with random
 * inputs mixed in (`Policy.chaos`), and the invariants in invariants.ts are
 * checked after every tick. The bot is what gets it past depth 1: a random
 * walker never leaves the first floor, so the deep systems never ran.
 *
 * `npm run fuzz` runs the long version (fuzz.bench.ts); fuzz.test.ts runs a
 * short one in npm test.
 */
import { DifficultyId } from '../src/data/difficulty';
import { GameState } from '../src/state/game-state';
import { addItem } from '../src/state/inventory';
import { makeConsumable } from '../src/systems/items';
import { invariants } from './invariants';
import { DEEP_META, DEFAULT_POLICY, MID_META, Policy, geared, playOneRun } from './playtest';
import { LADDER } from './tables';

export interface FuzzProfile {
  name: string;
  policy?: Partial<Policy>;
  prepare?: (s: GameState) => void;
  difficulty?: DifficultyId;
}

const gearAt = (d: number) => LADDER.find((l) => l.depth === d)!.make;

/** Who plays: a first delve, a mid-game kit, and a deep expedition that goes straight down. */
export const FUZZ_PROFILES: FuzzProfile[] = [
  { name: 'fresh', policy: { parrySkill: 0.35 } },
  { name: 'iron kit, Normal', prepare: geared(gearAt(4), MID_META), difficulty: 'normal' },
  {
    name: 'deep expedition',
    prepare: (s) => {
      geared(gearAt(6), DEEP_META)(s);
      s.flask = { shards: 3, potency: 4, infusion: null };
      addItem(s.stash, makeConsumable('scroll_recall', 1));
    },
    policy: { parrySkill: 0.8, drinkAt: 0.6, fleeAt: 0.15, lootUrns: false, floorBudget: 45, cast: true, throw: true },
  },
];

export interface FuzzFinding {
  key: string;
  count: number;
  /** Where it was first seen, to reproduce it. */
  first: { profile: string; seed: number; chaos: number; tick: number; depth: number; detail: string };
}

export interface FuzzReport {
  runs: number;
  ticks: number;
  deepest: number;
  findings: FuzzFinding[];
  crashes: { profile: string; seed: number; chaos: number; error: string }[];
}

export interface FuzzOpts {
  profiles?: FuzzProfile[];
  seeds: number;
  seed?: number;
  chaos: number[];
  /** Check where every item is once every this many ticks (it is the slow check). */
  itemEvery?: number;
}

export function fuzz(opts: FuzzOpts): FuzzReport {
  const report: FuzzReport = { runs: 0, ticks: 0, deepest: 0, findings: [], crashes: [] };
  const byKey = new Map<string, FuzzFinding>();
  const itemEvery = opts.itemEvery ?? 30;
  for (const profile of opts.profiles ?? FUZZ_PROFILES) {
    for (const chaos of opts.chaos) {
      for (let i = 0; i < opts.seeds; i++) {
        const seed = (opts.seed ?? 4000) + i * 7919;
        const policy: Policy = {
          ...DEFAULT_POLICY, ...profile.policy, chaos,
          onTick: (w, tick) => {
            report.ticks++;
            for (const v of invariants(w, { items: tick % itemEvery === 0 })) {
              const f = byKey.get(v.key);
              if (f) f.count++;
              else byKey.set(v.key, { key: v.key, count: 1, first: { profile: profile.name, seed, chaos, tick, depth: w.run.depth, detail: v.detail } });
            }
          },
        };
        try {
          const r = playOneRun(seed, policy, profile.prepare, profile.difficulty ?? 'hard');
          report.deepest = Math.max(report.deepest, r.deepest);
        } catch (e) {
          report.crashes.push({ profile: profile.name, seed, chaos, error: String((e as Error)?.stack ?? e).split('\n').slice(0, 4).join(' | ') });
        }
        report.runs++;
      }
    }
  }
  report.findings = [...byKey.values()].sort((a, b) => b.count - a.count);
  return report;
}

export function formatFuzz(r: FuzzReport): string {
  const lines = [`${r.runs} runs, ${r.ticks} ticks (${(r.ticks / 3600).toFixed(1)} sim-minutes), deepest floor ${r.deepest}`];
  if (!r.findings.length && !r.crashes.length) lines.push('no invariant broke, nothing threw');
  for (const c of r.crashes) lines.push(`CRASH ${c.profile} seed ${c.seed} chaos ${c.chaos}: ${c.error}`);
  for (const f of r.findings) {
    const s = f.first;
    lines.push(`${f.key}: ${f.count} ticks; first ${s.profile}, seed ${s.seed}, chaos ${s.chaos}, tick ${s.tick}, depth ${s.depth}: ${s.detail}`);
  }
  return lines.join('\n') + '\n';
}
