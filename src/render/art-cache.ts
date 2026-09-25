import * as THREE from 'three';
import { ALL_ART, getArt } from '../art/registry';
import { Ramp, Raster, rasterize } from '../art/raster';
import { recolorIcon } from './recolor-icon';
import { BUILD_ID, versionedAssetUrl } from '../ui/update';
import { decodeArtPack, isArtPack } from './art-pack';

/**
 * Browser-side cache turning art defs into canvases, textures and CSS URLs.
 *
 * Hand-drawn PNG overrides: list art ids in `public/art/manifest.json`
 * (e.g. ["wall_crypt", "rat_0"]) and drop `public/art/<id>.png` next to it.
 * An override replaces the built-in grid. Icon PNGs retain material ramp recolouring.
 */

const canvases = new Map<string, HTMLCanvasElement>();
const textures = new Map<string, THREE.Texture>();
const urls = new Map<string, string>();
/** A shipped PNG, decoded: from the art pack as a bitmap, or fetched one by one as an image. */
interface Override {
  source: CanvasImageSource;
  w: number;
  h: number;
}
const overrides = new Map<string, Override>();

const keyOf = (id: string, ramp?: Ramp) => (ramp ? `${id}|${ramp.join(',')}` : id);

/**
 * Load the shipped PNGs that replace the built-in pixel grids.
 *
 * A build ships them twice: as one `art/pack.bin` (see `art-pack.ts`), which is
 * one request instead of one per sprite, and as the loose files. The pack is
 * tried first in a production build. The dev server has no pack, and a
 * missing one (a 404, a network error, or a host answering with its HTML
 * fallback page) falls back to the loose files, so it never stops the game
 * booting.
 */
export async function loadArtOverrides({ pack = import.meta.env.PROD } = {}): Promise<number> {
  const base = import.meta.env.BASE_URL;
  if (pack && (await loadArtPack(base))) return overrides.size;

  // Versioned so a new game version re-downloads art instead of serving the
  // previous version's PNGs from HTTP cache (same filenames across builds).
  const manifestUrl = versionedAssetUrl(`${base}art/manifest.json`, BUILD_ID);
  const res = await fetch(manifestUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load art manifest ${manifestUrl}: HTTP ${res.status}`);
  const ids = checkIds(await res.json(), manifestUrl);

  await Promise.all(
    ids.map(
      (id) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            overrides.set(id, { source: img, w: img.naturalWidth, h: img.naturalHeight });
            resolve();
          };
          img.onerror = () => reject(new Error(`Failed to load art asset ${base}art/${id}.png`));
          img.src = versionedAssetUrl(`${base}art/${id}.png`, BUILD_ID);
        }),
    ),
  );
  return overrides.size;
}

/** The whole art set in one request. False when there is no pack to read. */
async function loadArtPack(base: string): Promise<boolean> {
  // Versioned by build, so the browser may keep it: a new build is a new URL.
  const url = versionedAssetUrl(`${base}art/pack.bin`, BUILD_ID);
  let bytes: Uint8Array;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    // Offline, or the connection dropped mid-download: the loose files may still come.
    return false;
  }
  // A server that answers every path with its index page has no pack either.
  if (!isArtPack(bytes)) return false;
  // A pack that is there but wrong is a broken build, not a missing file.
  const entries = decodeArtPack(bytes);
  checkIds(entries.map((e) => e.id), url);
  const decoded = await Promise.all(
    entries.map(async (e) => [e.id, await createImageBitmap(new Blob([e.png as Uint8Array<ArrayBuffer>], { type: 'image/png' }))] as const),
  );
  for (const [id, bitmap] of decoded) overrides.set(id, { source: bitmap, w: bitmap.width, h: bitmap.height });
  return true;
}

/** Every art id exactly once, and nothing else: an override set with gaps must not boot. */
function checkIds(ids: unknown, from: string): string[] {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    throw new Error(`Invalid art list in ${from}: expected an array of IDs`);
  }
  const expected = new Set(ALL_ART.map((art) => art.id));
  const listed = new Set(ids);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  const missing = [...expected].filter((id) => !listed.has(id));
  const unknown = [...listed].filter((id) => !expected.has(id));
  if (duplicates.length || missing.length || unknown.length) {
    throw new Error(
      `Invalid art list in ${from}: duplicates [${duplicates.join(', ')}], missing [${missing.join(', ')}], unknown [${unknown.join(', ')}]`,
    );
  }
  return ids as string[];
}

export function artCanvas(id: string, ramp?: Ramp): HTMLCanvasElement {
  const key = keyOf(id, ramp);
  const hit = canvases.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const shipped = overrides.get(id);
  if (shipped) {
    canvas.width = shipped.w;
    canvas.height = shipped.h;
    ctx.drawImage(shipped.source, 0, 0);
    if (ramp && (id.startsWith('ic_') || id.startsWith('vm_'))) {
      const def = getArt(id);
      if (def) {
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        recolorIcon(pixels.data, def, ramp);
        ctx.putImageData(pixels, 0, 0);
      }
    }
  } else {
    const def = getArt(id);
    if (!def) throw new Error(`missing art ${id}`);
    const r = rasterize(def, ramp, getArt);
    canvas.width = r.w;
    canvas.height = r.h;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
  }
  canvases.set(key, canvas);
  return canvas;
}

export function artTexture(id: string, ramp?: Ramp): THREE.Texture {
  const key = keyOf(id, ramp);
  const hit = textures.get(key);
  if (hit) return hit;
  const tex = new THREE.CanvasTexture(artCanvas(id, ramp));
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  // Lighting is done in gamma space, PS1-style: keep texels raw.
  tex.colorSpace = THREE.NoColorSpace;
  tex.premultiplyAlpha = false;
  textures.set(key, tex);
  return tex;
}

/**
 * A texture for pixels built at runtime rather than drawn as an art id, such
 * as your Shade holding your kit (`shade.ts`). Built once per key.
 */
export function rasterTexture(key: string, build: () => Raster): THREE.Texture {
  const hit = textures.get(key);
  if (hit) return hit;
  const r = build();
  const canvas = document.createElement('canvas');
  canvas.width = r.w;
  canvas.height = r.h;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.premultiplyAlpha = false;
  textures.set(key, tex);
  return tex;
}

export function artUrl(id: string, ramp?: Ramp): string {
  const key = keyOf(id, ramp);
  const hit = urls.get(key);
  if (hit) return hit;
  const url = artCanvas(id, ramp).toDataURL();
  urls.set(key, url);
  return url;
}

const SIZES = new WeakMap<HTMLCanvasElement, { readonly w: number; readonly h: number }>();

/** An art's pixel size. Read for every sprite placed, every frame, so it is kept rather than rebuilt. */
export function artSize(id: string): { readonly w: number; readonly h: number } {
  const c = artCanvas(id);
  let size = SIZES.get(c);
  if (!size) {
    size = { w: c.width, h: c.height };
    SIZES.set(c, size);
  }
  return size;
}
