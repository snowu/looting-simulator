import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALL_ART, artFile, getArt } from '../art/registry';
import { rasterize } from '../art/raster';
import { artCanvas, loadArtOverrides } from '../render/art-cache';
import { recolorIcon } from '../render/recolor-icon';

const artIds = ALL_ART.map((art) => art.id);
const artFiles = artIds.map(artFile); // what public/art/manifest.json lists: 'enemies/rat_0.png'

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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(artFiles))));
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

  it('recolors the shades a hand-painted icon puts between and past the ramp steps', () => {
    // ic_hide's exported ramp is #2a2a30 #55555e #8a8a94 #c8c8d0. The painted
    // PNG also uses #56565f (one off step 2), #35353c (between steps 1 and 2)
    // and #d6d6d9 (a highlight just past step 4); its outline is #0e0a08 and
    // its glint #ececee.
    const def = getArt('ic_hide')!;
    const ramp: [string, string, string, string] = ['#3a1a10', '#7a3a20', '#c06a40', '#f0b080'];
    const px = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];
    const data = new Uint8ClampedArray(['#55555e', '#56565f', '#35353c', '#d6d6d9', '#0e0a08', '#ececee', '#ffffff'].flatMap(px));
    recolorIcon(data, def, ramp);
    const out = (i: number) => '#' + [0, 1, 2].map((k) => data[i * 4 + k].toString(16).padStart(2, '0')).join('');
    expect(out(0)).toBe('#7a3a20'); // a ramp step maps exactly
    // One unit off it: the same step, give or take that unit.
    for (const [k, v] of [0x7a, 0x3a, 0x20].entries()) expect(Math.abs(data[4 + k] - v)).toBeLessThanOrEqual(2);
    expect(out(2)).not.toBe('#35353c'); // between steps: takes the material
    expect(data[2 * 4]).toBeGreaterThan(data[2 * 4 + 2]); // ...warm, like the leather
    expect(out(3)).not.toBe('#d6d6d9'); // a painted highlight takes it too
    expect(out(4)).toBe('#0e0a08'); // the outline does not
    // A glint keeps its brightness but takes a little of the leather's hue
    // (#100: a white glint read as a hole in a purple gem).
    for (const i of [5, 6]) {
      expect(out(i)).not.toBe(i === 5 ? '#ececee' : '#ffffff');
      expect(data[i * 4]).toBeGreaterThan(data[i * 4 + 2]); // warm
      expect(Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])).toBeGreaterThan(180); // still bright
    }
  });

  it('tints glints by the material, leaves iron alone, and never tints glass', () => {
    const px = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];
    const hex = (d: Uint8ClampedArray) => '#' + [0, 1, 2].map((k) => d[k].toString(16).padStart(2, '0')).join('');
    const glintOn = (id: string, ramp: [string, string, string, string]) => {
      const data = new Uint8ClampedArray(px('#ededed'));
      recolorIcon(data, getArt(id)!, ramp);
      return data;
    };
    const purple = glintOn('ic_gem', ['#1a0a2e', '#3e1a6a', '#7040b0', '#c8a0f0']);
    expect(purple[2]).toBeGreaterThan(purple[1]); // lavender, not white
    const iron = glintOn('ic_gem', ['#2a2a30', '#55555e', '#8a8a94', '#c8c8d0']);
    for (const k of [0, 1, 2]) expect(Math.abs(iron[k] - 0xed)).toBeLessThanOrEqual(4); // iron's grey barely moves it
    expect(hex(glintOn('ic_potion', ['#3a0808', '#7a1414', '#c02828', '#f06060']))).toBe('#ededed');
  });

  it('ships a valid, correctly sized PNG for every art ID', () => {
    const artDir = resolve(process.cwd(), 'public/art');
    const manifest: string[] = JSON.parse(readFileSync(resolve(artDir, 'manifest.json'), 'utf8'));
    expect(manifest).toEqual(artFiles);

    for (const id of artIds) {
      const png = readFileSync(resolve(artDir, artFile(id)));
      const raster = rasterize(getArt(id)!, undefined, getArt);
      const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
      expect(Array.from(png.subarray(0, 8)), id).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(header.getUint32(16), `${id} width`).toBe(raster.w);
      expect(header.getUint32(20), `${id} height`).toBe(raster.h);
    }
  });

  it('rejects an incomplete manifest', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(artFiles.slice(1)))));

    await expect(loadArtOverrides()).rejects.toThrow(`missing [${artIds[0]}]`);
  });

  it('rejects when a listed PNG fails to load', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(artFiles))));
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

    await expect(loadArtOverrides()).rejects.toThrow('art/enemies/rat_0.png');
  });
});
