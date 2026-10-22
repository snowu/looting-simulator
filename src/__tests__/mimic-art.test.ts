import { describe, expect, it } from 'vitest';
import { getArt } from '../art/registry';
import { rasterize } from '../art/raster';

const px = (id: string) => rasterize(getArt(id)!);
/** How many pixels differ between two same-sized arts. */
function diff(a: string, b: string): number {
  const x = px(a), y = px(b);
  expect([x.w, x.h]).toEqual([y.w, y.h]);
  let n = 0;
  for (let i = 0; i < x.data.length; i += 4) {
    if (x.data[i] !== y.data[i] || x.data[i + 1] !== y.data[i + 1] || x.data[i + 2] !== y.data[i + 2] || x.data[i + 3] !== y.data[i + 3]) n++;
  }
  return n;
}

describe('the sleeping mimic', () => {
  it('is told from a real chest by a handful of pixels, not a face', () => {
    // Two nails and a tongue tip: seen if you look, never at a glance.
    expect(diff('chest', 'chest_mimic')).toBe(3);
  });

  it('breathes: its in-breath lifts the lid, and is still a chest', () => {
    const n = diff('chest_mimic', 'chest_mimic_in');
    expect(n).toBeGreaterThan(20);
    // The silhouette only grows by the one row the lid rises.
    const a = px('chest_mimic'), b = px('chest_mimic_in');
    const top = (r: typeof a) => {
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (r.data[(y * r.w + x) * 4 + 3]) return y;
      return r.h;
    };
    expect(top(a) - top(b)).toBe(1);
  });
});
