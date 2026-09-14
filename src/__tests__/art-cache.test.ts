import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALL_ART, getArt } from '../art/registry';
import { rasterize } from '../art/raster';
import { artCanvas, loadArtOverrides } from '../render/art-cache';
import { recolorIcon } from '../render/recolor-icon';

const artIds = ALL_ART.map((art) => art.id);

afterEach(() => vi.unstubAllGlobals());

describe('art overrides', () => {
  it('applies the equipped material to a viewmodel PNG while preserving skin and cuffs', async () => {
    const def = getArt('vm_blade')!;
    const original = rasterize(def);
    const ramp: [string, string, string, string] = ['#281929', '#634064', '#b583a8', '#ffe0ef'];
    const pixels = { data: original.data.slice() };
    const putImageData = vi.fn();
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0, height: 0,
        getContext: () => ({ drawImage: vi.fn(), getImageData: () => pixels, putImageData }),
      }),
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(artIds))));
    vi.stubGlobal('Image', class {
      naturalWidth = original.w;
      naturalHeight = original.h;
      onload: (() => void) | null = null;
      set src(_url: string) { queueMicrotask(() => this.onload?.()); }
    });
    await loadArtOverrides();
    artCanvas('vm_blade', ramp);
    expect(putImageData).toHaveBeenCalledOnce();
    expect(pixels.data).toEqual(rasterize(def, ramp).data);
  });

  it('recolors an exported potion while preserving its glass and cork', () => {
    const def = getArt('ic_potion')!;
    const original = rasterize(def);
    const ramp: [string, string, string, string] = ['#6a0808', '#af2020', '#e05040', '#ffaaa0'];
    const expected = rasterize(def, ramp);
    recolorIcon(original.data, def, ramp);
    expect(original.data).toEqual(expected.data);
  });

  it('ships a valid, correctly sized PNG for every art ID', () => {
    const artDir = resolve(process.cwd(), 'public/art');
    const manifest: string[] = JSON.parse(readFileSync(resolve(artDir, 'manifest.json'), 'utf8'));
    expect(manifest).toEqual(artIds);

    for (const id of manifest) {
      const png = readFileSync(resolve(artDir, `${id}.png`));
      const raster = rasterize(getArt(id)!, undefined, getArt);
      const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
      expect(Array.from(png.subarray(0, 8)), id).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(header.getUint32(16), `${id} width`).toBe(raster.w);
      expect(header.getUint32(20), `${id} height`).toBe(raster.h);
    }
  });

  it('rejects an incomplete manifest', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(artIds.slice(1)))));

    await expect(loadArtOverrides()).rejects.toThrow(`missing [${artIds[0]}]`);
  });

  it('rejects when a listed PNG fails to load', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(artIds))));
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(url: string) {
          queueMicrotask(() => (url.endsWith('/rat_0.png') ? this.onerror?.() : this.onload?.()));
        }
      },
    );

    await expect(loadArtOverrides()).rejects.toThrow('art/rat_0.png');
  });
});
