/**
 * Ambushers: monsters that are not standing where you can see them.
 *
 * Two kinds. **Ceiling droppers** cling overhead and fall when you pass beneath
 * or beside them. **Burrowers** travel under the floor as a moving mound of
 * earth and come up next to you.
 *
 * The one rule that keeps them fair, and that nothing here may break: **an
 * ambusher never deals damage in the moment it appears.** It lands or surfaces
 * on a tile beside you and then has to wind up like anything else, with the
 * same red flash. What an ambush costs you is *position* (flanked, or with
 * something at your back), never free health.
 *
 * And both can be read. A dropper is spotted the way a trap is, by looking at
 * the tiles ahead, and an unspotted one still sifts dust and skitters for a
 * beat before it falls. A burrower is always visible as its mound. Either can
 * be struck where it hides to bring it out early, stunned and open.
 */

import { BIOMES } from './biomes';

/** Seconds from a dropper letting go to it landing: the dust-and-skitter beat. */
export const DROP_SECONDS = 0.6;
/** How close you get (tiles, Manhattan) before a dropper lets go or a buried ambusher rises. */
export const AMBUSH_TRIGGER = 1;
/** Seconds of rumble before a buried monster breaks the surface. */
export const SURFACE_SECONDS = 0.4;
/** After landing or surfacing: the beat before it may start its first wind-up. */
export const AMBUSH_BEAT = 0.5;
/** A burrowing mole spends this long under the floor, moving towards your back. */
export const BURROW_MIN = 2;
export const BURROW_MAX = 4;
/** Seconds per tile for a mound on the move. Slower than you walk: you can read it and turn. */
export const MOUND_STEP = 0.45;
/** Struck where it hides: how long it reels, open to double damage, after you drag it out. */
export const KNOCKOUT_STUN = 1.5;
/** A mole dives below this share of its health, once. */
export const DIVE_AT = 0.35;

/** Ceiling droppers per floor, by depth. None on the first floor or the throne. */
export function droppersFor(depth: number): number {
  if (depth < 2 || depth > 5) return 0;
  return depth <= 3 ? 1 : 2;
}

/** The share of Tunnel Stalkers on an earth floor that start buried. */
export const STALKER_BURIED = 0.5;

/** Biomes with floors soft enough to burrow through. */
export const EARTH_BIOMES = new Set(BIOMES.filter((b) => b.earth).map((b) => b.id));
