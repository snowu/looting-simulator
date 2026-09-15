const walls = ['wall_emberworks', 'wall_emberworks', 'wall_emberworks_seam', 'wall_emberworks_pool', 'wall_emberworks_grate'];
function rank(x: number, y: number, side: number): number {
  return ((x * 73856093) ^ (y * 19349663) ^ (side * 83492791)) >>> 0;
}
/** Local winners leave at least two ordinary panels between recessed vents.
 * No generation RNG, floor state or traversal order affects the choice. */
export function emberWallTexture(x: number, y: number, side: number): string {
  const score = rank(x, y, side);
  const candidate = walls[(score % 100) % walls.length];
  if (candidate !== 'wall_emberworks_grate') return candidate;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if ((!dx && !dy) || Math.abs(dx) + Math.abs(dy) > 2) continue;
    const other = rank(x + dx, y + dy, side);
    if ((other % 100) % walls.length === 4 && (other < score || other === score && (dy < 0 || dy === 0 && dx < 0))) return walls[0];
  }
  return candidate;
}
