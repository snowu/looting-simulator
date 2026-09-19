/**
 * Elite traits: an ordinary monster, promoted.
 *
 * Twenty-seven monsters share four behaviours, so most fights ask the same
 * question. A trait is a second question layered on a body you already know
 * how to fight: a Hasted Skeleton is still a skeleton, but its wind-up no
 * longer gives you the time you are used to.
 *
 * Every trait has to be *seen* before it matters. An elite throws light in its
 * trait's colour, pulses in it, stands a little larger, and carries the trait in
 * its name on the target bar. Nothing here is a hidden die.
 *
 * Rolled after generation on its own hashed stream (`elite:<floor>:<enemy>`),
 * so promoting a monster never moves a wall, a chest or another monster. The
 * trait lives on `EnemyState.elite`, and **absent means ordinary**, so a floor
 * generated before elites existed stays exactly as it was.
 */
import { createRng, hashString } from '../core/rng';
import type { EnemyDef } from '../types';

export type EliteTrait = 'hasted' | 'ironhide' | 'frenzied' | 'vengeful' | 'thieving';

export interface EliteDef {
  id: EliteTrait;
  /** Prefix on the monster's name: "Hasted Skeleton". */
  name: string;
  /** The colour it glows and pulses in: the tell you read across a room. */
  color: string;
  /** Plain words, for the codex and tooltips. */
  rule: string;
  weight: number;
}

export const ELITES: Record<EliteTrait, EliteDef> = {
  hasted: {
    id: 'hasted', name: 'Hasted', color: '#f0e070', weight: 3,
    rule: 'Winds up, recovers and walks far faster. The timing you learned is wrong.',
  },
  ironhide: {
    id: 'ironhide', name: 'Ironhide', color: '#a8bccc', weight: 3,
    rule: 'Much harder armour and a deeper health bar, but slow on its feet.',
  },
  frenzied: {
    id: 'frenzied', name: 'Frenzied', color: '#ff5a40', weight: 3,
    rule: 'Below half health it swings and moves much faster. Finish it, or step back.',
  },
  vengeful: {
    id: 'vengeful', name: 'Vengeful', color: '#c070ff', weight: 2,
    rule: 'Bursts a moment after it dies, striking the tiles around its body. Step away from the corpse.',
  },
  thieving: {
    id: 'thieving', name: 'Thieving', color: '#e8c060', weight: 2,
    rule: 'A blow that gets through steals from your pack, and it runs, slowed by the loot. Kill it to take the item back.',
  },
};

/** Health on top of the depth curve. An elite should be a longer fight, not a coin flip. */
export const ELITE_HP_MULT = 1.5;
/** Ironhide's extra health and armour, on top of `ELITE_HP_MULT`. */
export const IRONHIDE_HP_MULT = 1.25;
export const IRONHIDE_DEFENSE_MULT = 1.6;
export const IRONHIDE_STEP_MULT = 1.3;
/** Hasted timing: wind-up, recovery and step all shrink. */
export const HASTED_WINDUP_MULT = 0.75;
export const HASTED_RECOVERY_MULT = 0.75;
export const HASTED_STEP_MULT = 0.7;
/** Frenzied timing once it is below `FRENZY_AT` of its health. */
export const FRENZY_AT = 0.5;
export const FRENZIED_WINDUP_MULT = 0.7;
export const FRENZIED_RECOVERY_MULT = 0.6;
export const FRENZIED_STEP_MULT = 0.8;
/** Seconds between a Vengeful elite dying and its burst. */
export const VENGEFUL_FUSE = 1.0;
/** Burst damage as a multiple of the monster's own blow. */
export const VENGEFUL_DAMAGE_MULT = 1.5;

/** Seconds a thief carrying your things must spend out of your sight to get away with them. */
export const THIEF_ESCAPE = 30;
/** A thief carrying loot steps this much slower: you are faster, and the chase is yours to win. */
export const THIEF_LADEN = 1.25;
/** After a step in your sight, the chance it stops to clutch the loot, and for how long. */
export const THIEF_FUMBLE_CHANCE = 0.12;
export const THIEF_FUMBLE = 0.7;
/** Out of your sight it goes to ground: one creeping step every this many seconds. */
export const THIEF_CREEP = 1.5;
/** Every this many steps, a coin or two spills from its purse, up to this many times. */
export const THIEF_TRAIL_EVERY = 3;
export const THIEF_TRAIL_MAX = 6;

/** What an elite pays over an ordinary kill of its kind. */
export const ELITE_GOLD_MULT = 2.5;
export const ELITE_ITEM_MULT = 3;
export const ELITE_MATERIAL_MULT = 1.5;

/**
 * The base chance an ordinary spawn is promoted, with no Oath or Seal asking
 * for more. Nothing on the first two floors, so the opening stays the clean
 * authored game; from depth 3 it climbs by two points a floor.
 * D3 5%, D4 7%, D5 9%, D6 11%.
 */
export function eliteChance(depth: number): number {
  return depth < 3 ? 0 : 0.03 + 0.02 * (depth - 2);
}

/** Traits this monster can carry. A bolt cannot pick a pocket; a thief is already a thief. */
export function eligibleTraits(def: EnemyDef): EliteTrait[] {
  if (def.behavior === 'boss') return [];
  return (Object.keys(ELITES) as EliteTrait[]).filter((t) =>
    t !== 'thieving' || (def.behavior !== 'ranged' && !def.thief));
}

/**
 * Whether the monster `enemyId` on the floor with seed `floorSeed` is promoted,
 * and to what. Deterministic, and on its own stream: the same floor always has
 * the same elites, and asking never draws from the generator.
 */
export function eliteFor(floorSeed: number, enemyId: string, depth: number, def: EnemyDef, bonus = 0): EliteTrait | null {
  const traits = eligibleTraits(def);
  if (!traits.length) return null;
  const rng = createRng(hashString(`elite:${floorSeed}:${enemyId}`));
  if (!rng.chance(Math.min(1, eliteChance(depth) + bonus))) return null;
  return rng.weighted(traits.map((t) => [t, ELITES[t].weight] as const));
}
