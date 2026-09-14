// Regenerates public/art from the built-in pixel art, so the shipped PNG
// overrides and the code art cannot drift apart.
//
// Why this exists: `loadArtOverrides()` in src/render/art-cache.ts refuses to
// boot the game if any id in ALL_ART is missing from public/art/manifest.json.
// Adding a sprite therefore means three edits — the art def, the PNG, and the
// manifest — and forgetting the third breaks the game while every test still
// passes, because the test suite only ever looks at the defs. This script does
// all three from one source of truth.
//
// Usage: node scripts/sync-public-art.mjs  (or `npm run art:sync`)
// Pass --check to fail instead of writing, for CI or a pre-commit hook.
import { readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { rolldown } from 'rolldown';

const OUT = resolve('public/art');
const check = process.argv.includes('--check');
// The PNGs override the code art, so editing a sprite in src/art has no visible
// effect until its PNG is rewritten. --force does that for every sprite; without
// it only ids the art code gained or lost are touched, so a hand-painted PNG
// dropped into this folder survives an ordinary sync.
const force = process.argv.includes('--force');
// Redraw only a named family without replacing unrelated hand-painted PNGs.
const idsIndex = process.argv.indexOf('--ids');
const selected = idsIndex === -1 ? null : process.argv[idsIndex + 1]?.split(',');
if (idsIndex !== -1 && (!selected?.length || selected.some(id => !id || id.startsWith('--')))) {
  throw new Error('--ids requires a comma-separated list of art IDs');
}

async function loadModule(path) {
  const bundle = await rolldown({ input: resolve(path) });
  try {
    const { output } = await bundle.generate({ format: 'esm', codeSplitting: false });
    return import(`data:text/javascript;base64,${Buffer.from(output[0].code).toString('base64')}`);
  } finally {
    await bundle.close();
  }
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

function png({ w, h, data }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(w, 0);
  header.writeUInt32BE(h, 4);
  header[8] = 8; // 8-bit RGBA
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

const { rasterize } = await loadModule('src/art/raster.ts');
const { ALL_ART, getArt } = await loadModule('src/art/registry.ts');

const listed = JSON.parse(await readFile(resolve(OUT, 'manifest.json'), 'utf8'));
const onDisk = new Set((await readdir(OUT)).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)));
const wanted = ALL_ART.map((d) => d.id);
if (selected?.some(id => !wanted.includes(id))) throw new Error('Unknown art ID in --ids');

const added = wanted.filter((id) => !onDisk.has(id));
const stale = [...onDisk].filter((id) => !wanted.includes(id));
const manifestDrift = JSON.stringify(listed) !== JSON.stringify(wanted);

if (check) {
  const problems = [];
  if (added.length) problems.push(`missing PNGs: ${added.join(', ')}`);
  if (stale.length) problems.push(`orphan PNGs: ${stale.join(', ')}`);
  if (manifestDrift) problems.push('manifest.json does not match ALL_ART');
  for (const id of selected ?? []) {
    if (!onDisk.has(id)) continue;
    const def = ALL_ART.find(d => d.id === id);
    const expected = png(rasterize(def, undefined, getArt));
    if (!(await readFile(resolve(OUT, `${id}.png`))).equals(expected)) problems.push(`${id}: PNG differs from source`);
  }
  if (problems.length) {
    console.error(`public/art is out of date:\n  ${problems.join('\n  ')}\nRun: npm run art:sync`);
    process.exit(1);
  }
  console.log(`public/art is in sync (${wanted.length} sprites).`);
} else {
  // Hand-edited PNGs are the point of this folder, so only ids the art code
  // gained or lost are touched. Everything already present is left alone.
  const write = force ? wanted : [...new Set([...added, ...(selected ?? [])])];
  for (const id of write) {
    const def = ALL_ART.find((d) => d.id === id);
    await writeFile(resolve(OUT, `${id}.png`), png(rasterize(def, undefined, getArt)));
  }
  for (const id of stale) await unlink(resolve(OUT, `${id}.png`));
  await writeFile(resolve(OUT, 'manifest.json'), `${JSON.stringify(wanted, null, 2)}\n`);
  console.log(`public/art: wrote ${write.length}, removed ${stale.length}, manifest lists ${wanted.length}.`);
}
