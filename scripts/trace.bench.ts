import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { addItem } from '../src/state/inventory';
import { makeConsumable } from '../src/systems/items';
import { LADDER } from './tables';
import { playOneRun, DEFAULT_POLICY, DEEP_META, geared } from './playtest';

it('trace one run', () => {
  const trace: string[] = [];
  const prepared = process.env.TRACE_PREPARED === '1';
  const equip = geared(LADDER.find((row) => row.depth === 6)!.make, DEEP_META);
  const r = playOneRun(Number(process.env.TRACE_SEED ?? 1000),
    prepared
      ? { ...DEFAULT_POLICY, parrySkill: 0.8, drinkAt: 0.6, fleeAt: 0.15, lootUrns: false, floorBudget: 45, trace }
      : { ...DEFAULT_POLICY, trace },
    prepared ? (state) => {
      equip(state);
      addItem(state.stash, makeConsumable('greater_healing', Number(process.env.TRACE_HEALS ?? 12)));
      addItem(state.stash, makeConsumable('scroll_recall', 1));
    } : undefined);
  writeFileSync(process.env.TRACE_OUT ?? 'trace.txt', JSON.stringify(r, null, 1) + '\n' + trace.join('\n'));
});
