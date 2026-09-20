/**
 * Strange floors.
 *
 * Every so often the stairs do not go where stairs go. A floor rolls a
 * **quirk**: it is generated exactly like any other floor — same shape, same
 * seed, same stairs — and then dressed as something else entirely.
 *
 * There is no key, no branch and no rumour. You find out by walking down. A
 * secret floor you can plan for is a destination; a secret floor you cannot
 * plan for is a story, and stories are the thing the run-identity work
 * (docs/NEXT.md §3) was chasing in the first place.
 *
 * ## What a quirk is allowed to touch
 *
 * The enemy roster, the lighting, the post pass, how fast time runs, the loot
 * rarity, the music, the messages.
 *
 * **Not** the floor's shape, its stairs, its seed, or anything another system
 * reads to decide what to generate. A quirk is applied *after* generation, by
 * `src/systems/quirks.ts`, and it swaps creatures on tiles that were already
 * chosen. That is what keeps the golden floor hashes meaningful and what lets
 * a save written on a strange floor open in a build that has never heard of
 * one: `Floor.quirk` is a single optional string, and everything else about
 * that floor is ordinary.
 */

export type QuirkId = 'pasture' | 'silent';

export interface QuirkDef {
  id: QuirkId;
  /** What the floor calls itself, in place of the biome name. */
  name: string;
  /** Said on arrival, once. */
  arrival: string;
  /** Said when you take the stairs out, once. */
  parting: string;
  color: string;
  /**
   * How fast the dungeon runs here: you, the monsters, the shafts in flight
   * and the torches, all together. 1 is ordinary time.
   *
   * It scales the clock, never the numbers — nothing hits harder on a fast
   * floor, it just arrives sooner, which is a different problem to solve
   * rather than a bigger one.
   */
  timeScale: number;
  /**
   * How many tiers every container on the floor is promoted by: an urn
   * becomes a chest, a chest becomes a vault.
   *
   * Promoting the containers rather than reaching into the loot tables means a
   * strange floor pays out through exactly the machinery every other floor
   * uses, with no second set of numbers to keep in step.
   */
  lootBoost: number;
  /** Shallowest and deepest floor it will dress. */
  minDepth: number;
  maxDepth: number;
  /** Relative likelihood against the other quirks, once a floor has rolled strange. */
  weight: number;
}

/**
 * The chance a fresh floor rolls strange, and what each depth past the first
 * adds. Deeper floors are likelier because by depth 4 you have something to
 * lose, and an interruption means more when it can cost you.
 *
 * Depth 1 is excluded outright — too early for a surprise to be one — and so
 * is the throne, because the throne is the throne.
 */
export const QUIRK_CHANCE = 0.05;
export const QUIRK_CHANCE_PER_DEPTH = 0.015;
export const QUIRK_MIN_DEPTH = 2;
export const QUIRK_MAX_DEPTH = 5;

export const QUIRKS: Record<QuirkId, QuirkDef> = {
  pasture: {
    id: 'pasture', name: 'The Forbidden Pasture',
    arrival: 'The stairs end in grass. The sky is underneath you.',
    parting: 'The sky lets go of your boots. Somewhere behind you, something lows.',
    color: '#9ad67a',
    // Being upside down is the tax this floor charges. Nothing here needs to
    // hit fast on top of it.
    timeScale: 1,
    lootBoost: 2,
    minDepth: 2, maxDepth: 5, weight: 1,
  },
  silent: {
    id: 'silent', name: 'The Silent Picture',
    arrival: 'The colour goes out of the walls. Somewhere, a piano starts.',
    parting: 'The piano stops mid-bar. Colour floods back in like a held breath let go.',
    color: '#d8d8d8',
    // The speed-up is the floor's entire content: a flurry at five-quarters is
    // a genuinely different problem. Damage is untouched; only time moves.
    timeScale: 1.25,
    lootBoost: 1,
    minDepth: 2, maxDepth: 5, weight: 1,
  },
};

export const QUIRK_IDS = Object.keys(QUIRKS) as QuirkId[];

export function quirkDef(id: string | undefined): QuirkDef | null {
  return (id && QUIRKS[id as QuirkId]) || null;
}

/** How fast the dungeon runs on this floor. Unknown or absent quirks run at 1. */
export function quirkTimeScale(id: string | undefined): number {
  return quirkDef(id)?.timeScale ?? 1;
}

/**
 * The Forbidden Pasture's herd. Ordinary monsters are swapped for cattle of
 * roughly their own weight class, so the floor stays as dangerous as the depth
 * it sits at — a pasture at depth 5 is a pasture full of depth-5 cows.
 */
export const PASTURE_HERD = {
  /** Anything small and quick. */
  small: 'pasture_calf',
  /** The ordinary rank and file. */
  medium: 'pasture_heifer',
  /** Anything that was already a problem. */
  large: 'pasture_bull',
} as const;

/**
 * The two health thresholds the swap matches on. Above the first, a creature
 * is replaced by something with horns; below the second, by something that has
 * not yet decided whether you are frightening.
 *
 * Matching on health rather than on a list of names is what keeps this correct
 * for monsters nobody has written yet — and it is why the rank and file (a
 * skeleton, a goblin, a spider) all come out as heifers, which is the shape the
 * floor wants.
 */
export const HERD_LARGE_HP = 60;
export const HERD_SMALL_HP = 22;
