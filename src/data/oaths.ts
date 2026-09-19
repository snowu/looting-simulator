import { createRng, hashString } from '../core/rng';
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

export type OathId = 'blood_price' | 'dry_throat' | 'duelist' | 'kingsbane' | 'unbroken' | 'hunter' | 'silence' | 'pilgrim';

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
/** Dry Throat: the depth to reach with a flask that starts empty. */
export const DRY_THROAT_DEPTH = 4;
/** Duelist: kills to make with no guard but the parry. */
export const DUELIST_KILLS = 20;
/** Kingsbane: how much harder monsters hit. */
export const KINGSBANE_DAMAGE = 1.15;
/** Silence: the depth to reach, how much less monsters see, and how much further noise carries. */
export const SILENCE_DEPTH = 3;
export const SILENCE_SIGHT = 2;
export const SILENCE_NOISE = 2;
/** Pilgrim: shrines to pray at, and the idol's chance to curse instead of 35%. */
export const PILGRIM_PRAYERS = 3;
export const PILGRIM_IDOL_CURSE = 0.65;

export const OATHS: Record<OathId, OathDef> = {
  blood_price: {
    id: 'blood_price', name: 'Blood Price', color: '#d0443a', tier: 'hard',
    rule: 'You go down cursed with Frailty (−20% maximum health), and no font will wash it off this delve.',
    objective: `Come home with at least ${BLOOD_PRICE_GOLD} gold found in the dungeon.`,
  },
  dry_throat: {
    id: 'dry_throat', name: 'Dry Throat', color: '#c89060', tier: 'hard',
    rule: 'Your flask starts the delve empty. Fonts and dregs can still refill it.',
    objective: `Reach depth ${DRY_THROAT_DEPTH}, then come home.`,
  },
  duelist: {
    id: 'duelist', name: 'Duelist', color: '#ffe8a0', tier: 'hard',
    rule: 'Your guard is sworn away: blocking absorbs nothing. A parry still works.',
    objective: `Kill ${DUELIST_KILLS} monsters, then come home.`,
  },
  kingsbane: {
    id: 'kingsbane', name: 'Kingsbane', color: '#c080ff', tier: 'hard',
    rule: `Monsters hit ${Math.round((KINGSBANE_DAMAGE - 1) * 100)}% harder.`,
    objective: 'Kill the Ashen King, then come home.',
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
  silence: {
    id: 'silence', name: 'Silence', color: '#9ab8ff', tier: 'medium',
    rule: `Monsters see you ${SILENCE_SIGHT} tiles less, but every noise carries twice as far.`,
    objective: `Reach depth ${SILENCE_DEPTH} and come home without springing an alarm ward or casting Wardcry.`,
  },
  pilgrim: {
    id: 'pilgrim', name: 'Pilgrim', color: '#e8e0c0', tier: 'medium',
    rule: `A Hollow Idol curses you ${Math.round(PILGRIM_IDOL_CURSE * 100)}% of the time instead of 35%.`,
    objective: `Pray at ${PILGRIM_PRAYERS} shrines, then come home.`,
  },
};

/** Hard oaths first, then medium: the order the stone shows them in. */
export const OATH_IDS = (Object.keys(OATHS) as OathId[]).sort((a, b) => (OATHS[a].tier === 'hard' ? 0 : 1) - (OATHS[b].tier === 'hard' ? 0 : 1));

/** How many of each tier the stone offers on a day. */
export const OFFER: Record<OathTier, number> = { hard: 1, medium: 2 };
/** Keep every oath you swore, having sworn at least this many, and learn one more. */
export const STACK_BONUS_AT = 2;
export const STACK_BONUS = 1;

/**
 * The oaths on the stone today: one hard and two medium, drawn from the pool
 * by the playthrough and the day, so the offer turns with the days and the
 * town and the delve always agree on it.
 */
export function oathsForDay(saveId: string, day: number): OathId[] {
  const rng = createRng(hashString(`oaths:${saveId}:${day}`));
  const out: OathId[] = [];
  for (const tier of ['hard', 'medium'] as OathTier[]) {
    out.push(...rng.shuffle(OATH_IDS.filter((id) => OATHS[id].tier === tier)).slice(0, OFFER[tier]));
  }
  return out;
}

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
  /** Duelist: kills made. */
  kills?: number;
  /** Pilgrim: shrines prayed at. */
  prayers?: number;
}

/** The reward waiting in town for an oath kept: choose `picks` of the choices. */
export interface OathReward {
  /** The oaths kept. `oath` is the single one from before oaths stacked. */
  oaths?: OathId[];
  oath?: OathId;
  choices: string[];
  /** How many of the choices to learn. Absent (rewards from before tiers) means one. */
  picks?: number;
}

/** Renown paid instead by a medium oath, when every property is already learned. */
export const OATH_FALLBACK_RENOWN = OATH_FALLBACK.medium;

export function findOath(id: string | null | undefined): OathDef | undefined {
  return id ? OATHS[id as OathId] : undefined;
}
