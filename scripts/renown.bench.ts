/*
 * `npm run renown`: does going deeper pay more renown per hour?
 *
 * The same character and the same play style, told to aim for a depth and then
 * come home. Renown never changes how a run plays, so every run is priced
 * under the shipping formula and under any candidate in CANDIDATES from the
 * same results. Writes renown-report.txt.
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { renownForRun } from '../src/systems/meta';
import { DEEP_META, MID_META, Policy, RunReport, geared, playtest } from './playtest';
import { LADDER } from './tables';

type Formula = (deepest: number, extracted: boolean, boss: boolean) => number;

/** Candidates to compare against the shipping formula. */
const table = (t: Record<number, number>): Formula => (d, out, boss) =>
  !out ? Math.max(0, d - 1) : d <= 1 ? 0 : (t[d] ?? 0) + (boss ? 25 : 0);
export const CANDIDATES: Record<string, Formula> = {
  shipping: renownForRun,
  'old 2+2d': table({ 2: 6, 3: 8, 4: 10, 5: 12, 6: 14 }),
};

const gearAt = (d: number) => LADDER.find((l) => l.depth === d)!.make;
const CAREFUL: Partial<Policy> = { parrySkill: 0.55, drinkAt: 0.6, fleeAt: 0.45 };
const RUNS = Number(process.env.RENOWN_RUNS ?? 24);

function price(runs: RunReport[], f: Formula): { perRun: number; perHour: number } {
  const total = runs.reduce((n, r) => n + f(r.deepest, r.outcome === 'extracted', r.bossKilled), 0);
  const hours = runs.reduce((n, r) => n + r.time, 0) / 3600;
  return { perRun: total / runs.length, perHour: hours ? total / hours : 0 };
}

it('renown by depth', () => {
  const lines: string[] = [];
  const profiles = [
    ['iron Rare kit, careful', geared(gearAt(4), MID_META)],
    ['moonsilver Epic kit, careful', geared(gearAt(6), DEEP_META)],
  ] as const;
  for (const [name, prepare] of profiles) {
    lines.push(`=== ${name} (${RUNS} runs per target) ===`);
    lines.push(`target  out%  reached  min/run  ` + Object.keys(CANDIDATES).map((k) => `${k.padStart(10)}/run /hour`).join('  '));
    for (const target of [2, 3, 4, 5, 6]) {
      const runs = playtest({ runs: RUNS, seed: 33000, prepare, policy: { ...CAREFUL, targetDepth: target } });
      const out = runs.filter((r) => r.outcome === 'extracted').length / runs.length;
      const reached = runs.reduce((n, r) => n + r.deepest, 0) / runs.length;
      const mins = runs.reduce((n, r) => n + r.time, 0) / runs.length / 60;
      const cells = Object.values(CANDIDATES).map((f) => {
        const p = price(runs, f);
        return `${p.perRun.toFixed(1).padStart(14)} ${p.perHour.toFixed(0).padStart(5)}`;
      });
      lines.push(`D${target}     ${(out * 100).toFixed(0).padStart(3)}%  ${reached.toFixed(2)}     ${mins.toFixed(1).padStart(5)}  ${cells.join('  ')}`);
    }
    lines.push('');
  }
  writeFileSync(process.env.RENOWN_OUT ?? 'renown-report.txt', lines.join('\n'));
});
