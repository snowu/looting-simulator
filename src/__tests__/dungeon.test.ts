import { describe, it, expect } from 'vitest';
import { Floor, FLOOR, chestIsMimic, generateFloor, stairsFront } from '../systems/dungeon';
import { DIRS, DX, DY } from '../core/dir';
import { FINAL_DEPTH } from '../data/biomes';
import { BOSS_ID } from '../data/enemies';

function passable(f: Floor, x: number, y: number, lockedPassable: boolean): boolean {
  if (x < 0 || y < 0 || x >= f.width || y >= f.height) return false;
  if (f.secrets.some((s) => s.x === x && s.y === y)) return true;
  if (f.tiles[y * f.width + x] !== FLOOR) return false;
  const d = f.doors.find((dd) => dd.x === x && dd.y === y);
  if (d?.locked && !lockedPassable) return false;
  if (f.props.some((p) => p.blocking && p.x === x && p.y === y)) return false;
  return true;
}

function flood(f: Floor, sx: number, sy: number, lockedPassable: boolean): Set<number> {
  const seen = new Set<number>([sy * f.width + sx]);
  const q: [number, number][] = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.pop()!;
    for (const d of DIRS) {
      const nx = x + DX[d], ny = y + DY[d];
      const k = ny * f.width + nx;
      if (seen.has(k) || !passable(f, nx, ny, lockedPassable)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}

const SEEDS = [1, 2, 3, 17, 99, 1234];

describe('generateFloor', () => {
  for (const seed of SEEDS) {
    for (let depth = 1; depth <= FINAL_DEPTH; depth++) {
      it(`seed ${seed} depth ${depth} is well-formed`, () => {
        const f = generateFloor(seed, depth);
        expect(f.width).toBe([39, 43, 47, 51, 55, 59][depth - 1]);
        expect(f.height).toBe(f.width);
        const up = f.stairs.filter((s) => !s.down);
        const down = f.stairs.filter((s) => s.down);
        expect(up).toHaveLength(1);
        expect(down).toHaveLength(depth < FINAL_DEPTH ? 1 : 0);

        const spawn = stairsFront(up[0]);
        expect(passable(f, spawn.x, spawn.y, false)).toBe(true);
        for (const s of f.stairs) expect(f.tiles[s.y * f.width + s.x]).toBe(FLOOR);

        // Everything walkable is reachable (doors open, secret walls pushed).
        const reach = flood(f, spawn.x, spawn.y, true);
        let walkable = 0;
        for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) {
          if (f.tiles[y * f.width + x] === FLOOR && !f.props.some((p) => p.blocking && p.x === x && p.y === y)) {
            walkable++;
            expect(reach.has(y * f.width + x)).toBe(true);
          }
        }
        expect(walkable).toBeGreaterThan(60);

        // Every locked door's key can be fetched without passing a locked door.
        const free = flood(f, spawn.x, spawn.y, false);
        for (const d of f.doors.filter((dd) => dd.locked)) {
          const key = f.pickups.find((p) => p.keyId === d.keyId);
          expect(key).toBeDefined();
          expect(free.has(key!.y * f.width + key!.x)).toBe(true);
        }

        // Enemies stand on open floor, one per tile, never in doorways.
        const spots = new Set<number>();
        for (const e of f.enemies) {
          expect(passable(f, e.x, e.y, true)).toBe(true);
          expect(f.doors.some((d) => d.x === e.x && d.y === e.y)).toBe(false);
          const k = e.y * f.width + e.x;
          expect(spots.has(k)).toBe(false);
          spots.add(k);
        }
        expect(f.enemies.length).toBeGreaterThan(3);

        for (const p of f.props) {
          expect(p.mimic).toBe(p.kind === 'chest' && chestIsMimic(f.seed, p.id));
        }
        expect(f.props.filter((p) => p.tier === 'vault')).toHaveLength(f.doors.some((d) => d.locked) ? 1 : 0);

        if (depth === FINAL_DEPTH) expect(f.enemies.some((e) => e.def === BOSS_ID)).toBe(true);
      });
    }
  }

  it('adds playable space at every depth compared with the original maps', () => {
    // Total open tiles across SEEDS before expansion; bounds alone can grow
    // without creating any additional rooms or exploration.
    const originalOpenTiles = [1503, 1671, 2040, 2200, 2324, 2131];
    for (let depth = 1; depth <= FINAL_DEPTH; depth++) {
      const openTiles = SEEDS.reduce((total, seed) => total +
        generateFloor(seed, depth).tiles.filter(tile => tile === FLOOR).length, 0);
      expect(openTiles).toBeGreaterThan(originalOpenTiles[depth - 1] * 1.2);
    }
  });

  it('is deterministic per run seed and depth', () => {
    const a = generateFloor(42, 3);
    const b = generateFloor(42, 3);
    expect(a.tiles).toEqual(b.tiles);
    expect(a.enemies.map((e) => [e.def, e.x, e.y])).toEqual(b.enemies.map((e) => [e.def, e.x, e.y]));
    expect(generateFloor(43, 3).tiles).not.toEqual(a.tiles);
  });

  it('makes loops, not just a chain of rooms', () => {
    // Count tiles with 3+ open neighbours (junctions) across a few floors.
    let junctions = 0;
    for (const seed of SEEDS) {
      const f = generateFloor(seed, 2);
      for (let y = 1; y < f.height - 1; y++) for (let x = 1; x < f.width - 1; x++) {
        if (f.tiles[y * f.width + x] !== FLOOR) continue;
        const n = DIRS.filter((d) => f.tiles[(y + DY[d]) * f.width + x + DX[d]] === FLOOR).length;
        if (n >= 3) junctions++;
      }
    }
    expect(junctions).toBeGreaterThan(30);
  });
});
