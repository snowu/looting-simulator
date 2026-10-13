import { ArtDef } from './raster';
import { POOF, POOF_B } from './spell-fx';

/**
 * What lies on the floor: oil, water, ice, the scorch fire leaves while it
 * burns, and the flames standing up out of it. docs/NEXT.md §5.
 *
 * The four pools are decals laid flat on the tile, so each one is a blob with
 * a ragged edge rather than a square: a pool of three tiles reads as one
 * spill, not as three carpet tiles. They are drawn by a little deterministic
 * noise rather than by hand because the edge is the whole of the drawing and
 * a hand-drawn edge repeats visibly across a pool. The artist can paint over
 * the exported PNGs like any other sprite.
 *
 * Readability is the rule: oil is darker than any floor and carries a
 * rainbow sheen, water is a cold blue with ripples, ice is the palest thing
 * on the floor. A few pixels of each are emissive (alpha 250) and dim — the
 * sheen, the ripples, the glints — so a pool still shows in a dark room as
 * the light it would catch, without glowing. Fire and its embers are
 * emissive at full strength, so they burn through the fog.
 */

const SIZE = 32;

/** A cheap repeatable hash in [0, 1) of a lattice point and a seed. */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1), at a lattice spacing of `cell` pixels. */
function noise(x: number, y: number, cell: number, seed: number): number {
  const gx = x / cell, gy = y / cell;
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  const fx = gx - x0, fy = gy - y0;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed), d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * s(fx) + (c - a) * s(fy) + (a - b - c + d) * s(fx) * s(fy);
}

/**
 * A ragged blob filling most of the tile. `paint` chooses each inside
 * pixel's colour key from how far in from the edge it is (0 at the rim) and
 * the pixel itself; outside pixels are blank.
 */
function blob(seed: number, reach: number, paint: (inset: number, x: number, y: number) => string): string[] {
  const c = (SIZE - 1) / 2;
  const out: string[] = [];
  for (let y = 0; y < SIZE; y++) {
    let row = '';
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - c, y - c) / c;
      const edge = reach + (noise(x, y, 7, seed) - 0.5) * 0.45 + (noise(x, y, 3, seed + 9) - 0.5) * 0.12;
      const inset = edge - d;
      row += inset > 0 ? paint(inset, x, y) : '.';
    }
    out.push(row);
  }
  return out;
}

const OIL_PAL: Record<string, string> = {
  k: '#0c0a08', // the pool
  r: '#2a2418', // its rim, catching the light
  p: '#4a2e68fa', // sheen: violet
  g: '#265a46fa', // sheen: green
  b: '#28427afa', // sheen: blue
  w: '#a8a0bafa', // one bright glint
};

const OIL = blob(11, 0.92, (inset, x, y) => {
  if (inset < 0.06) return 'r';
  const n = noise(x, y, 5, 23);
  // Bands of sheen, the way oil on stone shows colour in stripes.
  if (n > 0.6 && n < 0.65) return 'p';
  if (n > 0.68 && n < 0.72) return 'g';
  if (n > 0.75 && n < 0.78) return 'b';
  if ((x === 12 && y === 11) || (x === 13 && y === 11) || (x === 20 && y === 19)) return 'w';
  return 'k';
});

const WATER_PAL: Record<string, string> = {
  d: '#1a2c40', // deep
  m: '#2c4a68', // the body of it
  l: '#365e80fa', // ripple, catching the light
  h: '#88b4d4fa', // highlight
  e: '#34404a', // wet rim
};

const WATER = blob(31, 0.9, (inset, x, y) => {
  if (inset < 0.05) return 'e';
  const c = (SIZE - 1) / 2;
  // Two rings of ripple, off centre, broken up by noise.
  const ring = Math.hypot(x - c + 3, y - c + 2);
  if ((Math.abs(ring - 6) < 0.6 || Math.abs(ring - 10.5) < 0.6) && noise(x, y, 4, 37) > 0.4) return 'l';
  if ((x === 10 || x === 11) && y === 9) return 'h';
  return inset > 0.35 && noise(x, y, 6, 41) > 0.55 ? 'd' : 'm';
});

const ICE_PAL: Record<string, string> = {
  i: '#a8d4ec', // the sheet
  s: '#d8f0fc', // pale glaze
  c: '#5e94bc', // cracks
  h: '#dff4fffa', // glint
  e: '#5a88a8fa', // rim, catching the light
};

const ICE = blob(53, 0.9, (inset, x, y) => {
  if (inset < 0.06) return 'e';
  // Cracks: thin lines where the noise crosses one value.
  const n = noise(x, y, 6, 61);
  if (Math.abs(n - 0.5) < 0.025) return 'c';
  if (x - y === 4 && x > 8 && x < 16) return 'h';
  return noise(x, y, 9, 67) > 0.6 ? 's' : 'i';
});

const SCORCH_PAL: Record<string, string> = {
  k: '#14100c', // scorched oil
  a: '#2e2219', // ash
  o: '#ff6a20fa', // embers, emissive
  y: '#ffc040fa',
};

const SCORCH = blob(71, 0.92, (inset, x, y) => {
  const n = hash(x, y, 79);
  if (n > 0.965) return 'y';
  if (n > 0.9) return 'o';
  return inset < 0.08 || noise(x, y, 5, 83) > 0.62 ? 'a' : 'k';
});

/**
 * The flames standing up out of a burning tile: drawn head-on like every
 * creature, 16 wide and 24 tall, two frames the renderer flickers between.
 */
const FLAME_PAL: Record<string, string> = {
  w: '#fff6d0fa',
  y: '#ffd050fa',
  o: '#ff8a28fa',
  r: '#d03c14fa',
};

function flame(seed: number): string[] {
  const W = 16, H = 24;
  const out: string[] = [];
  for (let y = 0; y < H; y++) {
    let row = '';
    const up = 1 - y / (H - 1); // 1 at the top, 0 at the base
    for (let x = 0; x < W; x++) {
      // Three tongues, each a narrowing column that sways with the seed.
      let heat = 0;
      for (const [cx, top] of [[4.5, 0.55], [8, 0.95], [11.5, 0.65]] as const) {
        const sway = Math.sin(y * 0.45 + seed * 2 + cx) * 1.1 * up;
        const half = 3.2 * (1 - up / top);
        if (up > top) continue;
        const d = Math.abs(x - cx - sway);
        if (d < half) heat = Math.max(heat, 1 - d / half);
      }
      heat *= 0.75 + noise(x, y, 3, seed) * 0.5;
      row += heat > 0.75 ? 'w' : heat > 0.5 ? 'y' : heat > 0.28 ? 'o' : heat > 0.08 ? 'r' : '.';
    }
    out.push(row);
  }
  return out;
}

/**
 * An Emberworks vent: a round iron grate over the fire below, with the
 * glow coming up through the bars dim and emissive. The renderer brightens
 * it into the warning before a burst.
 */
const VENT_PAL: Record<string, string> = {
  k: '#0e0a08', // the dark below
  i: '#3a3634', // iron bars
  l: '#5a5450', // bar highlight
  c: '#241c18', // cracked crust round it
  g: '#a03a10fa', // the glow, emissive
  y: '#e07020fa',
};

const VENT = blob(91, 0.82, (inset, x, y) => {
  const c = (SIZE - 1) / 2;
  const r = Math.hypot(x - c, y - c);
  if (inset < 0.1) return noise(x, y, 3, 97) > 0.7 ? 'g' : 'c';
  if (r > 10) return 'i';
  // Bars across the grate, three each way.
  if (x % 5 === 0 || y % 5 === 0) return x % 5 === 0 && y % 5 === 0 ? 'l' : 'i';
  return r < 5 && noise(x, y, 2, 101) > 0.45 ? 'y' : noise(x, y, 3, 103) > 0.35 ? 'g' : 'k';
});

/**
 * Sporegrove puffballs from above: a cluster of pale round caps on a mat of
 * moss, faintly aglow like the grove's fungus so they show in the dark.
 */
const SPORE_PAL: Record<string, string> = {
  m: '#24361a', // moss
  d: '#3c5228', // moss, lit
  c: '#9ca87cfa', // cap, faintly aglow like the grove's fungus
  s: '#d0d8b0fa', // cap, lit
  h: '#5e6848', // cap in shadow
  p: '#b0d870fa', // spore dust, faintly emissive
};

const SPORES = (() => {
  const caps: [number, number, number][] = [[12, 13, 5], [20, 11, 4], [18, 20, 5], [10, 21, 3], [24, 18, 3]];
  return blob(113, 0.8, (_inset, x, y) => {
    for (const [cx, cy, r] of caps) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < r) {
        if (d < r * 0.45 && x <= cx && y <= cy) return 's';
        if (hash(x, y, 127) > 0.88) return 'p';
        return x - cx + y - cy > r * 0.6 ? 'h' : 'c';
      }
    }
    return noise(x, y, 4, 131) > 0.55 ? 'd' : 'm';
  });
})();

/** A puff of spores: Hex's smoke, in the Sporegrove's sickly green. */
const SPORE_CLOUD_PAL: Record<string, string> = {
  1: '#2e4418fa',
  2: '#5a7a2cfa',
  3: '#8cb048fa',
  4: '#c8e080fa',
  x: '#f0f8c8fa',
};

/** A burst of fire: the same shape, in flame. */
const BLAST_PAL: Record<string, string> = {
  1: '#801c08fa',
  2: '#d04818fa',
  3: '#ff8a28fa',
  4: '#ffd060fa',
  x: '#fff6d0fa',
};

/** Glacial Tomb's burst of ice: the same shape again, in frost. */
const FROST_PAL: Record<string, string> = {
  1: '#1c4a7afa',
  2: '#3a88c8fa',
  3: '#8ccaf8fa',
  4: '#d0f0fffa',
  x: '#f8feffff',
};

export const SURFACE_ART: ArtDef[] = [
  { id: 'surf_vent', palette: VENT_PAL, rows: VENT },
  { id: 'surf_spores', palette: SPORE_PAL, rows: SPORES },
  { id: 'fx_spores', palette: SPORE_CLOUD_PAL, rows: POOF },
  { id: 'fx_spores_b', palette: SPORE_CLOUD_PAL, rows: POOF_B },
  { id: 'fx_blast', palette: BLAST_PAL, rows: POOF },
  { id: 'fx_blast_b', palette: BLAST_PAL, rows: POOF_B },
  { id: 'fx_frost', palette: FROST_PAL, rows: POOF },
  { id: 'fx_frost_b', palette: FROST_PAL, rows: POOF_B },
  { id: 'surf_oil', palette: OIL_PAL, rows: OIL },
  { id: 'surf_water', palette: WATER_PAL, rows: WATER },
  { id: 'surf_ice', palette: ICE_PAL, rows: ICE },
  { id: 'surf_scorch', palette: SCORCH_PAL, rows: SCORCH },
  { id: 'fx_flame_0', palette: FLAME_PAL, rows: flame(1) },
  { id: 'fx_flame_1', palette: FLAME_PAL, rows: flame(4) },
];
