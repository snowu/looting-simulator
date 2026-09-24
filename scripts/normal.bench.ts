/*
 * The entry point for `npm run playtest:normal`.
 *
 * `npm run playtest` asks whether Hard is fair. This one asks whether Normal is
 * gentle, which is a different question with a different player behind it:
 * someone who never learns to parry, drinks early and walks home while it's
 * going well. Every profile plays the same seeds on Hard and on Normal, so the
 * gap between the two blocks is the difficulty setting and nothing else.
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { LADDER } from './tables';
import { playtest, summarise, geared, MID_META, DEEP_META, Policy } from './playtest';
import { DifficultyId } from '../src/data/difficulty';
import { GameState } from '../src/state/game-state';

const OUT = process.env.PLAYTEST_OUT ?? 'playtest-normal.txt';
const RUNS = Number(process.env.PLAYTEST_RUNS ?? 24);

/** Never parries on purpose, drinks early, leaves while it still can. */
const GENTLE: Partial<Policy> = { parrySkill: 0.1, drinkAt: 0.6, fleeAt: 0.4 };

it('normal report', () => {
  const parts: string[] = [];
  const gearAt = (d: number) => LADDER.find((l) => l.depth === d)!.make;
  const profiles: [string, number, Partial<Policy>, ((s: GameState) => void) | undefined][] = [
    ['fresh character, no parry', 1000, { parrySkill: 0 }, undefined],
    ['fresh character, gentle', 1000, GENTLE, undefined],
    ['iron Rare kit, gentle', 9000, GENTLE, geared(gearAt(4), MID_META)],
    ['moonsilver Epic kit, gentle, seeks the King', 21000, { ...GENTLE, fleeAt: 0.3, fightBoss: true }, geared(gearAt(6), DEEP_META)],
  ];
  for (const [name, seed, policy, prepare] of profiles) {
    for (const difficulty of ['hard', 'normal'] as DifficultyId[]) {
      parts.push(summarise(playtest({ runs: RUNS, seed, policy, prepare, difficulty }), `${difficulty}: ${name}`), '');
    }
  }
  writeFileSync(OUT, parts.join('\n') + '\n');
});
