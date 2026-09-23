/**
 * A position-only hash for picking a tile's texture variant. No RNG and no
 * floor state, so a tile always draws the same way, and anything that must
 * agree with the mesh (ember vents, ceilings) can recompute the same choice.
 */
export function tileHash(x: number, y: number, k: number): number {
  return ((x * 73856093) ^ (y * 19349663) ^ (k * 83492791)) >>> 0;
}
