export enum Dir {
  N = 0,
  E = 1,
  S = 2,
  W = 3,
}

/** Grid deltas per direction. North is -y. */
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;
export const DIRS: Dir[] = [Dir.N, Dir.E, Dir.S, Dir.W];
export const DIR_NAMES = ['North', 'East', 'South', 'West'] as const;

export function turnLeft(d: Dir): Dir {
  return ((d + 3) % 4) as Dir;
}
export function turnRight(d: Dir): Dir {
  return ((d + 1) % 4) as Dir;
}
export function turnAround(d: Dir): Dir {
  return ((d + 2) % 4) as Dir;
}

/** Direction of a unit orthogonal step, or null if (dx,dy) isn't one. */
export function dirOf(dx: number, dy: number): Dir | null {
  if (dx === 0 && dy === -1) return Dir.N;
  if (dx === 1 && dy === 0) return Dir.E;
  if (dx === 0 && dy === 1) return Dir.S;
  if (dx === -1 && dy === 0) return Dir.W;
  return null;
}
