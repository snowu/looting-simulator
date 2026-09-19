/**
 * The corpse run: what you lose when you die waits for you.
 *
 * Dying used to lose the backpack and the carried coin outright. Now they go
 * into a **grave** on the depth you fell, and the next delve that reaches that
 * depth finds your **Shade** guarding it: a hollowed version of you, carrying
 * your weapon's damage type, at that depth's strength. Kill it and you take the
 * whole pack back. Die again before you do, and the old grave is gone for good:
 * the new one takes its place.
 *
 * Only one grave at a time, and never on Hardcore, where a death ends the save.
 */
import { createRng, hashString } from '../core/rng';
import { GameState } from '../state/game-state';
import { DamageType, Item } from '../types';
import { enemyDef } from '../data/enemies';
import { EnemyState, Floor, FLOOR, createEnemy } from './dungeon';
import { DifficultyId } from '../data/difficulty';

export interface Grave {
  depth: number;
  items: Item[];
  gold: number;
  /** The damage type of the weapon you fell with, which your Shade carries. */
  damageType: DamageType;
  /** The day you fell, for the town's news. */
  day: number;
}

export const SHADE_ID = 'shade';
/** The Shade keeps at least this many steps from the arrival stair. */
export const SHADE_MIN_DISTANCE = 10;

/**
 * Dig the grave for a death. Replaces any grave not yet reclaimed: that pack
 * is gone for good. Nothing lost means no grave.
 */
export function digGrave(state: GameState, depth: number, lost: Item[], gold: number, damageType: DamageType): void {
  state.grave = lost.length || gold > 0
    ? { depth, items: lost.map((it) => ({ ...it })), gold, damageType, day: state.market.day }
    : null;
}

/**
 * Put the Shade on a freshly generated floor, if the grave is on its depth.
 * Placed on its own stream, in a free floor tile far from the arrival stair.
 * Returns the Shade, or null if there is no grave here.
 */
export function placeShade(state: GameState, floor: Floor, runSeed: number, difficulty?: DifficultyId): EnemyState | null {
  const grave = state.grave;
  if (!grave || grave.depth !== floor.depth) return null;
  const up = floor.stairs.find((s) => !s.down);
  const busy = new Set(floor.enemies.filter((e) => e.ai !== 'dead').map((e) => `${e.x},${e.y}`));
  const spots: [number, number][] = [];
  for (let y = 1; y < floor.height - 1; y++) for (let x = 1; x < floor.width - 1; x++) {
    if (floor.tiles[y * floor.width + x] !== FLOOR || busy.has(`${x},${y}`)) continue;
    if (floor.doors.some((d) => d.x === x && d.y === y) || floor.stairs.some((s) => s.x === x && s.y === y)) continue;
    if (floor.props.some((p) => p.blocking && p.x === x && p.y === y)) continue;
    if (up && Math.abs(x - up.x) + Math.abs(y - up.y) < SHADE_MIN_DISTANCE) continue;
    // Not inside the throne room: the King's fight is his own.
    if (floor.rooms.some((r) => r.role === 'throne' && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) continue;
    spots.push([x, y]);
  }
  if (!spots.length) return null;
  const rng = createRng(hashString(`grave:${runSeed}:${floor.depth}`));
  const [x, y] = rng.pick(spots);
  const shade = createEnemy(enemyDef(SHADE_ID), x, y, rng.int(0, 3), 'shade', floor.depth, difficulty);
  shade.shadeType = grave.damageType;
  floor.enemies.push(shade);
  return shade;
}
