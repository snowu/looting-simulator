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
  | 'unseen';

export interface UniqueDef {
  id: string;
  name: string;
  baseId: string;
  materialId: string;
  effect: UniqueEffectId;
  /** The single number the effect needs, read differently by each effect. */
  power: number;
  /** What the effect does, in rules terms. Shown under the name. */
  rule: string;
  /** Why it is the way it is. Shown below the rule, in italics.  */
  flavour: string;
  /** Fixed bonus on top of the base × material roll. */
  stats?: Partial<Stats>;
  /** Shallowest depth the dungeon will hand it out at. */
  minDepth: number;
}

export const UNIQUES: UniqueDef[] = [
  {
    id: 'whetless',
    name: 'Whetless',
    baseId: 'long_sword',
    materialId: 'star_iron',
    effect: 'never_dulls',
    power: 0,
    rule: 'Never dulls. No blow wears it, and no smith can charge you for it.',
    flavour: 'Fell out of the sky already sharp. Nine hundred years of grave-work has not found the end of the edge.',
    stats: { attack: 8 },
    minDepth: 5,
  },
  {
    id: 'widows_kiss',
    name: "Widow's Kiss",
    baseId: 'dagger',
    materialId: 'moonsilver',
    effect: 'parry_feed',
    power: 0.25,
    rule: 'Every parry feeds it: +25% damage per turn aside, up to three. One unblocked hit and it starts over.',
    flavour: 'She buried four husbands and none of them saw it coming. The blade learned the habit.',
    stats: { attack: 4, luck: 6 },
    minDepth: 4,
  },
  {
    id: 'saints_burden',
    name: "Saint's Burden",
    baseId: 'mace',
    materialId: 'silver',
    effect: 'undead_bane',
    power: 1.7,
    rule: 'Deals 70% more damage to the undead.',
    flavour: 'A reliquary on a haft. Whoever is still in there does not care for the Ossuary at all.',
    stats: { attack: 6, holy: 5 },
    minDepth: 3,
  },
  {
    id: 'answerer',
    name: 'The Answerer',
    baseId: 'kite_shield',
    materialId: 'moonsilver',
    effect: 'parry_reflect',
    power: 1,
    rule: 'A parried melee blow is dealt straight back at whatever threw it, in full.',
    flavour: 'Not a shield for hiding behind. Every dent in the face has a matching one in something else.',
    stats: { defense: 5, block: 8 },
    minDepth: 4,
  },
  {
    id: 'tallow_hand',
    name: 'The Tallow Hand',
    baseId: 'buckler',
    materialId: 'gold',
    effect: 'lantern',
    power: 4,
    rule: 'Carries a far wider light — but it is a candle bracket, not a shield, and it blocks almost nothing.',
    flavour: 'A chandler guild-master had it cast for the deep vaults. He came back. His escort did not.',
    stats: { block: -28, defense: -1, find: 8 },
    minDepth: 3,
  },
  {
    id: 'ashen_mantle',
    name: 'The Ashen Mantle',
    baseId: 'plate',
    materialId: 'star_iron',
    effect: 'half_healing',
    power: 0.5,
    rule: 'The best armour in the dark — and every draught, shrine and drop of leeched blood does half as much while you wear it.',
    flavour: "The King's own coat. It kept him standing long past the point where standing was a mercy.",
    stats: { defense: 14, health: 20 },
    minDepth: 6,
  },
  {
    id: 'dowsers_band',
    name: "Dowser's Band",
    baseId: 'band',
    materialId: 'silver',
    effect: 'trap_sense',
    power: 2,
    rule: 'Reads the floor two tiles further ahead for plates, pits and wards.',
    flavour: 'It pulls very slightly toward the wrong flagstone. Wearers learn to stop arguing with it.',
    stats: { luck: 4, find: 10 },
    minDepth: 3,
  },
  {
    id: 'second_breath',
    name: 'Second Breath',
    baseId: 'gauntlets',
    materialId: 'moonsilver',
    effect: 'swift_stamina',
    power: 1.7,
    rule: 'Wind comes back 70% faster — though there is less of it to come back to.',
    flavour: 'Light enough to forget you are wearing them, right up until the third swing you should not have had.',
    stats: { stamina: -22, speed: 6, defense: 3 },
    minDepth: 4,
  },
  {
    id: 'gravewatch',
    name: 'Gravewatch',
    baseId: 'pendant',
    materialId: 'silver',
    effect: 'unseen',
    power: 2,
    rule: 'The floor notices you two tiles later than it should.',
    flavour: 'Worn by the watchmen who counted the dead and preferred the dead not to count back.',
    stats: { health: 12, shadow: 4 },
    minDepth: 3,
  },
];

const BY_ID = new Map(UNIQUES.map((u) => [u.id, u]));

export function findUnique(id: string | undefined): UniqueDef | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Uniques are Legendary by definition; stated once so callers never guess. */
export const UNIQUE_RARITY = Rarity.Legendary;
