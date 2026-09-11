/**
 * Hand-drawn pixel art is authored as palette-indexed character grids:
 * every row is a string, every character one pixel. '.' is transparent.
 * Characters '1'..'4' are a swappable colour ramp (dark → light) so one icon
 * can be re-coloured per material, SNES-style.
 *
 * This module is DOM-free so tests and tooling can rasterise art in Node.
 */

export type Ramp = readonly [string, string, string, string];

/** Pixels with this alpha are drawn full-bright by the renderer (write colours as '#rrggbbfa'). */
export const EMISSIVE_ALPHA = 250;

export interface ArtDef {
  id: string;
  palette: Record<string, string>;
  rows: string[];
  /** Another art id rasterised first; these rows are painted over it ('.' keeps the base, alpha blends). */
  base?: string;
}

export type ArtResolver = (id: string) => ArtDef | undefined;

export interface Raster {
  w: number;
  h: number;
  /** RGBA, row-major. */
  data: Uint8ClampedArray;
}

const colorCache = new Map<string, [number, number, number, number]>();

export function parseColor(c: string): [number, number, number, number] {
  const hit = colorCache.get(c);
  if (hit) return hit;
  const hex = c.replace('#', '');
  let r = 0, g = 0, b = 0, a = 255;
  if (hex.length === 3 || hex.length === 4) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
    if (hex.length === 4) a = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 6 || hex.length === 8) {
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
    if (hex.length === 8) a = parseInt(hex.slice(6, 8), 16);
  } else {
    throw new Error(`bad colour ${c}`);
  }
  const out: [number, number, number, number] = [r, g, b, a];
  colorCache.set(c, out);
  return out;
}

export function validateArt(def: ArtDef): string | null {
  if (def.rows.length === 0) return `${def.id}: no rows`;
  const w = def.rows[0].length;
  for (let y = 0; y < def.rows.length; y++) {
    if (def.rows[y].length !== w) return `${def.id}: row ${y} is ${def.rows[y].length} wide, expected ${w}`;
    for (const ch of def.rows[y]) {
      if (ch === '.' || (ch >= '1' && ch <= '4')) continue;
      if (!(ch in def.palette)) return `${def.id}: row ${y} uses unknown char '${ch}'`;
    }
  }
  return null;
}

export function rasterize(def: ArtDef, ramp?: Ramp, resolve?: ArtResolver): Raster {
  const err = validateArt(def);
  if (err) throw new Error(err);
  const h = def.rows.length;
  const w = def.rows[0].length;
  let data = new Uint8ClampedArray(w * h * 4);
  if (def.base) {
    const baseDef = resolve?.(def.base);
    if (!baseDef) throw new Error(`${def.id}: missing base art ${def.base}`);
    const base = rasterize(baseDef, ramp, resolve);
    if (base.w !== w || base.h !== h) throw new Error(`${def.id}: base ${def.base} is ${base.w}x${base.h}, expected ${w}x${h}`);
    data = base.data.slice();
  }
  for (let y = 0; y < h; y++) {
    const row = def.rows[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      let col: string | undefined;
      if (ch >= '1' && ch <= '4') col = ramp ? ramp[ch.charCodeAt(0) - 49] : def.palette[ch];
      else col = def.palette[ch];
      if (!col) throw new Error(`${def.id}: ramp char '${ch}' with no ramp or default`);
      const [r, g, b, a] = parseColor(col);
      const o = (y * w + x) * 4;
      // EMISSIVE_ALPHA marks glow pixels for the renderer; never blend it away.
      if (a === 255 || a === EMISSIVE_ALPHA || data[o + 3] === 0) {
        data[o] = r;
        data[o + 1] = g;
        data[o + 2] = b;
        data[o + 3] = a;
      } else {
        // Blend a translucent stroke over the base layer.
        const t = a / 255;
        data[o] = Math.round(r * t + data[o] * (1 - t));
        data[o + 1] = Math.round(g * t + data[o + 1] * (1 - t));
        data[o + 2] = Math.round(b * t + data[o + 2] * (1 - t));
      }
    }
  }
  return { w, h, data };
}
