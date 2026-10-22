import { createRng, hashString, Rng } from '../core/rng';
import { DIRS, DX, DY } from '../core/dir';
import { biomeForFloor } from '../data/biomes';
import {
  BARREL_SPILL, FIRE_SECONDS, FIRE_SPREAD, ICE_THAW, OIL_BARRELS, OIL_POOLS, POOL_MAX, POOL_MIN, SPORE_FIRE_SECONDS,
  SPORE_PATCHES, Surface, SurfaceKind, VENT_PERIOD_MAX, VENT_PERIOD_MIN, VENTS, WATER_POOLS,
} from '../data/surfaces';
import { FLOOR, Floor, Prop, blocksMove, doorAt, propAt, stairsAt, stairsFront, tileAt, trapAt } from './dungeon';

/**
 * The surface layer of a floor: placement, and what the elements do to it.
 * The rules are written out in `src/data/surfaces.ts`; this is the state.
 * Effects on creatures (burning, freezing, slipping, blinding) live in the
 * world, which is the only thing that knows who is standing where.
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

/** An oil barrel still standing on this tile. */
export function oilBarrelAt(f: Floor, x: number, y: number): Prop | undefined {
  const p = propAt(f, x, y);
  return p && p.oil && !p.used ? p : undefined;
}

/** What a fresh floor gets in its biome: pools of oil and water (laid as ice in a frozen biome), oil barrels, vents and spore patches. */
export function poolsFor(f: Floor): { oil: number; water: number; ice: boolean; barrels: number; vents: number; spores: number } {
  const b = biomeForFloor(f);
  const base = { oil: OIL_POOLS, water: WATER_POOLS, ice: false, barrels: OIL_BARRELS, vents: 0, spores: 0 };
  // The flooded Catacombs are standing water from wall to wall already, and a
  // puddle drawn on a flood reads as nothing. They get a slick of oil afloat.
  if (b.flooded) return { ...base, oil: 1, water: 0 };
  if (b.molten) return { ...base, oil: OIL_POOLS + 1, water: 0, barrels: OIL_BARRELS + 1, vents: b.law === 'vents' ? VENTS : 0 };
  // The Frost Vault's law is its ice, so it gets more of it.
  if (b.frozen) return { ...base, oil: 1, water: WATER_POOLS + (b.law === 'treacherous' ? 2 : 1), ice: true };
  const spores = b.law === 'spores' ? SPORE_PATCHES : 0;
  if (b.vessel === 'barrel') return { ...base, oil: OIL_POOLS + 1, barrels: OIL_BARRELS + 1, spores };
  return { ...base, spores };
}

/**
 * Lay a fresh floor's surfaces, on their own `surface:` stream, after it is
 * generated: `generateFloor` stays pure and no existing floor moves. They sit
 * in ordinary rooms, never on a stair or the tile in front of one, a door, a
 * prop, a trap, or anywhere in the throne room. Pools first, then the
 * biome's own (vents, spores), then oil barrels, so adding a later kind
 * never moves an earlier one.
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
  const counts = poolsFor(f);
  const spot = (test: (x: number, y: number) => boolean): [number, number] | null => {
    for (let tries = 0; tries < 12; tries++) {
      const r = rng.pick(rooms);
      const sx = r.x + rng.int(0, r.w - 1), sy = r.y + rng.int(0, r.h - 1);
      if (test(sx, sy)) return [sx, sy];
    }
    return null;
  };
  const pool = (kind: SurfaceKind, min = POOL_MIN, max = POOL_MAX) => {
    const at = spot(ok);
    if (at) grow(f, rng, at[0], at[1], rng.int(min, max), ok, (x, y) => out.push({ x, y, kind }));
  };
  for (let i = 0; i < counts.oil; i++) pool('oil');
  for (let i = 0; i < counts.water; i++) pool(counts.ice ? 'ice' : 'water');
  for (let i = 0; i < counts.vents; i++) {
    const at = spot(ok);
    // Staggered from the start, so the floor's vents never breathe in step.
    if (at) out.push({ x: at[0], y: at[1], kind: 'vent', t: VENT_PERIOD_MIN + rng.float(0, VENT_PERIOD_MAX - VENT_PERIOD_MIN) });
  }
  for (let i = 0; i < counts.spores; i++) pool('spores', 1, 3);
  for (let i = 0; i < counts.barrels; i++) {
    // A barrel blocks its tile, so it stands against a wall, and only where
    // it cuts nothing off: everything you could reach before, you still can.
    const at = spot((x, y) => ok(x, y) && DIRS.some((d) => tileAt(f, x + DX[d], y + DY[d]) !== FLOOR)
      && DIRS.every((d) => !doorAt(f, x + DX[d], y + DY[d])));
    if (!at) continue;
    const before = reachable(f);
    const barrel: Prop = { id: `oil${i}`, kind: 'barrel', x: at[0], y: at[1], used: false, tier: 'none', blocking: true, mimic: false, oil: true };
    f.props.push(barrel);
    if (reachable(f) < before - 1) f.props.pop();
  }
}

/** Walkable tiles reachable from the stair up: the check that a barrel cut nothing off. */
export function reachable(f: Floor): number {
  const up = f.stairs.find((s) => !s.down) ?? f.stairs[0];
  if (!up) return 0;
  const start = stairsFront(up);
  const seen = new Set([start.y * f.width + start.x]);
  const q = [[start.x, start.y]];
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h];
    for (const d of DIRS) {
      const nx = x + DX[d], ny = y + DY[d];
      const i = ny * f.width + nx;
      if (seen.has(i) || (blocksMove(f, nx, ny) && !doorAt(f, nx, ny))) continue;
      seen.add(i);
      q.push([nx, ny]);
    }
  }
  return seen.size;
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

/**
 * Spill a broken oil barrel: oil on its own tile and up to `BARREL_SPILL`
 * more around it, over bare floor and water (oil floats) but never a stair,
 * a door or another surface. Returns the oil laid.
 */
export function spillOil(f: Floor, x: number, y: number, rng: Rng): Surface[] {
  f.surfaces ??= [];
  const out: Surface[] = [];
  const ok = (tx: number, ty: number) => tileAt(f, tx, ty) === FLOOR && !stairsAt(f, tx, ty) && !doorAt(f, tx, ty)
    && (!surfaceAt(f, tx, ty) || surfaceKindAt(f, tx, ty) === 'water') && !(propAt(f, tx, ty)?.blocking);
  const lay = (tx: number, ty: number) => {
    const s = surfaceAt(f, tx, ty);
    if (s) {
      s.kind = 'oil';
      delete s.t;
      out.push(s);
    } else {
      const n: Surface = { x: tx, y: ty, kind: 'oil' };
      f.surfaces!.push(n);
      out.push(n);
    }
  };
  // Its own tile is where it stood, so it is always fair game.
  if (!surfaceAt(f, x, y) || surfaceKindAt(f, x, y) === 'water') lay(x, y);
  grow(f, rng, x, y, BARREL_SPILL + 1, (tx, ty) => ok(tx, ty) && !(tx === x && ty === y), lay);
  return out;
}

/** What an element did to a tile, for the world to show and to act on. */
export type SurfaceChange = 'lit' | 'burst' | 'melted' | 'froze' | null;

/**
 * Fire reaches a tile: oil catches, spores catch and burst, ice melts to
 * water. Anything else is untouched, so fire on bare floor or water does
 * nothing at all.
 */
export function ignite(f: Floor, x: number, y: number): SurfaceChange {
  const s = surfaceAt(f, x, y);
  if (!s) return null;
  if (s.kind === 'oil' || s.kind === 'spores') {
    const spores = s.kind === 'spores';
    s.kind = 'fire';
    s.t = spores ? SPORE_FIRE_SECONDS : FIRE_SECONDS;
    s.spread = FIRE_SPREAD;
    return spores ? 'burst' : 'lit';
  }
  if (s.kind === 'ice') {
    // Flood ice melts back into the flood, not into a puddle.
    if (s.flood) f.surfaces = f.surfaces!.filter((o) => o !== s);
    else {
      s.kind = 'water';
      delete s.t;
    }
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
 * Frost lands on the Catacombs' flood: every bare floor tile in reach, and
 * any water, freezes for `ICE_THAW`. Flood ice thaws back into the flood.
 * Returns the tiles that froze.
 */
export function freezeFlood(f: Floor, x: number, y: number, reach: number): Surface[] {
  f.surfaces ??= [];
  const out: Surface[] = [];
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    if (Math.abs(dx) + Math.abs(dy) > reach) continue;
    const tx = x + dx, ty = y + dy;
    if (tileAt(f, tx, ty) !== FLOOR || stairsAt(f, tx, ty) || doorAt(f, tx, ty)) continue;
    const s = surfaceAt(f, tx, ty);
    if (s) {
      if (chill(f, tx, ty) === 'froze') out.push(s);
      continue;
    }
    const ice: Surface = { x: tx, y: ty, kind: 'ice', t: ICE_THAW, flood: true };
    f.surfaces.push(ice);
    out.push(ice);
  }
  return out;
}

export interface SurfaceTick {
  /** Oil that caught from the fire beside it. */
  caught: Surface[];
  /** Spores that caught, and so burst. */
  burst: Surface[];
  /** Vents whose countdown ran out this tick: the world bursts them and sets the next. */
  vents: Surface[];
}

/**
 * The floor's own clock: fire spreads to the oil and spores beside it and
 * burns out, frozen water thaws, vents count down. Spent fire leaves bare
 * floor; flood ice leaves the flood.
 */
export function tickSurfaces(f: Floor, dt: number): SurfaceTick {
  const result: SurfaceTick = { caught: [], burst: [], vents: [] };
  const list = f.surfaces;
  if (!list?.length) return result;
  let gone = false;
  // Only what was already burning spreads this tick: a tile that catches now
  // waits its own `FIRE_SPREAD`, so fire walks one tile at a time.
  for (const s of [...list]) {
    if (s.kind === 'fire' && !result.caught.includes(s) && !result.burst.includes(s)) {
      if (s.spread !== undefined) {
        s.spread -= dt;
        if (s.spread <= 0) {
          delete s.spread;
          for (const d of DIRS) {
            const n = surfaceAt(f, s.x + DX[d], s.y + DY[d]);
            if (!n) continue;
            const change = n.kind === 'oil' || n.kind === 'spores' ? ignite(f, n.x, n.y) : null;
            if (change === 'lit') result.caught.push(n);
            else if (change === 'burst') result.burst.push(n);
          }
        }
      }
      s.t = (s.t ?? 0) - dt;
      if (s.t <= 0) gone = true;
    } else if (s.kind === 'ice' && s.t !== undefined) {
      s.t -= dt;
      if (s.t <= 0) {
        if (s.flood) {
          s.t = 0;
          gone = true;
        } else {
          s.kind = 'water';
          delete s.t;
        }
      }
    } else if (s.kind === 'vent') {
      if (s.burst !== undefined) {
        s.burst -= dt;
        if (s.burst <= 0) delete s.burst;
      }
      s.t = (s.t ?? 0) - dt;
      if (s.t <= 0) result.vents.push(s);
    }
  }
  if (gone) f.surfaces = list.filter((s) => !((s.kind === 'fire' || (s.kind === 'ice' && s.flood)) && (s.t ?? 0) <= 0));
  return result;
}

/**
 * Whether making (x, y) solid leaves the open tiles around it connected to
 * each other through that 3×3 patch: a blocking prop there splits nothing,
 * even in a room the stair flood fill cannot see (a vault, a secret room).
 */
export function splitsNothing(f: Floor, x: number, y: number): boolean {
  const open = (tx: number, ty: number) => !(tx === x && ty === y) && (!blocksMove(f, tx, ty) || !!doorAt(f, tx, ty));
  const cells: [number, number][] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && open(x + dx, y + dy)) cells.push([x + dx, y + dy]);
  if (cells.length <= 1) return true;
  const key = (c: [number, number]) => `${c[0]},${c[1]}`;
  const inRing = new Set(cells.map(key));
  const seen = new Set([key(cells[0])]);
  const q = [cells[0]];
  for (let h = 0; h < q.length; h++) {
    const [cx, cy] = q[h];
    for (const d of DIRS) {
      const n: [number, number] = [cx + DX[d], cy + DY[d]];
      if (inRing.has(key(n)) && !seen.has(key(n))) { seen.add(key(n)); q.push(n); }
    }
  }
  return seen.size === cells.length;
}

