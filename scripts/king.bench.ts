import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { DifficultyId } from '../src/data/difficulty';
import { LADDER } from './tables';
import { DEEP_META, ThroneReport, geared, playThrone } from './playtest';

/**
 * Can the Ashen King be beaten? The run benches never answer it: a bot has to
 * survive six floors to be asked, and then dies on the way in. This stands the
 * bot in the throne room in the depth-6 ladder kit with a perfected flask (the
 * prepared expedition's loadout) and asks the fight alone, at each skill.
 *
 * Skill is both the chance of timing a parry and the chance of stepping off
 * the line of a volley being wound up, and the bot swings only into an
 * opening (`patient`). It never steps out of a melee
 * telegraph and never turns a volley back with a parry, so read every number
 * as a floor on what a person manages, not a prediction.
 */
it('the Ashen King, alone', () => {
  const runs = Number(process.env.PLAYTEST_RUNS ?? 24);
  const deep = LADDER.find((row) => row.depth === 6)!.make;
  const equip = geared(deep, DEEP_META);
  const prepare = (state: Parameters<typeof equip>[0]) => {
    equip(state);
    state.flask = { shards: 3, potency: 4, infusion: null };
  };
  const lines: string[] = [
    '--- the Ashen King, alone: depth-6 ladder kit, perfected flask, bot in the throne room ---',
    'Skill = parry timing and volley sidestep; the bot swings only into openings. It never leaves a melee telegraph or reflects a bolt: a floor on what a person manages.',
    '',
  ];
  for (const difficulty of ['hard', 'normal'] as DifficultyId[]) {
    for (const parrySkill of [0.35, 0.55, 0.8, 1]) {
      const reports: ThroneReport[] = [];
      for (let i = 0; i < runs; i++) reports.push(playThrone(31000 + i * 7919, { parrySkill, dodgeSkill: parrySkill, patient: true, drinkAt: 0.5, fleeAt: 0 }, prepare, difficulty));
      lines.push(summariseThrone(reports, `${difficulty}, skill ${Math.round(parrySkill * 100)}%`));
    }
    lines.push('');
  }
  writeFileSync(process.env.PLAYTEST_OUT ?? 'king-report.txt', lines.join('\n') + '\n');
});

function summariseThrone(reports: ThroneReport[], label: string): string {
  const n = reports.length;
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const won = reports.filter((r) => r.won), lost = reports.filter((r) => !r.won);
  // Which of his three phases each loss ended in (KING_PHASES: 65% and 30%).
  const phase = (hp: number) => (hp > 0.65 ? 1 : hp > 0.3 ? 2 : 3);
  const reached = [1, 2, 3].map((p) => lost.filter((r) => phase(r.kingHp) === p).length);
  const killers = new Map<string, number>();
  for (const r of reports) if (r.died) killers.set(r.killedBy ?? '?', (killers.get(r.killedBy ?? '?') ?? 0) + 1);
  return [
    `${label.padEnd(18)} won ${String(won.length).padStart(2)}/${n}`,
    `time ${avg(won.map((r) => r.time)).toFixed(0)}s to win`,
    `losses end in phase 1/2/3: ${reached.join('/')}, King left at ${(avg(lost.map((r) => r.kingHp)) * 100).toFixed(0)}%`,
    `sips ${avg(reports.map((r) => r.sips)).toFixed(1)} parries ${avg(reports.map((r) => r.parries)).toFixed(1)} hits ${avg(reports.map((r) => r.hitsTaken)).toFixed(1)}`,
    `killed by ${[...killers].map(([k, c]) => `${k} x${c}`).join(', ') || '—'}`,
  ].join(' | ');
}
