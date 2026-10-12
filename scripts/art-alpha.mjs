// Stray alpha in public/art: soft-brush specks (alpha 1-15) and near-opaque
// pixels (245-254 other than 250) that glow by accident, since the game treats
// about 245-252 as emissive. See isStrayAlpha in art-lib.mjs for the rule.
// Usage: npm run art:alpha              list the PNGs that have any
//        npm run art:alpha -- --fix     snap them: specks to clear, the rest to solid
//                                       (or to emissive 250 where the code art glows)
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ART_DIR, decodePng, encodePng, loadArt, strayAlpha } from './art-lib.mjs';

const fix = process.argv.includes('--fix');
const { ALL_ART, artFile, raster } = await loadArt();
let files = 0, pixels = 0;
for (const def of ALL_ART) {
  const path = resolve(ART_DIR, artFile(def.id)), img = decodePng(await readFile(path));
  const n = strayAlpha(img, raster(def), fix);
  if (!n) continue;
  files++; pixels += n;
  if (fix) await writeFile(path, encodePng(img));
  console.log(`${artFile(def.id)}: ${n} pixel${n > 1 ? 's' : ''}${fix ? ' fixed' : ''}`);
}
console.log(files ? `${pixels} stray-alpha pixel${pixels > 1 ? 's' : ''} in ${files} PNG${files > 1 ? 's' : ''}${fix ? ', fixed' : ' (npm run art:alpha -- --fix snaps them)'}.` : 'No stray alpha in public/art.');
