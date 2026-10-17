/*
 * The entry point for `npm run playtest:belts`.
 *
 * What does a belt of shafts do to a delve? It takes no weapon slot and pays
 * no stats, so it can be worn beside any build, and the question is whether
 * that makes it a pick every build should take. Every block here is the same
 * careful bot on the same seeds in the depth-4 kit (iron war axe, kite shield,
 * Rare iron armour, renown at MID_META); the only difference is the belt:
 *
 *   no belt     the kit as the ladder has it
 *   knives      iron Throwing Knives, thrown (`Policy.throw`)
 *   axes        iron Throwing Axes, thrown
 *   javelins    iron Javelins, thrown
 *
 * The bot throws at anything coming down a line from two tiles or more, never
 * with something already at arm's length, and holds R to call the shafts home
 * once nothing is hunting it. A belt is in a good place when it changes how a
 * fight opens without making "no belt" the wrong answer. Static per-throw
 * numbers are in `npm run tables` (weapon roster).
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { LADDER } from './tables';
import { playtest, summarise, MID_META, Policy } from './playtest';
import { GameState } from '../src/state/game-state';
import { makeEquipment } from '../src/systems/items';
import { Rarity } from '../src/types';

const OUT = process.env.PLAYTEST_OUT ?? 'playtest-belts.txt';
const RUNS = Number(process.env.PLAYTEST_RUNS ?? 24);
const SEED = 21000;

/** The careful bot from balance.bench.ts, so these blocks compare with its. */
const CAREFUL: Partial<Policy> = { parrySkill: 0.55, drinkAt: 0.6, fleeAt: 0.45 };

const kit = LADDER.find((l) => l.depth === 4)!.make;

function belted(baseId: string | null): (s: GameState) => void {
  return (s) => {
    const e = kit();
    if (baseId) e.thrown = makeEquipment({ baseId, materialId: 'iron', rarity: Rarity.Uncommon, ilvl: 9 });
    s.equipment = e;
    s.meta = { ...MID_META };
  };
}

it('belts report', () => {
  const parts: string[] = [];
  const run = (label: string, baseId: string | null) =>
    parts.push(summarise(playtest({ runs: RUNS, seed: SEED, prepare: belted(baseId), policy: { ...CAREFUL, throw: !!baseId } }), label), '');

  run('depth-4 kit, no belt', null);
  run('depth-4 kit, iron Throwing Knives', 'throwing_knives');
  run('depth-4 kit, iron Throwing Axes', 'throwing_axes');
  run('depth-4 kit, iron Javelins', 'javelins');
  writeFileSync(OUT, parts.join('\n') + '\n');
});
