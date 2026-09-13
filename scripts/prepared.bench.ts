import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { addItem } from '../src/state/inventory';
import { makeConsumable } from '../src/systems/items';
import { LADDER } from './tables';
import { DEEP_META, geared, playtest, summarise } from './playtest';

it('prepared depth-six expedition', () => {
  const heals = Number(process.env.PREP_HEALS ?? 12);
  const deep = LADDER.find((row) => row.depth === 6)!.make;
  const equip = geared(deep, DEEP_META);
  const prepare = (state: Parameters<typeof equip>[0]) => {
    equip(state);
    addItem(state.stash, makeConsumable('greater_healing', heals));
    addItem(state.stash, makeConsumable('scroll_recall', 1));
  };
  const common = {
    runs: Number(process.env.PLAYTEST_RUNS ?? 24),
    seed: 21000,
    prepare,
    policy: { parrySkill: 0.8, drinkAt: 0.6, fleeAt: 0.15, lootUrns: false, floorBudget: 45 },
  };
  const reach = playtest(common);
  const boss = playtest({ ...common, policy: { ...common.policy, fightBoss: true } });
  writeFileSync(process.env.PLAYTEST_OUT ?? '/tmp/looting-prepared-report.txt',
    summarise(reach, `reach depth six, ${heals} greater heals`) + '\n\n' +
    summarise(boss, `fight Ashen King, ${heals} greater heals`) + '\n');
});
