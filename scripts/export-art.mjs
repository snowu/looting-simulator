import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { rolldown } from 'rolldown';

const output = resolve(process.argv[2] ?? 'art-handoff');
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
  const { getArt } = await loadModule('src/art/registry.ts');
  const groups = [
    ['textures', 'src/art/textures.ts', 'TEXTURES'],
    ['props', 'src/art/props.ts', 'PROPS'],
    ['icons', 'src/art/icons.ts', 'ICONS'],
    ['ui', 'src/art/ui.ts', 'UI_ART'],
    ['enemies', 'src/art/enemies-a.ts', 'ENEMY_ART_A'],
    ['enemies', 'src/art/enemies-b.ts', 'ENEMY_ART_B'],
    ['enemies', 'src/art/enemies-variety.ts', 'ENEMY_ART_VARIETY'],
    ['enemies', 'src/art/enemies-elemental.ts', 'ENEMY_ART_ELEMENTAL'],
    ['viewmodels', 'src/art/viewmodels.ts', 'VIEWMODELS'],
  ];
  const manifest = [];
  const ids = new Set();
  for (const [folder, modulePath, exportName] of groups) {
    const definitions = (await loadModule(modulePath))[exportName];
    await mkdir(resolve(output, folder), { recursive: true });
    for (const def of definitions) {
      if (ids.has(def.id)) throw new Error(`Duplicate art ID: ${def.id}`);
      ids.add(def.id);
      const image = rasterize(def, undefined, getArt);
      const file = `${folder}/${def.id}.png`;
      await writeFile(resolve(output, file), png(image));
      manifest.push({ id: def.id, file, width: image.w, height: image.h, base: def.base ?? null, recolorable: def.rows.some((row) => /[1-4]/.test(row)) });
    }
  }
  await writeFile(resolve(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(resolve(output, 'README.md'), `# Art handoff\n\nEach PNG is exported at its native resolution with transparency. Edit at this size with nearest-neighbour scaling; keep the filename and canvas dimensions. The manifest maps every file to its in-game art ID. Enemy idle, attack, and block poses are separate files.\n\nTo use a finished image in the game, copy it to \`public/art/<id>.png\` (without the category folder), then add \`"<id>"\` to \`public/art/manifest.json\`. The original code art remains the fallback.\n\nRecolorable icon PNGs retain the game's four-colour material ramp. Keep their exported ramp colors for pixels that should change with material; other colors stay fixed. Alpha 250 marks emissive pixels; preserve it when editing glowing details.\n\nKeep layered editor project files alongside these PNGs if useful. Run \`npm run art:export\` again only when you want a fresh export from the built-in art; it replaces files in this folder.\n`);
  console.log(`Exported ${manifest.length} PNGs to ${output}`);
}
