import { describe, it, expect } from 'vitest';
import {
  generateMaze,
  Dir,
  DIR_DELTA,
  turnLeft,
  turnRight,
  turnAround,
  isWalkable,
  isClosedDoor,
  tileAt,
  TileKind,
  MazeFloor,
} from '../systems/maze';
import { NodeType } from '../state/game-state';

describe('maze direction helpers', () => {
  it('turnRight cycles N->E->S->W->N', () => {
    expect(turnRight(Dir.North)).toBe(Dir.East);
    expect(turnRight(Dir.East)).toBe(Dir.South);
    expect(turnRight(Dir.South)).toBe(Dir.West);
    expect(turnRight(Dir.West)).toBe(Dir.North);
  });

  it('turnLeft is inverse of turnRight', () => {
    for (const d of [Dir.North, Dir.East, Dir.South, Dir.West]) {
      expect(turnLeft(turnRight(d))).toBe(d);
    }
  });

  it('turnAround is two turns', () => {
    expect(turnAround(Dir.North)).toBe(Dir.South);
    expect(turnAround(Dir.East)).toBe(Dir.West);
  });

  it('North delta is up (-y)', () => {
    expect(DIR_DELTA[Dir.North]).toEqual({ dx: 0, dy: -1 });
    expect(DIR_DELTA[Dir.East]).toEqual({ dx: 1, dy: 0 });
  });
});

describe('generateMaze', () => {
  it('produces a grid of the declared size', () => {
    const m = generateMaze(1);
    expect(m.tiles.length).toBe(m.width * m.height);
  });

  it('start tile is walkable', () => {
    const m = generateMaze(1);
    expect(isWalkable(m, m.startX, m.startY)).toBe(true);
  });

  it('every walkable tile is reachable from start (connectivity)', () => {
    const m = generateMaze(2);
    const reached = floodFill(m);
    let walkable = 0;
    for (const t of m.tiles) if (t.kind !== TileKind.Wall) walkable++;
    expect(reached).toBe(walkable);
  });

  it('non-boss floor has a stairs tile', () => {
    const m = generateMaze(1, false);
    const hasStairs = m.tiles.some((t) => t.kind === TileKind.Stairs);
    expect(hasStairs).toBe(true);
  });

  it('boss floor has a boss encounter and no stairs', () => {
    const m = generateMaze(4, true);
    const hasBoss = m.tiles.some(
      (t) => t.kind === TileKind.Encounter && t.encounter === NodeType.Boss
    );
    const hasStairs = m.tiles.some((t) => t.kind === TileKind.Stairs);
    expect(hasBoss).toBe(true);
    expect(hasStairs).toBe(false);
  });

  it('has at least one encounter tile', () => {
    const m = generateMaze(1);
    const encounters = m.tiles.filter((t) => t.kind === TileKind.Encounter);
    expect(encounters.length).toBeGreaterThan(0);
  });

  it('tileAt returns null out of bounds', () => {
    const m = generateMaze(1);
    expect(tileAt(m, -1, 0)).toBeNull();
    expect(tileAt(m, m.width, 0)).toBeNull();
  });

  it('closed doors block isWalkable until opened', () => {
    // Find any maze that produced a door (most do). Try a few seeds.
    let found = false;
    for (let attempt = 0; attempt < 20 && !found; attempt++) {
      const m = generateMaze(1);
      for (let y = 0; y < m.height && !found; y++) {
        for (let x = 0; x < m.width && !found; x++) {
          const t = m.tiles[y * m.width + x];
          if (t.door) {
            found = true;
            // Door tile is a floor kind but blocked while closed.
            expect(t.kind).not.toBe(TileKind.Wall);
            expect(isClosedDoor(m, x, y)).toBe(true);
            expect(isWalkable(m, x, y)).toBe(false);
            t.door.open = true;
            expect(isWalkable(m, x, y)).toBe(true);
            expect(isClosedDoor(m, x, y)).toBe(false);
          }
        }
      }
    }
    expect(found).toBe(true);
  });
});

function floodFill(m: MazeFloor): number {
  const seen = new Set<number>();
  const stack: [number, number][] = [[m.startX, m.startY]];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    const idx = y * m.width + x;
    if (seen.has(idx)) continue;
    // Doors are passable (player opens them), so flood by tile kind, not the
    // closed-door-aware isWalkable.
    const tile = m.tiles[idx];
    if (!tile || tile.kind === TileKind.Wall) continue;
    seen.add(idx);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen.size;
}
