/**
 * Elemental surfaces: what lies on the floor of a tile, and what the elements
 * do to it. docs/NEXT.md §5, MECHANICS.md "Surfaces".
 *
 * One small table, applied the same way to everything: your spells, the
 * monsters' bolts, a burning monster, a creature made of fire. Nothing here
 * knows who lit the match.
 *
 * - **Fire lights oil.** The tile burns for `FIRE_SECONDS`, and the fire
 *   walks to the oil beside it every `FIRE_SPREAD` seconds. Whatever stands
 *   in a burning tile is hurt every `FIRE_TICK`, you included.
 * - **Water puts fire out.** Fire never spreads onto it, and a burning
 *   monster that steps into it stops burning.
 * - **Frost freezes water** into ice for `ICE_THAW` seconds, and a monster
 *   standing in the water is frozen into it for `FREEZE_SECONDS`.
 * - **Fire melts ice** back into water.
 * - **Ice is treacherous.** A monster struck while it stands on ice slips and
 *   goes down for `SLIP_SECONDS`, which breaks whatever it was winding up.
 *
 * Every surface is drawn on its tile, so the setup is always readable: the
 * oil glistens before anything lights it.
 */
export type SurfaceKind = 'oil' | 'water' | 'ice' | 'fire';

export interface Surface {
  x: number;
  y: number;
  kind: SurfaceKind;
  /**
   * Fire: seconds left burning. Ice made by freezing water: seconds until it
   * thaws. Absent for a surface that stays until something changes it.
   */
  t?: number;
  /** Fire: seconds until it lights the oil beside it. Absent once it has. */
  spread?: number;
}

/** Seconds an oil tile burns before it is spent and leaves bare floor. */
export const FIRE_SECONDS = 6;
/** Seconds a burning tile takes to light the oil beside it. */
export const FIRE_SPREAD = 0.3;
/** How often a burning tile hurts what stands in it. */
export const FIRE_TICK = 0.5;
/** Fire's bite each tick, before armour: on you, and on a monster (which has no armour against it). */
export const FIRE_PLAYER_BASE = 4;
export const FIRE_PLAYER_PER_DEPTH = 2;
export const FIRE_MONSTER_BASE = 10;
export const FIRE_MONSTER_PER_DEPTH = 5;
/** Seconds frozen water stays ice before it thaws back into water. */
export const ICE_THAW = 20;
/** Seconds a monster caught in freezing water is held fast. */
export const FREEZE_SECONDS = 2.5;
/** Seconds you are held when the water you stand in freezes: shorter, because you cannot see it coming as well. */
export const PLAYER_FREEZE_SECONDS = 1;
/** Seconds a monster struck on ice is down. */
export const SLIP_SECONDS = 0.8;

/** How many pools a fresh floor is given, before the biome has its say. */
export const OIL_POOLS = 2;
export const WATER_POOLS = 1;
/** Tiles in one pool, at least and at most. */
export const POOL_MIN = 3;
export const POOL_MAX = 6;

export const SURFACE_NAMES: Record<SurfaceKind, string> = {
  oil: 'oil',
  water: 'water',
  ice: 'ice',
  fire: 'fire',
};
