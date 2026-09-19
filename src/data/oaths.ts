/**
 * Delve Oaths: a vow sworn in Bleakmere before you go down.
 *
 * Every delve asks the same question — how far can I safely go? An Oath gives
 * one delve a different purpose. Each has a **rule** that changes how the
 * familiar floors play, an **objective**, and a **reward**: keep the oath and
 * come home alive, and you learn build properties you do not know yet, chosen
 * from three: one for a medium oath, two for a hard one. Failing costs you the
 * reward and nothing else.
 *
 * Optional, always: the ordinary delve stays the clean, authored game.
 */

export type OathId = 'blood_price' | 'unbroken' | 'hunter';

/**
 * How hard an oath is, and so how much it pays. The shape the offer grows into
 * as the pool does: one hard oath and two medium ones on the stone.
 */
export type OathTier = 'hard' | 'medium';

export interface OathDef {
  id: OathId;
  name: string;
  tier: OathTier;
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
    id: 'blood_price', name: 'Blood Price', color: '#d0443a', tier: 'hard',
    rule: 'You go down cursed with Frailty (−20% maximum health), and no font will wash it off this delve.',
    objective: `Come home with at least ${BLOOD_PRICE_GOLD} gold found in the dungeon.`,
  },
  unbroken: {
    id: 'unbroken', name: 'Unbroken', color: '#a8bccc', tier: 'medium',
    rule: `Everything you wear wears ${UNBROKEN_WEAR}× as fast.`,
    objective: `Reach depth ${UNBROKEN_DEPTH} with nothing you wear breaking, then come home.`,
  },
  hunter: {
    id: 'hunter', name: 'Hunter', color: '#e8c060', tier: 'medium',
    rule: `Monsters see you ${HUNTER_SIGHT} tiles further. A marked elite waits on each of depths ${HUNTER_DEPTHS.join(', ')}.`,
    objective: `Kill all ${HUNTER_MARKS} marked elites, then come home.`,
  },
};

/** Hard oaths first, then medium: the order the stone shows them in. */
export const OATH_IDS = (Object.keys(OATHS) as OathId[]).sort((a, b) => (OATHS[a].tier === 'hard' ? 0 : 1) - (OATHS[b].tier === 'hard' ? 0 : 1));

/** What keeping an oath pays, by tier: inscriptions learned from the three offered, or renown once all are known. */
export const OATH_PICKS: Record<OathTier, number> = { hard: 2, medium: 1 };
export const OATH_FALLBACK: Record<OathTier, number> = { hard: 20, medium: 10 };

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

/** The reward waiting in town for an oath kept: choose `picks` of the choices. */
export interface OathReward {
  oath: OathId;
  choices: string[];
  /** How many of the choices to learn. Absent (rewards from before tiers) means one. */
  picks?: number;
}

/** Renown paid instead by a medium oath, when every property is already learned. */
export const OATH_FALLBACK_RENOWN = OATH_FALLBACK.medium;

export function findOath(id: string | null | undefined): OathDef | undefined {
  return id ? OATHS[id as OathId] : undefined;
}
