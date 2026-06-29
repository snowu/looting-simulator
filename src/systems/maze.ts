import { NodeType } from '../state/game-state';

export enum Dir {
  North = 0,
  East = 1,
  South = 2,
  West = 3,
}

// Delta per direction. North = -y (up on grid).
export const DIR_DELTA: Record<Dir, { dx: number; dy: number }> = {
  [Dir.North]: { dx: 0, dy: -1 },
  [Dir.East]: { dx: 1, dy: 0 },
  [Dir.South]: { dx: 0, dy: 1 },
  [Dir.West]: { dx: -1, dy: 0 },
};

export function turnLeft(d: Dir): Dir {
  return ((d + 3) % 4) as Dir;
}
export function turnRight(d: Dir): Dir {
  return ((d + 1) % 4) as Dir;
}
export function turnAround(d: Dir): Dir {
  return ((d + 2) % 4) as Dir;
}

export enum TileKind {
  Wall = 0,
  Floor = 1,
  Encounter = 2,
  Stairs = 3,
}

export interface Tile {
  kind: TileKind;
  /** Set when kind === Encounter. The node-style room type. */
  encounter?: NodeType;
  /** Encounter resolved already. */
  visited: boolean;
  /** Player has seen this tile (for minimap fog). */
  seen: boolean;
  /** A wooden door occupies this (otherwise walkable) tile. Blocks until opened. */
  door?: { open: boolean };
}

export interface MazeFloor {
  width: number;
  height: number;
  tiles: Tile[]; // row-major, length = width*height
  startX: number;
  startY: number;
  depth: number; // floor depth (1-based)
}

export function tileAt(maze: MazeFloor, x: number, y: number): Tile | null {
  if (x < 0 || y < 0 || x >= maze.width || y >= maze.height) return null;
  return maze.tiles[y * maze.width + x];
}

export function isWalkable(maze: MazeFloor, x: number, y: number): boolean {
  const t = tileAt(maze, x, y);
  if (!t || t.kind === TileKind.Wall) return false;
  if (t.door && !t.door.open) return false; // closed door blocks
  return true;
}

/** A tile that currently has a CLOSED door (the thing E opens). */
export function isClosedDoor(maze: MazeFloor, x: number, y: number): boolean {
  const t = tileAt(maze, x, y);
  return !!t && !!t.door && !t.door.open;
}

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

const ENCOUNTER_TYPES = [
  NodeType.Treasure,
  NodeType.Combat,
  NodeType.Shop,
  NodeType.Trap,
  NodeType.Event,
];

/**
 * Generate a tile-grid maze floor. Rooms placed on grid, connected by L-shaped
 * corridors. Each room (except start) gets an encounter at its center. One room
 * holds the stairs down (or boss on the final floor).
 */
export function generateMaze(depth: number, isBossFloor = false): MazeFloor {
  const width = 25;
  const height = 25;
  const tiles: Tile[] = new Array(width * height);
  for (let i = 0; i < tiles.length; i++) {
    tiles[i] = { kind: TileKind.Wall, visited: false, seen: false };
  }

  const set = (x: number, y: number, kind: TileKind): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    tiles[y * width + x].kind = kind;
  };
  const getKind = (x: number, y: number): TileKind | null => {
    if (x < 0 || y < 0 || x >= width || y >= height) return null;
    return tiles[y * width + x].kind;
  };

  // Place non-overlapping rooms.
  const rooms: Room[] = [];
  const roomCount = 6 + Math.floor(Math.random() * 3); // 6-8
  let attempts = 0;
  while (rooms.length < roomCount && attempts < 300) {
    attempts++;
    const w = 2 + Math.floor(Math.random() * 2); // 2-3 (tighter rooms, less void)
    const h = 2 + Math.floor(Math.random() * 2);
    const x = 1 + Math.floor(Math.random() * (width - w - 2));
    const y = 1 + Math.floor(Math.random() * (height - h - 2));
    const overlaps = rooms.some(
      (r) => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y
    );
    if (overlaps) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
  }

  // Carve room floors.
  for (const r of rooms) {
    for (let yy = r.y; yy < r.y + r.h; yy++) {
      for (let xx = r.x; xx < r.x + r.w; xx++) {
        set(xx, yy, TileKind.Floor);
      }
    }
  }

  // Connect rooms in sequence with L-shaped corridors (guarantees connectivity).
  const carveH = (x0: number, x1: number, y: number): void => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      if (getKind(x, y) === TileKind.Wall) set(x, y, TileKind.Floor);
    }
  };
  const carveV = (y0: number, y1: number, x: number): void => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
      if (getKind(x, y) === TileKind.Wall) set(x, y, TileKind.Floor);
    }
  };
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1];
    const b = rooms[i];
    if (Math.random() < 0.5) {
      carveH(a.cx, b.cx, a.cy);
      carveV(a.cy, b.cy, b.cx);
    } else {
      carveV(a.cy, b.cy, a.cx);
      carveH(a.cx, b.cx, b.cy);
    }
  }

  // Start = first room center.
  const startRoom = rooms[0];
  const startX = startRoom.cx;
  const startY = startRoom.cy;

  // Encounters at every other room center; last room = stairs / boss.
  const lastRoom = rooms[rooms.length - 1];
  for (let i = 1; i < rooms.length; i++) {
    const r = rooms[i];
    const tile = tiles[r.cy * width + r.cx];
    if (r === lastRoom) {
      if (isBossFloor) {
        tile.kind = TileKind.Encounter;
        tile.encounter = NodeType.Boss;
      } else {
        tile.kind = TileKind.Stairs;
      }
    } else {
      tile.kind = TileKind.Encounter;
      tile.encounter = ENCOUNTER_TYPES[Math.floor(Math.random() * ENCOUNTER_TYPES.length)];
    }
  }

  // --- Place wooden doors in room walls -------------------------------------
  // A door belongs IN the wall ring of a room: a single perimeter cell where a
  // 1-wide corridor pierces the wall to enter the room. We turn that wall cell
  // into a floor tile carrying a door, so it fits the wall exactly.
  const inRoom = (x: number, y: number): Room | null =>
    rooms.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) ?? null;

  const isPath = (x: number, y: number): boolean => {
    const k = getKind(x, y);
    return k === TileKind.Floor || k === TileKind.Encounter || k === TileKind.Stairs;
  };

  for (const r of rooms) {
    const doorsForRoom: number[] = [];
    // Walk the wall ring one tile outside the room rectangle.
    const ring: [number, number, 'v' | 'h'][] = [];
    for (let x = r.x; x < r.x + r.w; x++) {
      ring.push([x, r.y - 1, 'v']);       // top wall, corridor enters vertically
      ring.push([x, r.y + r.h, 'v']);     // bottom wall
    }
    for (let y = r.y; y < r.y + r.h; y++) {
      ring.push([r.x - 1, y, 'h']);       // left wall, corridor enters horizontally
      ring.push([r.x + r.w, y, 'h']);     // right wall
    }

    for (const [x, y, axis] of ring) {
      if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) continue;
      const idx = y * width + x;
      const tile = tiles[idx];
      // The entrance is a carved corridor cell (plain Floor) sitting in the
      // room's wall ring. Never put a door on encounter/stairs/start tiles.
      if (tile.kind !== TileKind.Floor) continue;
      if (tile.door) continue;
      if (x === startX && y === startY) continue;

      // The corridor must pierce the wall: room interior on the inner side,
      // a 1-wide corridor on the outer side, flanked by walls along the wall.
      let inner: [number, number], outer: [number, number], flankA: [number, number], flankB: [number, number];
      if (axis === 'v') {
        const innerY = (y === r.y - 1) ? y + 1 : y - 1;
        const outerY = (y === r.y - 1) ? y - 1 : y + 1;
        inner = [x, innerY]; outer = [x, outerY];
        flankA = [x - 1, y]; flankB = [x + 1, y];
      } else {
        const innerX = (x === r.x - 1) ? x + 1 : x - 1;
        const outerX = (x === r.x - 1) ? x - 1 : x + 1;
        inner = [innerX, y]; outer = [outerX, y];
        flankA = [x, y - 1]; flankB = [x, y + 1];
      }

      const roomInside = !!inRoom(inner[0], inner[1]);
      const corridorOutside = isPath(outer[0], outer[1]);
      const flanked = getKind(flankA[0], flankA[1]) === TileKind.Wall &&
                      getKind(flankB[0], flankB[1]) === TileKind.Wall;
      if (!roomInside || !corridorOutside || !flanked) continue;

      // One door per room.
      if (doorsForRoom.length >= 1) continue;

      tile.door = { open: false }; // door sits in the existing wall-gap entrance
      doorsForRoom.push(idx);
    }
  }

  return { width, height, tiles, startX, startY, depth };
}
