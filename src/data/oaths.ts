/**
 * Delve Oaths: a vow sworn in Bleakmere before you go down.
 *
 * Every delve asks the same question — how far can I safely go? An Oath gives
 * one delve a different purpose. Each has a **rule** that changes how the
 * familiar floors play, an **objective**, and a **reward**: keep the oath and
 * come home alive, and you choose one of three build properties you have not
 * learned. Failing costs you the reward and nothing else.
 *
 * Optional, always: the ordinary delve stays the clean, authored game.
 */

export type OathId = 'blood_price' | 'unbroken' | 'hunter';

export interface OathDef {
  id: OathId;
  name: string;
  /** What swearing it changes. */
  rule: string;
  /** What keeping it asks of you. */
  objective: string;
  color: string;
}

/** Blood Price: gold found in the dungeon you must bring home. */
export const BLOOD_PRICE_GOLD = 250;
/** Unbroken: the depth to reach with nothing you wear breaking, and how much faster gear wears. */
export const UNBROKEN_DEPTH = 4;
export const UNBROKEN_WEAR = 2;
/** Hunter: marked elites to kill, the depths they are placed on, and how much further monsters see. */
export const HUNTER_MARKS = 3;
export const HUNTER_DEPTHS = [2, 3, 4];
export const HUNTER_SIGHT = 2;

export const OATHS: Record<OathId, OathDef> = {
  blood_price: {
    id: 'blood_price', name: 'Blood Price', color: '#d0443a',
    rule: 'You go down cursed with Frailty (−20% maximum health), and no font will wash it off this delve.',
    objective: `Come home with at least ${BLOOD_PRICE_GOLD} gold found in the dungeon.`,
  },
  unbroken: {
    id: 'unbroken', name: 'Unbroken', color: '#a8bccc',
    rule: `Everything you wear wears ${UNBROKEN_WEAR}× as fast.`,
    objective: `Reach depth ${UNBROKEN_DEPTH} with nothing you wear breaking, then come home.`,
  },
  hunter: {
    id: 'hunter', name: 'Hunter', color: '#e8c060',
    rule: `Monsters see you ${HUNTER_SIGHT} tiles further. A marked elite waits on each of depths ${HUNTER_DEPTHS.join(', ')}.`,
    objective: `Kill all ${HUNTER_MARKS} marked elites, then come home.`,
  },
};

export const OATH_IDS = Object.keys(OATHS) as OathId[];

/** An oath in progress, on the run. */
export interface OathState {
  id: OathId;
  /** `kept` once an objective that completes mid-delve is met; `broken` once it can no longer be. */
  status: 'active' | 'kept' | 'broken';
  /** Hunter: marked elites slain. */
  marks?: number;
  /** Hunter: depths whose mark has been placed. */
  placed?: number[];
}

/** The reward waiting in town for an oath kept: choose one. */
export interface OathReward {
  oath: OathId;
  choices: string[];
}

/** Renown paid instead, when every property is already learned. */
export const OATH_FALLBACK_RENOWN = 10;

export function findOath(id: string | null | undefined): OathDef | undefined {
  return id ? OATHS[id as OathId] : undefined;
}
