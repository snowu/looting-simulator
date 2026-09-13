import * as THREE from 'three';
import { ALL_ART, getArt } from '../art/registry';
import { Ramp, rasterize } from '../art/raster';
import { recolorIcon } from './recolor-icon';

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
const overrides = new Map<string, HTMLImageElement>();

const keyOf = (id: string, ramp?: Ramp) => (ramp ? `${id}|${ramp.join(',')}` : id);

export async function loadArtOverrides(): Promise<number> {
  const base = import.meta.env.BASE_URL;
  const manifestUrl = `${base}art/manifest.json`;
  const res = await fetch(manifestUrl);
  if (!res.ok) throw new Error(`Failed to load art manifest ${manifestUrl}: HTTP ${res.status}`);

  const ids: unknown = await res.json();
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    throw new Error(`Invalid art manifest ${manifestUrl}: expected an array of IDs`);
  }

  const expected = new Set(ALL_ART.map((art) => art.id));
  const listed = new Set(ids);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  const missing = [...expected].filter((id) => !listed.has(id));
  const unknown = [...listed].filter((id) => !expected.has(id));
  if (duplicates.length || missing.length || unknown.length) {
    throw new Error(
      `Invalid art manifest ${manifestUrl}: duplicates [${duplicates.join(', ')}], missing [${missing.join(', ')}], unknown [${unknown.join(', ')}]`,
    );
  }

  await Promise.all(
    ids.map(
      (id) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            overrides.set(id, img);
            resolve();
          };
          img.onerror = () => reject(new Error(`Failed to load art asset ${base}art/${id}.png`));
          img.src = `${base}art/${id}.png`;
        }),
    ),
  );
  return overrides.size;
}

export function artCanvas(id: string, ramp?: Ramp): HTMLCanvasElement {
  const key = keyOf(id, ramp);
  const hit = canvases.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const img = overrides.get(id);
  if (img) {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    if (ramp && id.startsWith('ic_')) {
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

export function artUrl(id: string, ramp?: Ramp): string {
  const key = keyOf(id, ramp);
  const hit = urls.get(key);
  if (hit) return hit;
  const url = artCanvas(id, ramp).toDataURL();
  urls.set(key, url);
  return url;
}

export function artSize(id: string): { w: number; h: number } {
  const c = artCanvas(id);
  return { w: c.width, h: c.height };
}
