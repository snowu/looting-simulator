import { Rarity, Stats } from '../types';

/**
 * Bespoke legendaries.
 *
 * A Legendary roll does not become a Rare with four affixes any more — it
 * becomes one of these. Each is a fixed base in a fixed material with one
 * effect that hooks a system the game already runs, so the rarest thing you
 * can find changes how you play rather than just how big the numbers are.
 *
 * They still take two ordinary affixes for texture, and they still arrive
 * unidentified, so the name lands at the appraiser rather than in a corridor.
 */
export type UniqueEffectId =
  /** The edge never dulls: this item is outside the durability system. */
  | 'never_dulls'
  /** Each parry stacks damage onto the next blows; an unblocked hit clears it. */
  | 'parry_feed'
  /** Hits the dead harder than the living. */
  | 'undead_bane'
  /** A parried melee blow is dealt straight back at whatever threw it. */
  | 'parry_reflect'
  /** Carries a wider light than a lamp of its size has any right to. */
  | 'lantern'
  /** Every source of healing works at half strength while it is worn. */
  | 'half_healing'
  /** Reads the floor for traps further ahead. */
  | 'trap_sense'
  /** Breath comes back faster. */
  | 'swift_stamina'
  /** The floor notices you later than it should. */
  | 'unseen'
  /** Kills sometimes leave a second morsel. The toe knows where the meat is. */
  | 'butcher'
  /** Attack builds with every consecutive blow landed, and is lost when one lands on you. */
  | 'charge'
  /** Everything you do is faster: swing, recovery, step and flask. */
  | 'haste';

export interface UniqueDef {
  id: string;
  name: string;
  /**
   * Gear is worn and rolls like equipment; a tonic is drunk and lasts the rest
   * of the delve. Both are Legendary, both are found-only, and both belong in
   * the same codex — which is the whole reason they share a table.
   */
  kind: 'gear' | 'tonic';
  /** An ITEM_BASES id for gear, a CONSUMABLES id for a tonic. */
  baseId: string;
  /** Gear only: the material it is always made of. */
  materialId?: string;
  effect: UniqueEffectId;
  /** The single number the effect needs, read differently by each effect. */
  power: number;
  /**
   * What the effect does, said plainly and a little mysteriously. This is what
   * a tooltip shows by default.
   */
  rule: string;
  /**
   * The same effect with every number in it, shown when the reader asks for it
   * — Shift on a keyboard, a tap on the tooltip under a finger. Both registers
   * are deliberate: one is for atmosphere, one is for deciding what to wear.
   * Every figure quoted here is locked to its constant by uniques.test.ts.
   */
  detail: string;
  /** Why it is the way it is. Shown below the rule, in italics.  */
  flavour: string;
  /** Fixed bonus on top of the base × material roll. */
  stats?: Partial<Stats>;
  /** Shallowest depth the dungeon will hand it out at. */
  minDepth: number;
  /**
   * A strange floor this relic comes from **and nowhere else** — the quirk id
   * from `src/data/quirks.ts`. Absent means the ordinary Legendary pool.
   *
   * A relic locked this way is kept out of `pickUnique` entirely, so it cannot
   * arrive from a chest, a King, or anything else that rolls a Legendary. The
   * only way to hold it is to find the floor, which is the point: it is the
   * souvenir, and a souvenir you can buy is not one.
   */
  only?: string;
}

export const UNIQUES: UniqueDef[] = [
  {
    id: 'big_toe',
    name: 'The Big Toe',
    kind: 'gear',
    baseId: 'big_toe',
    materialId: 'wyrm_bone',
    effect: 'butcher',
    power: 0.17,
    rule: 'What it kills, it tenderises. Some of them leave more behind than they should.',
    detail: 'A 17% chance on each kill of a second morsel dropping. Rolls per kill, and stacks with nothing — the toe is the only thing in the game that does this. +6 Attack over its base.',
    flavour: 'Nobody has ever established whose. The prevailing theory at the Bleakmere forge is that it is better not to, and that whatever it came off is probably still down there, limping.',
    stats: { attack: 6 },
    minDepth: 2,
  },
  {
    id: 'prize_horn',
    name: "The Prize Bull's Horn",
    kind: 'gear',
    baseId: 'prize_horn',
    materialId: 'wyrm_bone',
    effect: 'charge',
    power: 4,
    only: 'pasture',
    rule: 'It gathers as long as you keep going forward. Anything that lands on you puts it back to nothing.',
    detail: '+4 Attack for each consecutive blow you land without being hit, to a maximum of 6 — +24 Attack at full charge. Any damage you take clears it outright, including a blow you blocked. Keeps the spear reach of 2 tiles.',
    flavour: 'First prize, several years running, in a competition nobody down here remembers holding. It was still warm when you took it.',
    stats: { attack: 4 },
    minDepth: 2,
  },
  {
    id: 'impresario_cane',
    name: "The Impresario's Cane",
    kind: 'gear',
    baseId: 'cane',
    materialId: 'deep_yew',
    effect: 'haste',
    power: 0.92,
    only: 'silent',
    rule: 'Everything you do, you do a little sooner than you meant to.',
    detail: 'Wind-up, recovery, walking and drinking all take 92% as long — about 8.7% faster at everything. It is a cane: the Attack on it is a fraction of any real weapon at its depth, and that is the whole trade.',
    flavour: 'He kept the time, and the time kept him. When the reel ran out they found the cane on the stage and nothing else, still going a quarter faster than the room.',
    stats: { attack: 4, speed: 6 },
    minDepth: 3,
  },
  {
    id: 'ordinary_sword',
    name: 'An Entirely Ordinary Sword',
    kind: 'gear',
    baseId: 'long_sword',
    materialId: 'star_iron',
    effect: 'never_dulls',
    power: 0,
    rule: 'Never dulls. No blow wears it, and no smith can charge you to mend it.',
    detail: '0 durability lost per blow — it has no durability pool at all, so it can never break and never needs mending. +8 Attack over its base.',
    flavour: 'No runes. No name-day. It was sharpened exactly once, by somebody who knew how, and that it fell out of the sky is beside the point.',
    stats: { attack: 8 },
    minDepth: 5,
  },
  {
    id: 'implication',
    name: 'The Implication',
    kind: 'gear',
    baseId: 'dagger',
    materialId: 'moonsilver',
    effect: 'parry_feed',
    power: 0.25,
    rule: 'Every blow you turn aside feeds it. Take one on the chin and it starts again from nothing.',
    detail: '+25% damage per parry, stacking to 3 (+75% at the top). An unblocked hit resets the stack to 0; a blocked one keeps it.',
    flavour: 'It does not have to do anything. It only has to be out, and level, and pointed at the part of you that is listening.',
    stats: { attack: 4, luck: 6 },
    minDepth: 4,
  },
  {
    id: 'champion_of_the_sun',
    name: 'Champion of the Sun',
    kind: 'gear',
    baseId: 'mace',
    materialId: 'silver',
    effect: 'undead_bane',
    power: 1.7,
    rule: 'It hates the dead, and the dead can tell.',
    detail: 'x1.7 damage (+70%) against anything undead — skeletons, ghouls, wraiths and the Ashen King. No effect whatsoever on the living.',
    flavour: 'Fighter of the night, champion of the sun. The Ossuary has not seen one in four hundred years and does not care for the reminder.',
    stats: { attack: 6, holy: 5 },
    minDepth: 3,
  },
  {
    id: 'riggs_answer',
    name: "Riggs' Answer",
    kind: 'gear',
    baseId: 'kite_shield',
    materialId: 'moonsilver',
    effect: 'parry_reflect',
    power: 1,
    rule: 'A blow turned aside is a blow given back.',
    detail: 'A parried melee attack deals 100% of the attacker\'s own attack straight back into it, at its own damage type and subject to its own resists — on top of the 1s parry stun and the x2 vulnerability that follows.',
    flavour: 'Sir Riggs died hard, at length, and loudly. Every dent in the face of this shield has a matching one in something else.',
    stats: { defense: 5, block: 8 },
    minDepth: 4,
  },
  {
    id: 'bright_error',
    name: "Bergholt's Bright Error",
    kind: 'gear',
    baseId: 'buckler',
    materialId: 'gold',
    effect: 'lantern',
    power: 4,
    rule: 'A superb lamp. A deeply regrettable shield.',
    detail: '+4 light radius, taking your lamp from 9.5 to 13.5 before any Lantern Wick. -42 Block %, which leaves it absorbing 7-15% where a plain gold buckler takes 45%.',
    flavour: 'Commissioned as a shield with a lamp bracket. Delivered as a lamp with a shield bracket. The commission was not repeated.',
    // Deep enough that a buckler's own 35-45 Block comes out near nothing: the
    // rule says it is a lamp, and the numbers have to agree with the rule.
    stats: { block: -42, defense: -1, find: 8 },
    minDepth: 3,
  },
  {
    id: 'eulogy_plate',
    name: 'Eulogy Plate',
    kind: 'gear',
    baseId: 'plate',
    materialId: 'star_iron',
    effect: 'half_healing',
    power: 0.5,
    rule: 'Nothing gets through it. Nothing much gets in, either.',
    detail: '+14 Defense and +20 Health on top of star-iron plate. All healing at x0.5 — draughts, shrines and life leech alike.',
    flavour: 'Sealed for the lying-in-state and never opened again. Whatever is being kept out is also being kept in.',
    stats: { defense: 14, health: 20 },
    minDepth: 6,
  },
  {
    id: 'charlie_work',
    name: 'Charlie Work',
    kind: 'gear',
    baseId: 'band',
    materialId: 'silver',
    effect: 'trap_sense',
    power: 2,
    rule: 'It pulls, very slightly, toward the wrong flagstone.',
    detail: '+2 tiles of trap spotting: plates, pits and wards read 4 tiles ahead down a clear line instead of 2.',
    flavour: 'Worn by whoever got sent down to deal with the rats, the damp and the holes. Nobody thanked him. Nobody had to go down twice.',
    stats: { luck: 4, find: 10 },
    minDepth: 3,
  },
  {
    id: 'fight_milk',
    name: 'Fight Milk',
    kind: 'tonic',
    baseId: 'fight_milk',
    effect: 'swift_stamina',
    power: 1.7,
    rule: 'Infused, not drunk: it lasts the delve. You come back quicker and have less to come back with.',
    detail: 'Flask infusion, installed at the forge: stamina regeneration x1.7 (22/s to 37.4/s) and -20 maximum stamina, always on from delve entry. Sips heal 10 points less while it is in. The bottle is consumed, never drunk.',
    flavour: "Crow's egg, goat milk, and something the distiller declined to name. The unofficial drink of bodyguards, brewed by bodyguards, and it shows.",
    minDepth: 3,
  },
  {
    id: 'kitten_mittens',
    name: 'Kitten Mittens',
    kind: 'gear',
    baseId: 'gloves',
    materialId: 'shadow_silk',
    effect: 'unseen',
    power: 2,
    rule: 'The floor notices you late.',
    detail: '-2 tiles from every creature\'s sight radius: a skeleton that sees 7 tiles notices you at 5. The Hunted curse adds 3 back.',
    flavour: 'Shadow silk, stitched for a burglar\'s soft tread. The maker swore blind they were for muffling cats.',
    stats: { defense: 3, shadow: 4 },
    minDepth: 3,
  },
];

/** The relics a Legendary equipment roll can turn into. Tonics are not worn. */
export const GEAR_UNIQUES: UniqueDef[] = UNIQUES.filter((u) => u.kind === 'gear');

/**
 * The gear relics an ordinary Legendary roll may become: everything except the
 * ones locked to a strange floor.
 */
export const ROLLABLE_UNIQUES: UniqueDef[] = GEAR_UNIQUES.filter((u) => !u.only);

/** The relic a strange floor hands out, if it has one. */
export function uniqueForQuirk(quirk: string): UniqueDef | undefined {
  return GEAR_UNIQUES.find((u) => u.only === quirk);
}

const BY_ID = new Map(UNIQUES.map((u) => [u.id, u]));
const BY_BASE = new Map(UNIQUES.filter((u) => u.kind === 'tonic').map((u) => [u.baseId, u]));

/** The relic a consumable id names, if that consumable is one. */
export function tonicUnique(consumableId: string): UniqueDef | undefined {
  return BY_BASE.get(consumableId);
}

export function findUnique(id: string | undefined): UniqueDef | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Uniques are Legendary by definition; stated once so callers never guess. */
export const UNIQUE_RARITY = Rarity.Legendary;
