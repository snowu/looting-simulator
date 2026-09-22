import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALL_ART } from '../art/registry';
import { decodeArtPack, encodeArtPack } from '../render/art-pack';
import { artCanvas, loadArtOverrides } from '../render/art-cache';

const artDir = resolve(process.cwd(), 'public/art');
const manifest: string[] = JSON.parse(readFileSync(resolve(artDir, 'manifest.json'), 'utf8'));
const shipped = () => manifest.map((id) => ({ id, png: new Uint8Array(readFileSync(resolve(artDir, `${id}.png`))) }));

afterEach(() => vi.unstubAllGlobals());

describe('the art pack', () => {
  it('carries every shipped PNG byte for byte, in manifest order', () => {
    const entries = shipped();
    const back = decodeArtPack(encodeArtPack(entries));
    expect(back.map((e) => e.id)).toEqual(manifest);
    back.forEach((e, i) => expect(Buffer.from(e.png).equals(Buffer.from(entries[i].png)), e.id).toBe(true));
  });

  it('refuses anything that is not a pack, or is cut short', () => {
    expect(() => decodeArtPack(new TextEncoder().encode('[]'))).toThrow('Not an art pack');
    const pack = encodeArtPack(shipped().slice(0, 3));
    expect(() => decodeArtPack(pack.subarray(0, pack.byteLength - 1))).toThrow('truncated');
  });

  it('loads the whole art set from one request when the build has a pack', async () => {
    const pack = encodeArtPack(shipped());
    const fetch = vi.fn().mockResolvedValue(new Response(pack));
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 32, height: 32 })));
    const drawImage = vi.fn();
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage, getImageData: vi.fn(), putImageData: vi.fn() }) }),
    });
    expect(await loadArtOverrides({ pack: true })).toBe(ALL_ART.length);
    expect(fetch).toHaveBeenCalledOnce();
    expect(String(fetch.mock.calls[0][0])).toContain('art/pack.bin');
    const canvas = artCanvas(manifest[0]);
    expect([canvas.width, canvas.height]).toEqual([32, 32]);
    expect(drawImage).toHaveBeenCalled();
  });

  it('falls back to the loose PNGs when there is no pack', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(manifest)));
    vi.stubGlobal('fetch', fetch);
    const loaded: string[] = [];
    vi.stubGlobal('Image', class {
      naturalWidth = 32;
      naturalHeight = 32;
      onload: (() => void) | null = null;
      set src(url: string) { loaded.push(url); queueMicrotask(() => this.onload?.()); }
    });
    expect(await loadArtOverrides({ pack: true })).toBe(ALL_ART.length);
    expect(String(fetch.mock.calls[1][0])).toContain('art/manifest.json');
    expect(loaded).toHaveLength(manifest.length);
  });
});
