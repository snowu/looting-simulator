import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { rolldown } from 'rolldown';

// Usage:
//   npm run art:handoff            # only art the handoff folder lacks: the rule after drawing new art
//   npm run art:export             # every sprite, replacing the folder (paints over delivered work)
//   node scripts/export-art.mjs [--new] [out-dir]
//
// --new writes a PNG only for an id with no file in the handoff yet, keeps
// every existing file (the artist's delivered work included) untouched, merges
// the manifest, and lists what it added in TODO.md for the artist.
const args = process.argv.slice(2);
const onlyNew = args.includes('--new');
const output = resolve(args.find((a) => !a.startsWith('--')) ?? 'art-handoff');
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

{
  const { rasterize } = await loadModule('src/art/raster.ts');
  const { getArt, ALL_ART } = await loadModule('src/art/registry.ts');
  const groups = [
    ['textures', 'src/art/textures.ts', 'TEXTURES'],
    ['textures', 'src/art/frost-textures.ts', 'FROST_TEXTURES'],
    ['props', 'src/art/props.ts', 'PROPS'],
    ['props', 'src/art/biome-props.ts', 'BIOME_PROPS'],
    ['icons', 'src/art/icons.ts', 'ICONS'],
    ['ui', 'src/art/ui.ts', 'UI_ART'],
    ['enemies', 'src/art/enemies-a.ts', 'ENEMY_ART_A'],
    ['enemies', 'src/art/enemies-b.ts', 'ENEMY_ART_B'],
    ['enemies', 'src/art/enemies-variety.ts', 'ENEMY_ART_VARIETY'],
    ['enemies', 'src/art/enemies-elemental.ts', 'ENEMY_ART_ELEMENTAL'],
    ['enemies', 'src/art/enemies-biomes.ts', 'ENEMY_ART_BIOMES'],
    ['enemies', 'src/art/enemies-pasture.ts', 'ENEMY_ART_PASTURE'],
    ['enemies', 'src/art/spell-fx.ts', 'PENGUIN_ART'],
    ['props', 'src/art/spell-fx.ts', 'SPELL_MARK_ART'],
    ['props', 'src/art/surfaces.ts', 'SURFACE_ART'],
    ['viewmodels', 'src/art/viewmodels.ts', 'VIEWMODELS'],
  ];
  const manifestPath = resolve(output, 'manifest.json');
  const previous = onlyNew && existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : [];
  const manifest = [];
  const ids = new Set();
  const added = [];
  for (const [folder, modulePath, exportName] of groups) {
    const definitions = (await loadModule(modulePath))[exportName];
    await mkdir(resolve(output, folder), { recursive: true });
    for (const def of definitions) {
      if (ids.has(def.id)) throw new Error(`Duplicate art ID: ${def.id}`);
      ids.add(def.id);
      const image = rasterize(def, undefined, getArt);
      const file = `${folder}/${def.id}.png`;
      if (onlyNew && existsSync(resolve(output, file))) {
        manifest.push(previous.find((m) => m.id === def.id) ?? { id: def.id, file, width: image.w, height: image.h, base: def.base ?? null, recolorable: def.rows.some((row) => /[1-4]/.test(row)) });
        continue;
      }
      await writeFile(resolve(output, file), png(image));
      added.push({ id: def.id, file, w: image.w, h: image.h });
      manifest.push({ id: def.id, file, width: image.w, height: image.h, base: def.base ?? null, recolorable: def.rows.some((row) => /[1-4]/.test(row)) });
    }
  }
  const missing = ALL_ART.filter((def) => !ids.has(def.id)).map((def) => def.id);
  if (missing.length) throw new Error(`Art in the registry but not exported (add its module to the groups): ${missing.join(', ')}`);
  await writeFile(resolve(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(resolve(output, 'README.md'), `# Art handoff\n\nEach PNG is exported at its native resolution with transparency. Edit at this size with nearest-neighbour scaling; keep the filename and canvas dimensions. The manifest maps every file to its in-game art ID. Enemy idle, attack, and block poses are separate files.\n\nTo use a finished image in the game, copy it to \`public/art/<id>.png\` (without the category folder), then add \`"<id>"\` to \`public/art/manifest.json\`. The original code art remains the fallback.\n\nRecolorable icon PNGs retain the game's four-colour material ramp. Paint the parts that should change with material in that ramp's greys: the four exported colours, or any shade between them or a little lighter than the lightest, and the game carries each to the same place on the item's material. Colours clearly off that grey line (outlines, warm or coloured details, near-white glints) stay fixed. Alpha 250 marks emissive pixels; preserve it when editing glowing details.\n\nKeep layered editor project files alongside these PNGs if useful. After drawing new art in code, \`npm run art:handoff\` adds only the new sprites here (and lists them in TODO.md), leaving every file already here alone. \`npm run art:export\` re-exports everything and replaces files in this folder, painting over delivered work: use it only on purpose.\n`);
  if (onlyNew) {
    if (added.length) {
      const todo = resolve(output, 'TODO.md');
      const head = existsSync(todo) ? await readFile(todo, 'utf8') : '# Waiting for the artist\n\nNew code-drawn art exported by `npm run art:handoff`, newest first. Each is a placeholder drawn in `src/art/`; paint over it at the same size, then copy it to `public/art/<id>.png` and strike it off here.\n';
      const [title, ...rest] = head.split('\n\n');
      const today = new Date().toISOString().slice(0, 10);
      const block = `## ${today}\n\n${added.map((a) => `- [ ] \`${a.file}\` (${a.w}×${a.h})`).join('\n')}`;
      await writeFile(todo, [title, rest[0], block, ...rest.slice(1)].map((p) => p?.trim()).filter(Boolean).join('\n\n').replace(/\n*$/, '\n'));
    }
    console.log(added.length ? `Added ${added.length} new PNGs to ${output}: ${added.map((a) => a.id).join(', ')}` : `Nothing new: every sprite already has a file in ${output}`);
  } else {
    console.log(`Exported ${manifest.length} PNGs to ${output}`);
  }
}
