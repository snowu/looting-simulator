/** `v` held within [lo, hi]. Written exactly as the inline form it replaced, so lo > hi still yields lo. */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Tiles between two points walking only along the grid. */
export function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}
