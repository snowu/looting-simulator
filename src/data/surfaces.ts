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
export type SurfaceKind = 'oil' | 'water' | 'ice' | 'fire' | 'vent' | 'spores';

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
  /**
   * Ice frozen out of the Catacombs' flood rather than out of a pool: when it
   * thaws it is gone, back into the flood, instead of becoming a puddle.
   */
  flood?: boolean;
  /** Vent: seconds left of the burst's flames, for drawing. Absent between bursts. */
  burst?: number;
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

/**
 * Oil barrels: red-hooped, on most floors. Broken, one spills a pool around
 * itself; reached by fire, it bursts, lighting the spill at once and
 * scorching everything beside it.
 */
export const OIL_BARRELS = 1;
export const BARREL_SPILL = 5;
/** A burst's bite, on the barrel's tile and the four beside it: this many of fire's ticks at once. */
export const BURST_TICKS = 3;

/**
 * Biome laws on surfaces (`src/data/laws.ts`).
 *
 * The Catacombs (`flood`): frost that lands on the flood freezes every tile
 * within `FLOOD_REACH` of where it landed, and whatever stands there.
 */
export const FLOOD_REACH = 1;
/** The Frost Vault (`treacherous`): a monster that slips is open (double damage) as it goes down; you go down for this long when struck on ice. */
export const PLAYER_SLIP_SECONDS = 0.6;
/** The Emberworks (`vents`): vents per floor, seconds between bursts, the glowing warning before one, and how long its flames stand. */
export const VENTS = 4;
export const VENT_PERIOD_MIN = 7;
export const VENT_PERIOD_MAX = 11;
export const VENT_TELL = 1.2;
export const VENT_FLAMES = 0.8;
/** The Sporegrove (`spores`): patches per floor, and how long a puff blinds monsters (and dims your lamp). */
export const SPORE_PATCHES = 4;
export const SPORE_BLIND = 3;
/** Fire's ticks a spore burst bites with, and a vent's burst on its own tile. */
export const SPORE_BURST_TICKS = 2;
export const VENT_TICKS = 2;
/** Seconds burning spores burn: briefly, because they explode as they catch. */
export const SPORE_FIRE_SECONDS = 2;

export const SURFACE_NAMES: Record<SurfaceKind, string> = {
  oil: 'oil',
  water: 'water',
  ice: 'ice',
  fire: 'fire',
  vent: 'a vent',
  spores: 'spores',
};
