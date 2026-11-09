/**
 * Shared test harness: a world to fight in, a clock to run it, and monsters
 * to put in it.
 *
 * `room()` is the default. It is a hand-built, walled, empty rectangle, so a
 * combat or AI test depends on the rules it is testing and not on what the
 * floor generator happened to lay out for some seed. A change to generation
 * moves nothing here. `hard-golden.test.ts` is the one place that pins
 * generation.
 *
 * A test that needs a real floor around it (a biome law, a quirk, the rooms
 * and doors of an actual layout) builds one with `newGame` and `startRun`
 * and says why. None of the arena tests did when they moved here.
 */
import { createRng } from '../core/rng';
import { Dir, turnAround } from '../core/dir';
import { DifficultyId } from '../data/difficulty';
import { enemyDef } from '../data/enemies';
import { GameState, newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { EnemyState, FLOOR, Floor, WALL, createEnemy } from '../systems/dungeon';
import { World } from '../world/world';

export interface WorldOpts {
  seed?: number;
  /** Set before the run starts. Omitted, the new game's default (Hard) stands. */
  difficulty?: DifficultyId;
  /** Adjust the save before the run starts: equipment, flask, meta, stash. */
  prepare?: (state: GameState) => void;
}

export interface RoomOpts extends WorldOpts {
  /** Open floor across, wall excluded. */
  width?: number;
  /** Open floor deep, wall excluded. */
  height?: number;
  /** Which way the player faces from the middle of the room. */
  facing?: Dir;
}

function startWorld(opts: WorldOpts): World {
  const seed = opts.seed ?? 1;
  const state = newGame(createRng(seed));
  if (opts.difficulty) state.difficulty = opts.difficulty;
  opts.prepare?.(state);
  startRun(state, seed);
  return new World(state);
}

/** Put the player on a tile, facing `d`, with no step or turn in flight. */
export function standAt(w: World, x: number, y: number, d: Dir = w.player.facing): void {
  Object.assign(w.player, { x, y, facing: d });
  Object.assign(w.anim, { fromX: x, fromY: y, moveT: 1, turnT: 1, yaw: (d * Math.PI) / 2, yawTo: (d * Math.PI) / 2, yawFrom: (d * Math.PI) / 2 });
}

/** Empty a floor of everything that acts or blocks on its own. */
function strip(f: Floor): void {
  f.enemies = [];
  f.traps = [];
  f.props = [];
  f.pickups = [];
  f.doors = [];
  f.secrets = [];
  f.stairs = [];
  f.keys = [];
  f.torches = [];
  f.thrown = [];
  f.morsels = [];
  f.cracks = [];
  f.surfaces = [];
  delete f.quirk;
}

/**
 * A walled, empty room, `width` × `height` tiles of open floor (default 15 ×
 * 15), with the player in the middle facing `facing` (default north). No
 * monsters, props, traps, doors, stairs, surfaces or quirk: add what a test
 * needs with `spawn`.
 */
export function room(opts: RoomOpts = {}): World {
  const w = startWorld(opts);
  const f = w.floor;
  const width = opts.width ?? 15;
  const height = opts.height ?? 15;
  if (width + 2 > f.width || height + 2 > f.height) throw new Error(`room ${width}×${height} does not fit a ${f.width}×${f.height} floor`);
  strip(f);
  f.tiles.fill(WALL);
  const x0 = Math.floor((f.width - width) / 2);
  const y0 = Math.floor((f.height - height) / 2);
  for (let y = y0; y < y0 + height; y++) for (let x = x0; x < x0 + width; x++) f.tiles[y * f.width + x] = FLOOR;
  f.rooms = [{ id: 0, x: x0, y: y0, w: width, h: height, role: 'normal' }];
  standAt(w, x0 + Math.floor(width / 2), y0 + Math.floor(height / 2), opts.facing ?? Dir.N);
  return w;
}

/** Run the world for `seconds` at 60 fps, calling `each` after every tick. */
export function tick(w: World, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds; t += 1 / 60) {
    w.update(1 / 60);
    each?.();
  }
}

/** Put a monster `dist` tiles in front of the player, facing back at them. */
export function spawn(w: World, id: string, dist = 1, depth = 1): EnemyState {
  const t = w.frontTile(dist);
  return spawnAt(w, id, t.x, t.y, turnAround(w.player.facing), depth);
}

/** Put a monster on a tile. Ids are unique per world, so several may share a def. */
export function spawnAt(w: World, id: string, x: number, y: number, facing: Dir = Dir.S, depth = 1): EnemyState {
  const e = createEnemy(enemyDef(id), x, y, facing, `${id}@${x},${y}#${w.floor.enemies.length}`, depth);
  w.floor.enemies.push(e);
  return e;
}
