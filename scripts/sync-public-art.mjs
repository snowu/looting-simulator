// Keeps public/art in step with the sprites registered in src/art.
//
// public/art/<folder>/<id>.png is the one copy of every sprite: the game ships
// those PNGs, and the artist paints over them in place. A sprite drawn in code
// starts there as a placeholder (its code art, rasterized) and is listed in
// docs/art-todo.md for the artist. Until it is painted, editing its code art
// and running this again refreshes the placeholder (src/art/placeholders.json
// remembers which PNGs are untouched); once painted, the PNG is the real art,
// never written again, and the code grid is only its fallback (and, for
// icons, the material ramp).
//
// Why this exists: `loadArtOverrides()` in src/render/art-cache.ts refuses to
// boot the game if public/art/manifest.json misses an id. Adding a sprite means
// the def, the PNG and the manifest; this script does the last two from the
// first.
//
// Usage: npm run art:sync               add PNGs for new sprites, refresh untouched placeholders whose
//                                       code art changed, drop removed ones, file any that sit in the
//                                       wrong folder, rewrite the manifest
//        npm run art:sync -- --ids a,b  also repaint those from their code art (paints over them!)
//        npm run art:sync -- --force    repaint every PNG from code art (paints over all hand-painted work!)
//        npm run art:check              fail instead of writing (CI), stray alpha included
import { mkdir, readFile, rename, rmdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { GROUPS_FILE, artGroups } from './art-groups.mjs';
import { ART_DIR, TODO, decodePng, encodePng, isPlaceholder, samePixels, isStrayAlpha, loadArt, pixelHash, pngsOnDisk, readManifest, readPlaceholders, writePlaceholders } from './art-lib.mjs';

const check = process.argv.includes('--check');
const force = process.argv.includes('--force');
const idsIndex = process.argv.indexOf('--ids');
const selected = idsIndex === -1 ? null : process.argv[idsIndex + 1]?.split(',');
if (idsIndex !== -1 && (!selected?.length || selected.some((id) => !id || id.startsWith('--')))) {
  throw new Error('--ids requires a comma-separated list of art IDs');
}

const { ALL_ART, artFile, raster } = await loadArt();
const wanted = ALL_ART.map((d) => d.id);
if (selected?.some((id) => !wanted.includes(id))) throw new Error('Unknown art ID in --ids');
const files = wanted.map(artFile);

const { found, twice } = await pngsOnDisk();
const added = wanted.filter((id) => !found.has(id));
const stale = [...found.keys()].filter((id) => !wanted.includes(id));
const misplaced = wanted.filter((id) => found.has(id) && found.get(id) !== artFile(id));
const manifestDrift = JSON.stringify(await readManifest().catch(() => null)) !== JSON.stringify(files);
const groupsJson = `${JSON.stringify(await artGroups({ ALL_ART, artFile }), null, 1)}\n`;
const groupsDrift = (await readFile(GROUPS_FILE, 'utf8').catch(() => '')) !== groupsJson;

// Untouched placeholders whose code art has changed since art:sync wrote them, and what is painted.
const recorded = await readPlaceholders();
const outdated = [], painted = new Set();
for (const id of wanted) {
  if (!found.has(id)) continue;
  const png = decodePng(await readFile(resolve(ART_DIR, found.get(id)))), code = raster(ALL_ART.find((d) => d.id === id));
  if (!isPlaceholder(png, code, recorded[id])) painted.add(id);
  else if (!samePixels(png, code)) outdated.push(id);
}

if (check) {
  const problems = [];
  if (twice.length) problems.push(`the same sprite twice: ${twice.join('; ')}`);
  if (added.length) problems.push(`missing PNGs: ${added.join(', ')}`);
  if (stale.length) problems.push(`orphan PNGs: ${stale.map((id) => found.get(id)).join(', ')}`);
  if (misplaced.length) problems.push(`in the wrong folder: ${misplaced.map((id) => `${found.get(id)} (belongs in ${artFile(id)})`).join(', ')}`);
  if (manifestDrift) problems.push('manifest.json does not match the registry');
  if (groupsDrift) problems.push(`${GROUPS_FILE} (spritewright's Context groups) does not match the game data`);
  if (outdated.length) problems.push(`placeholders older than their code art (art:sync refreshes them): ${outdated.map((id) => found.get(id)).join(', ')}`);
  for (const id of wanted) {
    if (!found.has(id)) continue;
    const img = decodePng(await readFile(resolve(ART_DIR, found.get(id))));
    const code = raster(ALL_ART.find((d) => d.id === id));
    if (img.w !== code.w || img.h !== code.h) problems.push(`${found.get(id)} is ${img.w}×${img.h}; the game expects ${code.w}×${code.h}`);
    let stray = 0;
    for (let i = 3; i < img.data.length; i += 4) if (isStrayAlpha(img.data[i])) stray++;
    if (stray) problems.push(`${found.get(id)}: ${stray} pixel${stray > 1 ? 's' : ''} with stray alpha (run npm run art:alpha -- --fix)`);
    if (selected?.includes(id) && !Buffer.from(await readFile(resolve(ART_DIR, found.get(id)))).equals(encodePng(code))) problems.push(`${id}: PNG differs from its code art`);
  }
  if (problems.length) {
    console.error(`public/art is out of date:\n  ${problems.join('\n  ')}\nRun: npm run art:sync`);
    process.exit(1);
  }
  console.log(`public/art is in sync (${wanted.length} sprites).`);
} else {
  if (twice.length) throw new Error(`The same sprite is in public/art twice, keep one: ${twice.join('; ')}`);
  // Hand-painted PNGs are the point of this folder: only sprites the code gained
  // are written (plus --ids / --force on purpose). Everything else is left alone.
  for (const id of misplaced) {
    await mkdir(dirname(resolve(ART_DIR, artFile(id))), { recursive: true });
    await rename(resolve(ART_DIR, found.get(id)), resolve(ART_DIR, artFile(id)));
  }
  const write = force ? wanted : [...new Set([...added, ...outdated, ...(selected ?? [])])];
  const placeholders = {};
  for (const id of wanted) if (found.has(id) && !painted.has(id)) placeholders[id] = recorded[id];
  for (const id of write) {
    const file = resolve(ART_DIR, artFile(id)), code = raster(ALL_ART.find((d) => d.id === id));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, encodePng(code));
    placeholders[id] = pixelHash(code);
  }
  for (const id of wanted) if (placeholders[id] === undefined && found.has(id) && !painted.has(id)) {
    placeholders[id] = pixelHash(decodePng(await readFile(resolve(ART_DIR, artFile(id)))));
  }
  await writePlaceholders(placeholders);
  for (const id of stale) await unlink(resolve(ART_DIR, found.get(id)));
  for (const e of await readdir(ART_DIR, { withFileTypes: true })) {
    if (e.isDirectory() && !(await readdir(resolve(ART_DIR, e.name))).length) await rmdir(resolve(ART_DIR, e.name));
  }
  await writeFile(resolve(ART_DIR, 'manifest.json'), `${JSON.stringify(files, null, 2)}\n`);
  await writeFile(GROUPS_FILE, groupsJson);
  if (added.length) await listForArtist(added);
  if (outdated.length) console.log(`Refreshed from changed code art: ${outdated.join(', ')}.`);
  console.log(`public/art: wrote ${write.length}, moved ${misplaced.length}, removed ${stale.length}, manifest lists ${wanted.length}.` + (added.length ? ` New placeholders for the artist: ${added.join(', ')} (listed in docs/art-todo.md).` : ''));
}

/** New sprites are placeholders until painted: list them for the artist under today's date, newest first. */
async function listForArtist(ids) {
  const intro = '# Waiting for the artist\n\nNew sprites drawn in code, newest first. Each PNG in `public/art/` is a placeholder rasterized from `src/art/`: paint over it in place, at the same size, then tick it off here. `npm run art:status` shows what is still a placeholder.';
  const text = existsSync(TODO) ? await readFile(TODO, 'utf8') : intro;
  const [title, lead, ...rest] = text.split('\n\n');
  const today = new Date().toISOString().slice(0, 10);
  const block = `## ${today}\n\n${ids.map((id) => { const r = raster(ALL_ART.find((d) => d.id === id)); return `- [ ] \`${artFile(id)}\` (${r.w}×${r.h})`; }).join('\n')}`;
  await writeFile(TODO, [title, lead, block, ...rest].map((p) => p?.trim()).filter(Boolean).join('\n\n') + '\n');
}
