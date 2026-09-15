import { ArtDef } from './raster';

// Broad, dry basalt plates. Each layout moves the junctions and changes plate
// sizes; the warm bevel faces DOWN into the gaps rather than lighting the tops.
const LAYOUTS = [
  [[4, 5], [20, 3], [11, 17], [29, 16], [2, 28], [22, 29]],
  [[8, 2], [27, 7], [2, 17], [18, 20], [10, 30]],
  [[2, 2], [17, 7], [30, 2], [6, 20], [28, 22], [17, 31]],
  [[12, 5], [29, 13], [5, 15], [15, 26], [31, 30]],
];
const PALETTE = {
  a: '#292629', b: '#343034', c: '#403b3c', d: '#504749', // ash-dry tops
  e: '#171318', r: '#58291c', s: '#913819',               // broken underside
  h: '#d34b16fa', o: '#ed7523fa', y: '#ffc052fa',          // molten openings
};
export const EMBER_FLOOR_IDS = ['floor_emberworks', 'floor_emberworks_shelf', 'floor_emberworks_shards', 'floor_emberworks_vent'];

function crust(points: number[][], variant: number): string[] {
  return Array.from({ length: 32 }, (_, y) => Array.from({ length: 32 }, (_, x) => {
    // Wrapped sites avoid framing every tile with a square lava border.
    const distances = points.map(([px, py], i) => {
      const wx = (x + 0.8 * Math.sin(y * Math.PI / 8) + 32) % 32;
      const wy = (y + 0.7 * Math.sin(x * Math.PI / 8 + variant) + 32) % 32;
      const dx = Math.min(Math.abs(wx - px), 32 - Math.abs(wx - px));
      const dy = Math.min(Math.abs(wy - py), 32 - Math.abs(wy - py));
      return { d: Math.hypot(dx, dy), i };
    }).sort((a, b) => a.d - b.d);
    const edge = distances[1].d - distances[0].d;
    const grain = ((x * 13 ^ y * 29 ^ variant * 47) >>> 0) % 19;
    // Wide pockets at triple junctions; narrow, mostly cooled seams elsewhere.
    const pocket = distances[2].d - distances[0].d < 2.0;
    if (edge < (pocket ? 1.3 : 0.55)) return pocket ? (grain < 6 ? 'y' : 'o') : 'h';
    if (edge < 1.1) return 's';
    if (edge < 1.9) return 'r';
    if (edge < 2.7) return 'e';
    return grain === 0 ? 'd' : grain < 4 ? 'a' : (distances[0].i + variant) % 3 === 0 ? 'c' : 'b';
  }).join(''));
}
export const EMBER_FLOORS: ArtDef[] = LAYOUTS.map((points, i) => ({ id: EMBER_FLOOR_IDS[i], palette: PALETTE, rows: crust(points, i) }));

/** Same position-only choice used by the floor mesh and its cosmetic vents. */
export function emberFloorIndex(x: number, y: number): number {
  return ((((x * 73856093) ^ (y * 19349663) ^ (4 * 83492791)) >>> 0) % 100) % EMBER_FLOORS.length;
}

export const EMBER_CEILING_IDS = ['ceil_emberworks', 'ceil_emberworks_shelf', 'ceil_emberworks_blister', 'ceil_emberworks_split'];
export const EMBER_CEILINGS: ArtDef[] = LAYOUTS.map((points, i) => ({
  id: EMBER_CEILING_IDS[i],
  palette: { ...PALETTE, a: '#211c20', b: '#30252a', c: '#413034', d: '#634336', r: '#813118', s: '#b84418fa' },
  rows: crust(points.map(([x, y]) => [(y + 7) % 32, (x + 11) % 32]), i + 4),
}));
export function emberCeilingIndex(x: number, y: number): number {
  return ((((x * 73856093) ^ (y * 19349663) ^ (6 * 83492791)) >>> 0) % 100) % EMBER_CEILINGS.length;
}

function ventsFor(art: ArtDef[]) { return art.map(({ rows }) => {
  const vents: { u: number; v: number }[] = [];
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === 'y' && x > 4 && x < 27 && y > 4 && y < 27) vents.push({ u: (x + 0.5) / 32, v: 1 - (y + 0.5) / 32 });
  }));
  return vents;
}); }
export const EMBER_VENTS = ventsFor(EMBER_FLOORS);
export const EMBER_CEILING_VENTS = ventsFor(EMBER_CEILINGS);
