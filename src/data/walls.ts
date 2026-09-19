/**
 * Cracked walls: masonry that gives.
 *
 * A cracked wall is an ordinary wall tile with a fractured face you can see,
 * and it breaks after `CRACK_BLOWS` blows. **Every weapon takes the same
 * number**, for now: a decision from 2026-09-19, to be revisited once walls
 * have been played. Breaking one is never free:
 *
 * - every blow **wears your weapon** like a landed hit, and
 * - every blow is **loud**: monsters within `CRACK_NOISE` tiles come to look,
 *   through walls.
 *
 * Three kinds, told apart by what shows in the crack:
 *
 * - **shortcut**: one tile thick, with open floor on both sides that are far
 *   apart the long way round. Breaking it only ever *adds* a route, so the
 *   floor's reachability check is unaffected.
 * - **seam**: a vein of ore glinting in the crack. Breaking it opens an alcove
 *   and spills metal ore for the depth. Any weapon breaks it in the same
 *   number of blows; whether a pick should do better is for later.
 * - **cache**: a sealed niche. Breaking it opens an alcove with a hoard rolled
 *   like a chest, and never less than `CACHE_MIN_GOLD` in coin.
 *
 * The broken tile becomes floor for good. Floors are saved whole, so a broken
 * wall stays broken across a reload with no new field beyond `Floor.cracks`.
 */

export type CrackKind = 'shortcut' | 'seam' | 'cache';

export interface Crack {
  id: string;
  x: number;
  y: number;
  kind: CrackKind;
  /** Blows landed so far. */
  hits: number;
  broken: boolean;
}

/** Blows to break any cracked wall, whatever you swing. */
export const CRACK_BLOWS = 3;
/** Every blow alerts monsters this many tiles away, through walls. */
export const CRACK_NOISE = 6;
/** Weapon wear per blow: the same as a landed hit. */
export const CRACK_WEAR = 2;

/** A shortcut must save at least this many steps over the long way round. */
export const SHORTCUT_MIN_SAVING = 12;

/** How many of each kind a floor gets. Earth floors are richer in ore. */
export function cracksFor(depth: number, biome: string): Record<CrackKind, number> {
  const earth = biome === 'mines' || biome === 'burrows';
  return {
    shortcut: 2,
    seam: 1 + (earth ? 2 : 0) + (depth >= 4 ? 1 : 0),
    cache: 1,
  };
}

/** Ore a broken seam spills. */
export const SEAM_ORE: [number, number] = [2, 4];

/** A cache always holds at least this much coin: three loud blows should never open onto nothing. */
export const CACHE_MIN_GOLD = (depth: number): number => 10 + 8 * depth;
