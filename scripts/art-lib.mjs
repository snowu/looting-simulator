// Shared by the art scripts (sync, status, alpha): the registry, PNG bytes and
// the public/art folder layout. The game's sprites are drawn in src/art; the
// PNGs in public/art/<folder>/<id>.png are what it ships, and the artist paints
// over them in place.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { relative, resolve, sep } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { rolldown } from 'rolldown';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

export const ART_DIR = resolve('public/art');
export const TODO = resolve('docs/art-todo.md');
/*
 * Which PNGs are still the placeholder art:sync wrote, by a hash of their pixels.
 * A PNG whose pixels still hash to its entry has not been painted, so when its
 * code art changes art:sync rewrites it (code art is iterated on until the
 * artist takes over). Anything else is the artist's and is never written. A
 * pixel hash, not a file hash: re-saving an untouched placeholder in another
 * program changes the bytes, not the pixels.
 */
export const PLACEHOLDERS = resolve('src/art/placeholders.json');
export const pixelHash = ({ w, h, data }) => createHash('sha1').update(`${w}x${h}:`).update(data).digest('hex').slice(0, 16);
export const readPlaceholders = async () => JSON.parse(await readFile(PLACEHOLDERS, 'utf8').catch(() => '{}'));
export const writePlaceholders = (map) => writeFile(PLACEHOLDERS, `${JSON.stringify(Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b))), null, 1)}\n`);
/** Still the untouched placeholder: its pixels match what art:sync last wrote, or the current code art. */
export const isPlaceholder = (png, code, recorded) => pixelHash(png) === recorded || samePixels(png, code);

export async function loadModule(path) {
  const bundle = await rolldown({ input: resolve(path) });
  try {
    const { output } = await bundle.generate({ format: 'esm', codeSplitting: false });
    return import(`data:text/javascript;base64,${Buffer.from(output[0].code).toString('base64')}`);
  } finally {
    await bundle.close();
  }
}

/** The registry and the rasterizer, from the same TypeScript the game runs. */
export async function loadArt() {
  const { rasterize } = await loadModule('src/art/raster.ts');
  const { ALL_ART, ART_FOLDERS, artFile, getArt } = await loadModule('src/art/registry.ts');
  return { ALL_ART, ART_FOLDERS, artFile, getArt, raster: (def) => rasterize(def, undefined, getArt) };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

/** RGBA pixels to PNG bytes (8-bit RGBA, no filtering: small art, exact bytes every time). */
export function encodePng({ w, h, data }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** PNG bytes to RGBA pixels, exactly (no premultiplying, unlike a canvas). */
export function decodePng(bytes) {
  const p = PNG.sync.read(bytes);
  return { w: p.width, h: p.height, data: new Uint8Array(p.data.buffer, p.data.byteOffset, p.data.length) };
}

export const samePixels = (a, b) => a.w === b.w && a.h === b.h && Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;

/** Every PNG under public/art: id -> path relative to public/art ('enemies/rat_0.png'), plus ids found twice. */
export async function pngsOnDisk() {
  const found = new Map(), twice = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = resolve(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith('.png')) {
        const id = e.name.slice(0, -4), rel = relative(ART_DIR, p).split(sep).join('/');
        if (found.has(id)) twice.push(`${found.get(id)} and ${rel}`);
        else found.set(id, rel);
      }
    }
  };
  await walk(ART_DIR);
  return { found, twice };
}

export const readManifest = async () => JSON.parse(await readFile(resolve(ART_DIR, 'manifest.json'), 'utf8'));

/*
 * The alpha rule. The game reads three kinds of pixel: clear (alpha 0), solid
 * (255), and emissive (250: it glows and ignores the dungeon light; the shader
 * treats roughly 245-252 as emissive). The code art also uses a few deliberate
 * in-between values for soft glows and shadows (96, 102, 136, 160, 176, 192, 224).
 *
 * "Stray alpha" is what a soft brush or an eraser leaves behind in a painting
 * program: specks at alpha 1-15 (invisible in the dungeon, a faint smudge on
 * icons) and near-opaque values 245-254 other than 250, which either glow by
 * accident (245-252) or are a slip of the emissive marker. The fix snaps specks
 * to clear and near-opaque pixels to solid, or to emissive where the sprite's
 * code art is emissive at that pixel.
 */
export const isStrayAlpha = (a) => (a >= 1 && a <= 15) || (a >= 245 && a <= 254 && a !== 250);

/** Count stray-alpha pixels; with `fix`, rewrite them in place (code = the code raster, for emissive hints). */
export function strayAlpha(img, code, fix = false) {
  let n = 0;
  for (let i = 3; i < img.data.length; i += 4) {
    const a = img.data[i];
    if (!isStrayAlpha(a)) continue;
    n++;
    if (!fix) continue;
    const codeA = code && code.w === img.w && code.h === img.h ? code.data[i] : 255;
    img.data[i] = a <= 15 ? 0 : codeA === 250 && a <= 252 ? 250 : 255;
    if (img.data[i] === 0) img.data[i - 3] = img.data[i - 2] = img.data[i - 1] = 0;
  }
  return n;
}
