/**
 * Where a mine's timber sets stand. Only in a one-wide straight tunnel, and
 * only every `every`th tile along it, so the beams come round now and then
 * rather than over every tile boundary (the old lintel, removed in ddbdca5).
 *
 * 'x': the tunnel runs north-south, so the cap spans west-east and the posts
 * stand on the west and east walls. 'z': the other way round.
 */
export function timberSetAt(open: (x: number, y: number) => boolean, x: number, y: number, every: number): 'x' | 'z' | null {
  if (!open(x, y)) return null;
  if (y % every === 0 && !open(x - 1, y) && !open(x + 1, y) && open(x, y - 1) && open(x, y + 1)) return 'x';
  if (x % every === 0 && !open(x, y - 1) && !open(x, y + 1) && open(x - 1, y) && open(x + 1, y)) return 'z';
  return null;
}
