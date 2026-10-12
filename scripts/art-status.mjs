// What the artist has painted so far, folder by folder: a PNG that is still the
// placeholder art:sync wrote (src/art/placeholders.json) or identical to its
// code art is a placeholder; anything else has been painted. Usage: npm run art:status [-- --list] [-- --md]
//   --list  also name the placeholders in each folder
//   --md    print a Markdown table (for a PR or an issue)
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ART_DIR, decodePng, isPlaceholder, loadArt, readPlaceholders } from './art-lib.mjs';

const list = process.argv.includes('--list'), md = process.argv.includes('--md');
const { ART_FOLDERS, artFile, raster } = await loadArt();
const recorded = await readPlaceholders();
const rows = [];
for (const [folder, defs] of Object.entries(ART_FOLDERS)) {
  const todo = [];
  for (const def of defs) {
    const png = decodePng(await readFile(resolve(ART_DIR, artFile(def.id))));
    if (isPlaceholder(png, raster(def), recorded[def.id])) todo.push(def.id);
  }
  rows.push({ folder, total: defs.length, painted: defs.length - todo.length, todo });
}
const sum = rows.reduce((a, r) => ({ total: a.total + r.total, painted: a.painted + r.painted }), { total: 0, painted: 0 });
const pct = (r) => `${Math.round((100 * r.painted) / r.total)}%`;
if (md) {
  console.log('| Folder | Painted | Placeholders | Done |\n| --- | ---: | ---: | ---: |');
  for (const r of rows) console.log(`| \`${r.folder}/\` | ${r.painted} | ${r.todo.length} | ${pct(r)} |`);
  console.log(`| **all** | **${sum.painted}** | **${sum.total - sum.painted}** | **${pct(sum)}** |`);
} else {
  for (const r of rows) {
    console.log(`${r.folder.padEnd(11)} ${String(r.painted).padStart(3)} / ${String(r.total).padEnd(3)} painted  ${pct(r).padStart(4)}`);
    if (list && r.todo.length) console.log(`            placeholders: ${r.todo.join(', ')}`);
  }
  console.log(`${'all'.padEnd(11)} ${String(sum.painted).padStart(3)} / ${String(sum.total).padEnd(3)} painted  ${pct(sum).padStart(4)}`);
}
