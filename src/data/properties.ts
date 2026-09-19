/**
 * Build properties: a small, curated set of effects that change how a combat
 * verb plays rather than adding to a total. Two that interact make a build
 * you can name, a "riposte build" or a "retrieval build", which is the point:
 * an item with eleven more Attack is not a build.
 *
 * You **learn** a property (Delve Oaths pay them out; the dev lab grants them)
 * and then **inscribe** it onto a piece of gear at the forge's Inscribe bench.
 * One property per item, and never on a relic, which already has its own
 * effect. Learning is permanent; inscribing costs gold and can be redone.
 *
 * Every number in `detail` is one of the constants below, so a tooltip never
 * lies about the rule.
 */
import type { Slot } from '../types';

export type PropertyId = 'riposte' | 'execution' | 'kindling' | 'bulwark' | 'retrieval' | 'last_flask';

export interface PropertyDef {
  id: PropertyId;
  name: string;
  /** Which kinds of gear can carry it. */
  slots: Slot[];
  /** Plain words: what a tooltip shows by default. */
  rule: string;
  /** The same effect with its numbers, shown on Shift or a tap. */
  detail: string;
  /** The colour it is written in. */
  color: string;
}

/** Riposte: after a parry, the next swing within this long is free and harder. */
export const RIPOSTE_WINDOW = 2;
export const RIPOSTE_MULT = 1.3;
/** Execution: a reeling monster's kill refunds this many times the usual sigil cooldown (still capped). */
export const EXECUTION_REFUND_MULT = 2;
/** Kindling: below this share of its health, a target's fire spreads to one neighbour. */
export const KINDLING_AT = 0.5;
/** Kindling: the share of the blow's fire damage that spreads. */
export const KINDLING_SPREAD = 1;
/** Bulwark: a block that soaks at least this share of your max health charges the next strike. */
export const BULWARK_SOAK = 0.1;
export const BULWARK_WINDOW = 3;
export const BULWARK_MULT = 1.5;
/** Retrieval: a called-back shaft cuts what it passes through for this share of a throw. */
export const RETRIEVAL_MULT = 0.5;
/** Last Flask: with the flask empty, food and leech heal this much more. */
export const LAST_FLASK_MULT = 1.5;

/** Gold to inscribe a property onto an item. Redoing it costs the same. */
export const INSCRIBE_COST = 150;

const ARMOUR: Slot[] = ['head', 'body', 'hands'];

export const PROPERTIES: Record<PropertyId, PropertyDef> = {
  riposte: {
    id: 'riposte', name: 'Riposte', slots: ['weapon'], color: '#ffe8a0',
    rule: 'After a parry, your next swing is free and strikes harder.',
    detail: `After a parry, your next swing within ${RIPOSTE_WINDOW}s costs no stamina and deals ×${RIPOSTE_MULT}.`,
  },
  execution: {
    id: 'execution', name: 'Execution', slots: ['weapon'], color: '#c8a0ff',
    rule: 'Finishing a reeling foe feeds your sigil twice over.',
    detail: `Killing a monster that is reeling (parried, knocked out) refunds ×${EXECUTION_REFUND_MULT} the usual sigil cooldown, within the usual cap.`,
  },
  kindling: {
    id: 'kindling', name: 'Kindling', slots: ['weapon'], color: '#ff9a50',
    rule: 'Your fire leaps from a wounded foe to one beside it.',
    detail: `When a blow with fire damage lands on a monster below ${KINDLING_AT * 100}% health, its fire share also burns one adjacent monster.`,
  },
  bulwark: {
    id: 'bulwark', name: 'Bulwark', slots: ['offhand'], color: '#a8bccc',
    rule: 'Taking a heavy blow on the shield charges your next strike.',
    detail: `A block that soaks at least ${BULWARK_SOAK * 100}% of your max health makes your next strike within ${BULWARK_WINDOW}s deal ×${BULWARK_MULT}.`,
  },
  retrieval: {
    id: 'retrieval', name: 'Retrieval', slots: ['thrown'], color: '#9ad8c8',
    rule: 'Shafts you call back cut what they pass through.',
    detail: `Called-back shafts hit each monster they pass through once, for ${RETRIEVAL_MULT * 100}% of a throw.`,
  },
  last_flask: {
    id: 'last_flask', name: 'Last Flask', slots: ARMOUR, color: '#e07a7a',
    rule: 'With the flask empty, food and leeching heal more.',
    detail: `While your flask has no charges, morsels and life leech heal ×${LAST_FLASK_MULT}.`,
  },
};

export const PROPERTY_IDS = Object.keys(PROPERTIES) as PropertyId[];

export function findProperty(id: string | undefined | null): PropertyDef | undefined {
  return id ? PROPERTIES[id as PropertyId] : undefined;
}
