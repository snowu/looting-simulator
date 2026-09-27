/**
 * Your Shade wears your kit. Its own sprite is a dark figure with nothing
 * readable on it; the weapon and shield are the icons of what you have
 * equipped, in their materials, composited into its hands. The Shade is the
 * only enemy dressed from your equipment, so it is built here rather than
 * drawn as sixty frames of every weapon.
 *
 * DOM-free: the renderer turns the raster into a texture, and tests read it.
 */
import { getArt } from '../art/registry';
import { ArtResolver, EMISSIVE_ALPHA, Ramp, Raster, rasterize } from '../art/raster';
import type { EnemyFrame } from './enemy-pose';

export interface HeldIcon {
  icon: string;
  ramp?: Ramp;
}

/** Where the hands are on each body frame, in body pixels. */
export const SHADE_HANDS: Record<'0' | 'atk', { weapon: [number, number]; shield: [number, number] }> = {
  // Held upright at its right side, the fist at the hip.
  '0': { weapon: [28, 29], shield: [10, 28] },
  // Raised over the head for the blow.
  atk: { weapon: [27, 11], shield: [10, 28] },
};

/** The fist drawn back over the grip, so the weapon is held rather than pasted on. */
const FIST = '#0c0f17';

/** The body frame a pose uses. The Shade has no guard frame of its own. */
export function shadeFrame(frame: EnemyFrame): '0' | 'atk' {
  return frame === 'atk' ? 'atk' : '0';
}

/** A cache key for one frame in one set of kit. */
export function shadeKey(frame: '0' | 'atk', weapon?: HeldIcon, shield?: HeldIcon): string {
  const part = (h?: HeldIcon) => (h ? `${h.icon}|${h.ramp?.join(',') ?? ''}` : '-');
  return `shade:${frame}:${part(weapon)}:${part(shield)}`;
}

/** The bounds of an icon's opaque pixels. */
function bounds(r: Raster): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = r.w, y0 = r.h, x1 = -1, y1 = -1;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    if (r.data[(y * r.w + x) * 4 + 3] === 0) continue;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

/**
 * Where a weapon icon is held: a little above its bottom (the pommel or the
 * butt of the haft), at the middle of what is drawn on that row. Icons are
 * drawn upright, so that is the grip.
 */
export function gripOf(r: Raster): [number, number] {
  const b = bounds(r);
  const y = Math.max(b.y0, b.y1 - 2);
  let sum = 0, n = 0;
  for (let x = 0; x < r.w; x++) if (r.data[(y * r.w + x) * 4 + 3] !== 0) { sum += x; n++; }
  return [n ? Math.floor(sum / n) : (b.x0 + b.x1) >> 1, y];
}

/** Paint `src` over `dst` with its (ox, oy) pixel at (x, y). Clipped to the canvas. */
function blit(dst: Raster, src: Raster, x: number, y: number): void {
  for (let sy = 0; sy < src.h; sy++) for (let sx = 0; sx < src.w; sx++) {
    const i = (sy * src.w + sx) * 4;
    if (src.data[i + 3] < 128) continue;
    const dx = x + sx, dy = y + sy;
    if (dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue;
    const o = (dy * dst.w + dx) * 4;
    for (let k = 0; k < 4; k++) dst.data[o + k] = src.data[i + k];
  }
}

function paint(dst: Raster, x: number, y: number, hex: string): void {
  if (x < 0 || y < 0 || x >= dst.w || y >= dst.h) return;
  const o = (y * dst.w + x) * 4;
  dst.data[o] = parseInt(hex.slice(1, 3), 16);
  dst.data[o + 1] = parseInt(hex.slice(3, 5), 16);
  dst.data[o + 2] = parseInt(hex.slice(5, 7), 16);
  // Emissive, like the body it belongs to (see EMISSIVE_ALPHA).
  dst.data[o + 3] = EMISSIVE_ALPHA;
}

/** One frame of your Shade, holding what you hold. */
export function composeShade(frame: '0' | 'atk', weapon?: HeldIcon, shield?: HeldIcon, resolve: ArtResolver = getArt): Raster {
  const body = rasterize(resolve(`shade_${frame}`)!, undefined, resolve);
  const out: Raster = { w: body.w, h: body.h, data: body.data.slice() };
  const hands = SHADE_HANDS[frame];
  if (weapon) {
    const def = resolve(weapon.icon);
    if (def) {
      const icon = rasterize(def, weapon.ramp, resolve);
      const [gx, gy] = gripOf(icon);
      const [hx, hy] = hands.weapon;
      blit(out, icon, hx - gx, hy - gy);
      for (let dy = 0; dy < 2; dy++) for (let dx = -1; dx < 1; dx++) paint(out, hx + dx, hy + dy, FIST);
    }
  }
  if (shield) {
    const def = resolve(shield.icon);
    if (def) {
      const icon = rasterize(def, shield.ramp, resolve);
      const b = bounds(icon);
      const [sx, sy] = hands.shield;
      blit(out, icon, sx - ((b.x0 + b.x1 + 1) >> 1), sy - ((b.y0 + b.y1 + 1) >> 1));
    }
  }
  return out;
}
