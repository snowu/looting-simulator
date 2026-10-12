import { createRng, hashString, Rng } from '../core/rng';
import { DIRS, DX, DY } from '../core/dir';
import { biomeForFloor } from '../data/biomes';
import {
  FIRE_SECONDS, FIRE_SPREAD, ICE_THAW, OIL_POOLS, POOL_MAX, POOL_MIN, Surface, SurfaceKind, WATER_POOLS,
} from '../data/surfaces';
import { FLOOR, Floor, doorAt, propAt, stairsAt, stairsFront, tileAt, trapAt } from './dungeon';

/**
 * The surface layer of a floor: placement, and what the elements do to it.
 * The rules are written out in `src/data/surfaces.ts`; this is the state.
 * Effects on creatures (burning, freezing, slipping) live in the world, which
 * is the only thing that knows who is standing where.
 */

export function surfaceAt(f: Floor, x: number, y: number): Surface | undefined {
  return f.surfaces?.find((s) => s.x === x && s.y === y);
}

export function surfaceKindAt(f: Floor, x: number, y: number): SurfaceKind | undefined {
  return surfaceAt(f, x, y)?.kind;
}

export function burningAt(f: Floor, x: number, y: number): boolean {
  return surfaceKindAt(f, x, y) === 'fire';
}

/** Pools a fresh floor gets in its biome: oil, and water (which a frozen biome lays down as ice). */
export function poolsFor(f: Floor): { oil: number; water: number; ice: boolean } {
  const b = biomeForFloor(f);
  // The flooded Catacombs are standing water from wall to wall already, and a
  // puddle drawn on a flood reads as nothing. They get a slick of oil afloat.
  if (b.flooded) return { oil: 1, water: 0, ice: false };
  if (b.molten) return { oil: OIL_POOLS + 1, water: 0, ice: false };
  if (b.frozen) return { oil: 1, water: WATER_POOLS + 1, ice: true };
  if (b.vessel === 'barrel') return { oil: OIL_POOLS + 1, water: WATER_POOLS, ice: false };
  return { oil: OIL_POOLS, water: WATER_POOLS, ice: false };
}

/**
 * Lay a fresh floor's pools, on their own `surface:` stream, after it is
 * generated: `generateFloor` stays pure and no existing floor moves. Pools
 * sit in ordinary rooms, never on a stair or the tile in front of one, a
 * door, a prop, a trap, or anywhere in the throne room.
 */
export function placeSurfaces(f: Floor, runSeed: number): void {
  if (f.surfaces) return;
  const rng = createRng(hashString(`surface:${runSeed}:${f.depth}`));
  const out: Surface[] = [];
  f.surfaces = out;
  const blocked = new Set<number>();
  for (const s of f.stairs) {
    blocked.add(s.y * f.width + s.x);
    const front = stairsFront(s);
    blocked.add(front.y * f.width + front.x);
  }
  const ok = (x: number, y: number) =>
    tileAt(f, x, y) === FLOOR && !blocked.has(y * f.width + x) && !doorAt(f, x, y) && !stairsAt(f, x, y)
    && !propAt(f, x, y) && !trapAt(f, x, y) && !surfaceAt(f, x, y);
  const rooms = f.rooms.filter((r) => r.role === 'normal' || r.role === 'end' || r.role === 'treasure' || r.role === 'shrine');
  if (!rooms.length) return;
  const { oil, water, ice } = poolsFor(f);
  const pool = (kind: SurfaceKind) => {
    for (let tries = 0; tries < 12; tries++) {
      const r = rng.pick(rooms);
      const sx = r.x + rng.int(0, r.w - 1), sy = r.y + rng.int(0, r.h - 1);
      if (!ok(sx, sy)) continue;
      grow(f, rng, sx, sy, rng.int(POOL_MIN, POOL_MAX), ok, (x, y) => out.push({ x, y, kind }));
      return;
    }
  };
  for (let i = 0; i < oil; i++) pool('oil');
  for (let i = 0; i < water; i++) pool(ice ? 'ice' : 'water');
}

/** Grow a pool outward from one tile: a random walk over the tiles beside the ones it has. */
function grow(f: Floor, rng: Rng, sx: number, sy: number, size: number, ok: (x: number, y: number) => boolean, add: (x: number, y: number) => void): void {
  const tiles: [number, number][] = [[sx, sy]];
  const taken = new Set([sy * f.width + sx]);
  add(sx, sy);
  for (let n = 0; n < size * 6 && tiles.length < size; n++) {
    const [x, y] = rng.pick(tiles);
    const d = rng.pick(DIRS);
    const nx = x + DX[d], ny = y + DY[d];
    const i = ny * f.width + nx;
    if (taken.has(i) || !ok(nx, ny)) continue;
    taken.add(i);
    tiles.push([nx, ny]);
    add(nx, ny);
  }
}

/** What an element did to a tile, for the world to show and to act on. */
export type SurfaceChange = 'lit' | 'melted' | 'froze' | null;

/**
 * Fire reaches a tile: oil catches, ice melts to water. Anything else is
 * untouched, so fire on bare floor or water does nothing at all.
 */
export function ignite(f: Floor, x: number, y: number): SurfaceChange {
  const s = surfaceAt(f, x, y);
  if (!s) return null;
  if (s.kind === 'oil') {
    s.kind = 'fire';
    s.t = FIRE_SECONDS;
    s.spread = FIRE_SPREAD;
    return 'lit';
  }
  if (s.kind === 'ice') {
    s.kind = 'water';
    delete s.t;
    return 'melted';
  }
  return null;
}

/** Frost reaches a tile: water freezes, for a while. */
export function chill(f: Floor, x: number, y: number): SurfaceChange {
  const s = surfaceAt(f, x, y);
  if (!s || s.kind !== 'water') return null;
  s.kind = 'ice';
  s.t = ICE_THAW;
  return 'froze';
}

/**
 * The floor's own clock: fire spreads to the oil beside it and burns out,
 * frozen water thaws. Returns the tiles that caught this tick, so the world
 * can make a noise about them. Spent fire leaves bare floor.
 */
export function tickSurfaces(f: Floor, dt: number): Surface[] {
  const list = f.surfaces;
  if (!list?.length) return [];
  const caught: Surface[] = [];
  let spent = false;
  // Only what was already burning spreads this tick: a tile that catches now
  // waits its own `FIRE_SPREAD`, so fire walks one tile at a time.
  for (const s of [...list]) {
    if (s.kind === 'fire' && !caught.includes(s)) {
      if (s.spread !== undefined) {
        s.spread -= dt;
        if (s.spread <= 0) {
          delete s.spread;
          for (const d of DIRS) {
            const n = surfaceAt(f, s.x + DX[d], s.y + DY[d]);
            if (n && n.kind === 'oil' && ignite(f, n.x, n.y) === 'lit') caught.push(n);
          }
        }
      }
      s.t = (s.t ?? 0) - dt;
      if (s.t <= 0) spent = true;
    } else if (s.kind === 'ice' && s.t !== undefined) {
      s.t -= dt;
      if (s.t <= 0) {
        s.kind = 'water';
        delete s.t;
      }
    }
  }
  if (spent) f.surfaces = list.filter((s) => s.kind !== 'fire' || (s.t ?? 0) > 0);
  return caught;
}
