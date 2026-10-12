/*
 * The entry point for `npm run playtest:battlemage`.
 *
 * The question docs/NEXT.md §4 step 4 asks: what does carrying a conduit, and
 * casting from it, actually do to a delve? Every profile here is the same
 * careful bot on the same seeds in the depth-4 kit (iron war axe, Rare iron
 * armour, renown at MID_META), so the only thing that differs between two
 * blocks is what is in the bot's hands:
 *
 *   shield      the kit as the ladder has it, a kite shield in the offhand
 *   rod, idle   the shield swapped for a Rod, never cast: what the swap costs
 *   rod         the same Rod, cast: Ember Bolt, Smite and Hex loaded
 *   wand        a Wand instead, cast: Ember Bolt and Hex
 *   stave       a Stave in both hands instead of axe and shield, all four loaded
 *   payoffs     the casting Rod inscribed with Countercharm, and gloves with
 *               Requiem: what the battlemage's two properties are worth
 *
 * "rod, idle" against "shield" is the price of the offhand; "rod" against
 * "rod, idle" is what the spells buy back. A battlemage is in a good place
 * when "rod" sits close to "shield": a different way to play, not a better or
 * worse one. Static per-cast numbers are in `npm run tables` (spells).
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { LADDER } from './tables';
import { playtest, summarise, MID_META, Policy } from './playtest';
import { GameState } from '../src/state/game-state';
import { makeEquipment } from '../src/systems/items';
import { ConduitSpellId } from '../src/data/conduit-spells';
import { Equipment } from '../src/systems/player';
import { Rarity } from '../src/types';

const OUT = process.env.PLAYTEST_OUT ?? 'playtest-battlemage.txt';
const RUNS = Number(process.env.PLAYTEST_RUNS ?? 24);
const SEED = 21000;

/** The careful bot from balance.bench.ts, so these blocks compare with its. */
const CAREFUL: Partial<Policy> = { parrySkill: 0.55, drinkAt: 0.6, fleeAt: 0.45 };

const kit = LADDER.find((l) => l.depth === 4)!.make;

function battlemage(hands: (e: Equipment) => void, spells: ConduitSpellId[]): (s: GameState) => void {
  return (s) => {
    const e = kit();
    hands(e);
    s.equipment = e;
    s.meta = { ...MID_META };
    s.spellbook = [...spells];
    s.loadedSpells = [...spells];
  };
}

const rod = (e: Equipment) => { e.offhand = makeEquipment({ baseId: 'rod', materialId: 'iron', rarity: Rarity.Uncommon, ilvl: 9 }); };
const wand = (e: Equipment) => { e.offhand = makeEquipment({ baseId: 'wand', materialId: 'yew', rarity: Rarity.Uncommon, ilvl: 9 }); };
const payoffs = (e: Equipment) => {
  rod(e);
  e.offhand!.property = 'countercharm';
  e.hands = makeEquipment({ baseId: 'gloves', materialId: 'leather', rarity: Rarity.Common, ilvl: 9 });
  e.hands.property = 'requiem';
};
const stave = (e: Equipment) => {
  e.weapon = makeEquipment({ baseId: 'stave', materialId: 'yew', rarity: Rarity.Rare, ilvl: 9 });
  e.offhand = null;
};

it('battlemage report', () => {
  const parts: string[] = [];
  const run = (label: string, prepare: (s: GameState) => void, cast: boolean) =>
    parts.push(summarise(playtest({ runs: RUNS, seed: SEED, prepare, policy: { ...CAREFUL, cast } }), label), '');

  run('depth-4 kit, kite shield', battlemage(() => {}, []), false);
  run('depth-4 kit, Rod, never cast', battlemage(rod, ['ember_bolt', 'smite', 'hex']), false);
  run('depth-4 kit, Rod: Ember Bolt, Smite, Hex', battlemage(rod, ['ember_bolt', 'smite', 'hex']), true);
  run('depth-4 kit, Rod with Countercharm, gloves with Requiem', battlemage(payoffs, ['ember_bolt', 'smite', 'hex']), true);
  run('depth-4 kit, Wand: Ember Bolt, Hex', battlemage(wand, ['ember_bolt', 'hex']), true);
  run('depth-4 kit, Stave (no axe, no shield): all four', battlemage(stave, ['ember_bolt', 'rime_lance', 'smite', 'hex']), true);

  writeFileSync(OUT, parts.join('\n') + '\n');
});
