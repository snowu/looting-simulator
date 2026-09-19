/**
 * Biome laws: one rule per biome that you can use, not just suffer.
 *
 * A biome used to change the art, the residents and their resistances. A law
 * gives it a systemic rule and a way to turn that rule against the floor.
 * Passive damage over time would be a tax; these are all things you can
 * exploit once you know them. Arriving on a floor that has one says so.
 */

export type LawBiome = 'crypt' | 'mines' | 'burrows';

export interface LawDef {
  biome: LawBiome;
  name: string;
  /** Said in the log on arriving. */
  arrival: string;
  color: string;
}

export const LAWS: Record<LawBiome, LawDef> = {
  crypt: {
    biome: 'crypt', name: 'The dead do not stay down', color: '#e8e0c0',
    arrival: 'The Ossuary keeps its dead restless: the bones you put down will try to stand again. Shatter them, or sanctify them.',
  },
  mines: {
    biome: 'mines', name: 'Braced walls come down hard', color: '#c8a070',
    arrival: 'The Deep Mines are shored with rotten timber: bring down a cracked wall and the roof comes with it, onto whatever stands beside it.',
  },
  burrows: {
    biome: 'burrows', name: 'Noise carries', color: '#c8a070',
    arrival: 'The Vermin Burrows carry every sound a long way, and something is always listening. A broken root cache makes a fine lure.',
  },
};

export function lawFor(biome: string): LawDef | undefined {
  return LAWS[biome as LawBiome];
}

/** Ossuary: seconds after death before undead remains stir, then how long they stir before standing. */
export const OSSUARY_STIR_AFTER = 8;
export const OSSUARY_STIR = 2;
/** Ossuary: the share of health a restless corpse stands with. */
export const OSSUARY_RISE_HP = 0.5;

/** Mines: the crushing blow of a collapse on each monster beside the wall. */
export const COLLAPSE_BASE = 30;
export const COLLAPSE_PER_DEPTH = 12;
export const COLLAPSE_STUN = 1.2;

/** Burrows: every noise reaches this much further. */
export const BURROWS_NOISE_MULT = 1.75;
/** Burrows: how far a broken root cache's racket carries, drawing monsters to the cache. */
export const ROOT_CACHE_LURE = 12;
