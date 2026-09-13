import type { ArtDef, Ramp } from '../art/raster';
import { parseColor } from '../art/raster';

/** Replace the exported icon's four default ramp colors with an item's material colors. */
export function recolorIcon(data: Uint8ClampedArray, def: ArtDef, ramp: Ramp): void {
  const colors = new Map<number, readonly [number, number, number, number]>();
  for (let i = 0; i < 4; i++) {
    const original = def.palette[String(i + 1)];
    if (!original) continue;
    const [r, g, b, a] = parseColor(original);
    colors.set((r << 24) | (g << 16) | (b << 8) | a, parseColor(ramp[i]));
  }
  for (let i = 0; i < data.length; i += 4) {
    const replacement = colors.get((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]);
    if (replacement) {
      data[i] = replacement[0];
      data[i + 1] = replacement[1];
      data[i + 2] = replacement[2];
      data[i + 3] = replacement[3];
    }
  }
}
