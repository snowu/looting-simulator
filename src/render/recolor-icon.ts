import type { ArtDef, Ramp } from '../art/raster';
import { parseColor } from '../art/raster';

type Rgb = readonly [number, number, number];
type Color = readonly number[];

/**
 * How far off the ramp a colour may sit and still count as material. A
 * hand-painted icon uses its own in-between shades (`#56565f` beside the
 * exported `#55555e`, or `#35353c` between the two dark steps); those are
 * within a few units of the ramp. Outlines and white glints are much further.
 */
const NEAR = 6;
/**
 * How far past the lightest step a shade may go, as a fraction of the last
 * step: a painted highlight a little brighter than the ramp is still the
 * material, a glint near white is not. Nothing darker than the darkest step
 * counts, because that is where the outlines are.
 */
const PAST_LIGHT = 0.3;
/**
 * A glint is a near-white, near-grey pixel: brighter than this on every
 * channel, and no further than `GLINT_CHROMA` between its channels.
 */
const GLINT_MIN = 200;
const GLINT_CHROMA = 16;
/**
 * How much of the material's hue a glint takes. Light on a polished thing is
 * the colour of the thing, a little: a purple gem's glint was pure white and
 * read as a hole in it (#100). The glint keeps its brightness and only takes
 * the lightest step's offset from grey, scaled by this, so iron's glints are
 * left as they were and an amethyst's turn lavender.
 */
const GLINT_TINT = 0.6;

/**
 * Replace the exported icon's material colours with an item's material.
 *
 * The four ramp colours map exactly to the material's four. Any other colour
 * lying close to the line through those four is a shade the artist painted
 * between or just past them: it maps to the same place on the material's ramp.
 * Colours the art names for itself (outlines, cords) are never touched, except
 * near-white glints, which take a little of the material's hue.
 */
export function recolorIcon(data: Uint8ClampedArray, def: ArtDef, ramp: Ramp): void {
  const from: (readonly [number, number, number, number])[] = [];
  const to: (readonly [number, number, number, number])[] = [];
  const exact = new Map<number, readonly [number, number, number, number]>();
  for (let i = 0; i < 4; i++) {
    const original = def.palette[String(i + 1)];
    if (!original) continue;
    const c = parseColor(original);
    const r = parseColor(ramp[i]);
    from.push(c);
    to.push(r);
    exact.set(pack(c), r);
  }
  const fixed = new Set<number>();
  for (const [key, color] of Object.entries(def.palette)) {
    if (key === '1' || key === '2' || key === '3' || key === '4') continue;
    const [r, g, b] = parseColor(color);
    fixed.add((r << 16) | (g << 8) | b);
  }
  const shaded = from.length === 4;
  const seen = new Map<number, Rgb | null>();
  const glint = shaded && !def.glass ? hueOffset(to[3]) : null;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;
    const hit = exact.get(pack([data[i], data[i + 1], data[i + 2], a]));
    if (hit) {
      data[i] = hit[0];
      data[i + 1] = hit[1];
      data[i + 2] = hit[2];
      data[i + 3] = hit[3];
      continue;
    }
    if (!shaded || a < 128) continue;
    const rgb = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let out = seen.get(rgb);
    if (out === undefined) {
      const p: Rgb = [data[i], data[i + 1], data[i + 2]];
      out = glint && isGlint(p) ? tintGlint(p, glint) : fixed.has(rgb) ? null : onRamp(p, from, to);
      seen.set(rgb, out);
    }
    if (out) {
      data[i] = out[0];
      data[i + 1] = out[1];
      data[i + 2] = out[2];
    }
  }
}

function isGlint(p: Rgb): boolean {
  return Math.min(p[0], p[1], p[2]) >= GLINT_MIN && Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]) <= GLINT_CHROMA;
}

/** How far each channel of `c` sits from its own grey (Rec. 601 luma). */
function hueOffset(c: Color): Rgb {
  const luma = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  return [c[0] - luma, c[1] - luma, c[2] - luma];
}

function tintGlint(p: Rgb, offset: Rgb): Rgb {
  const at = (k: number) => Math.max(0, Math.min(255, Math.round(p[k] + offset[k] * GLINT_TINT)));
  return [at(0), at(1), at(2)];
}

const pack = ([r, g, b, a]: readonly number[]) => ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;

/** Where `p` sits on the `from` ramp, carried to the same place on `to`; null when it is not on it. */
function onRamp(p: Rgb, from: readonly Color[], to: readonly Color[]): Rgb | null {
  let best = NEAR * NEAR + 1e-9;
  let out: Rgb | null = null;
  for (let s = 0; s < 3; s++) {
    const a = from[s], b = from[s + 1];
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    if (!len) continue;
    let u = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / len;
    u = Math.max(0, Math.min(s === 2 ? 1 + PAST_LIGHT : 1, u));
    let dist = 0;
    for (let k = 0; k < 3; k++) dist += (p[k] - (a[k] + u * d[k])) ** 2;
    if (dist > best) continue;
    best = dist;
    const ta = to[s], tb = to[s + 1];
    const at = (k: number) => Math.max(0, Math.min(255, Math.round(ta[k] + u * (tb[k] - ta[k]))));
    out = [at(0), at(1), at(2)];
  }
  return out;
}
