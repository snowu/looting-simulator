/**
 * Writes the dev art sheets out as PNGs, for a pull request or a handoff.
 *
 * Same sheets, same order and same grouping as the in-game art sheet (F2 in a
 * dev build): both read `src/dev/art-sheets.ts`, so a picture posted on a PR
 * is the picture the game shows. Frames are laid out still — the cadence is
 * what the in-game sheet is for.
 *
 *   npm run art:sheet                       # every sheet, into docs/previews
 *   npm run art:sheet -- melee              # just one
 *   npm run art:sheet -- guard --zoom 9     # close enough to count pixels
 *   npm run art:sheet -- --ids rat_0,rat_atk --out /tmp  # an ad-hoc sheet of any art
 *   npm run art:sheet -- viewmodels --material star_iron  # held weapons as one deciding material
 *   npm run art:sheet -- --pr                          # curated weapon-overhaul PR sheets
 *   npm run art:sheet -- icons --tier 2                   # best material at tier 2
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { rolldown } from 'rolldown';

const BG = [17, 15, 21];
const PAD = 10;
const LABEL_H = 17;
const HEADER_H = 24;

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

// A 5×7 bitmap font: enough for labels, and it keeps the sheet dependency-free.
const GLYPHS = {
  A: '01110100011000111111100011000110001', B: '11110100011000111110100011000111110',
  C: '01110100011000010000100001000101110', D: '11110100011000110001100011000111110',
  E: '11111100001000011110100001000011111', F: '11111100001000011110100001000010000',
  G: '01110100011000010111100011000101111', H: '10001100011000111111100011000110001',
  I: '11111001000010000100001000010011111', J: '00111000100001000010000101001001100',
  K: '10001100101010011000101001001010001', L: '10000100001000010000100001000011111',
  M: '10001110111010110101100011000110001', N: '10001110011010110011100011000110001',
  O: '01110100011000110001100011000101110', P: '11110100011000111110100001000010000',
  Q: '01110100011000110001101011001001101', R: '11110100011000111110101001001010001',
  S: '01111100001000001110000011000111110', T: '11111001000010000100001000010000100',
  U: '10001100011000110001100011000101110', V: '10001100011000110001100010101000100',
  W: '10001100011000110101101011101110001', X: '10001100010101000100010101000110001',
  Y: '10001100010101000100001000010000100', Z: '11111000010001000100010001000011111',
  0: '01110100011001110101110011000101110', 1: '00100011000010000100001000010001110',
  2: '01110100010000100110010001000011111', 3: '11110000010001000110000011000111110',
  4: '00010001100101010010111110001000010', 5: '11111100001111000001000011000101110',
  6: '00110010001000011110100011000101110', 7: '11111000010001000100001000010000100',
  8: '01110100011000101110100011000101110', 9: '01110100011000101111000010001001100',
  '·': '00000000000001100011000000000000000', '.': '00000000000000000000000000110001100',
  '-': '00000000000000011111000000000000000', '_': '00000000000000000000000000000011111',
  ':': '00000001100011000000001100011000000', '/': '00001000010001000100010001000010000',
  "'": '01100011000110000000000000000000000', '!': '00100001000010000100000000001000000',
  ' ': '00000000000000000000000000000000000',
};

function text(buf, W, H, str, px, py, scale, color) {
  let cx = px;
  for (const ch of str.toUpperCase()) {
    const glyph = GLYPHS[ch] ?? GLYPHS[' '];
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 5; x++) {
        if (glyph[y * 5 + x] !== '1') continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const tx = cx + x * scale + sx, ty = py + y * scale + sy;
            if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
            const o = (ty * W + tx) * 4;
            buf[o] = color[0]; buf[o + 1] = color[1]; buf[o + 2] = color[2]; buf[o + 3] = 255;
          }
        }
      }
    }
    cx += 6 * scale;
  }
}

const textWidth = (str, scale) => str.length * 6 * scale;

function blit(buf, W, H, raster, ox, oy, zoom) {
  for (let y = 0; y < raster.h; y++) {
    for (let x = 0; x < raster.w; x++) {
      const s = (y * raster.w + x) * 4;
      const a = raster.data[s + 3];
      if (a === 0) continue;
      // Alpha 250 is the emissive marker, not translucency: draw it full.
      const t = a === 250 ? 1 : a / 255;
      for (let sy = 0; sy < zoom; sy++) {
        for (let sx = 0; sx < zoom; sx++) {
          const tx = ox + x * zoom + sx, ty = oy + y * zoom + sy;
          if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
          const o = (ty * W + tx) * 4;
          buf[o] = raster.data[s] * t + buf[o] * (1 - t);
          buf[o + 1] = raster.data[s + 1] * t + buf[o + 1] * (1 - t);
          buf[o + 2] = raster.data[s + 2] * t + buf[o + 2] * (1 - t);
          buf[o + 3] = 255;
        }
      }
    }
  }
}

function draw(sheet, cells) {
  const cols = sheet.cols;
  const linesOf = (c) => 2 + (c.stats?.length ?? 0);
  const maxLines = Math.max(...cells.map(linesOf));
  const cellW = Math.max(
    Math.max(...cells.map((c) => c.raster.w)) * ZOOM + PAD * 2,
    ...cells.flatMap((c) => [c.cell.label, ...(c.stats ?? [])].map((l) => textWidth(l, 1) + 12)),
  );
  const cellH = Math.max(...cells.map((c) => c.raster.h)) * ZOOM + PAD + LABEL_H * maxLines;
  const rowsOf = sheet.groups.map((g) => Math.ceil(g.cells.length / cols));
  const W = cellW * cols;
  const H = sheet.groups.reduce((a, _, i) => a + HEADER_H + rowsOf[i] * cellH + 6, HEADER_H + 10);
  const buf = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    buf[i * 4] = BG[0]; buf[i * 4 + 1] = BG[1]; buf[i * 4 + 2] = BG[2]; buf[i * 4 + 3] = 255;
  }
  text(buf, W, H, sheet.title, 10, 8, 3, [232, 224, 208]);
  let y = HEADER_H + 10;
  let k = 0;
  sheet.groups.forEach((group, gi) => {
    text(buf, W, H, group.title, 10, y + 4, 2, [154, 192, 255]);
    y += HEADER_H;
    group.cells.forEach((cell, i) => {
      const { raster, stats } = cells[k++];
      const lines = [
        { line: cell.label, color: [224, 216, 200] },
        { line: cell.id, color: [130, 124, 142] },
        ...(stats ?? []).map((line) => ({
          line,
          color: line.includes('WEAK') ? [255, 154, 122]
            : line.startsWith('RES') || line.includes(' RES ') ? [154, 192, 255]
            : [138, 130, 150],
        })),
      ];
      const cx = (i % cols) * cellW, cy = y + Math.floor(i / cols) * cellH;
      blit(buf, W, H, raster,
        cx + Math.round((cellW - raster.w * ZOOM) / 2),
        cy + Math.round((cellH - LABEL_H * maxLines - raster.h * ZOOM) / 2), ZOOM);
      lines.forEach(({ line, color }, li) => {
        // Long creature names get the small font rather than the next cell's space.
        const scale = textWidth(line, 2) <= cellW - 6 ? 2 : 1;
        const clipped = line.slice(0, Math.max(1, Math.floor((cellW - 6) / (6 * scale))));
        text(buf, W, H, clipped, cx + Math.round((cellW - textWidth(clipped, scale)) / 2),
          cy + cellH - LABEL_H * maxLines + li * LABEL_H + (scale === 1 ? 3 : 0),
          scale, color);
      });
    });
    y += rowsOf[gi] * cellH + 6;
  });
  return png({ w: W, h: H, data: buf });
}

const { rasterize } = await loadModule('src/art/raster.ts');
const { getArt } = await loadModule('src/art/registry.ts');
const { sheets, DEFAULT_TIER, creatureStatLines } = await loadModule('src/dev/art-sheets.ts');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const tier = Number(flag('--tier') ?? DEFAULT_TIER);
const material = flag('--material') ?? undefined;
const SHEETS = sheets(tier, material);
const ZOOM = Number(flag('--zoom') ?? 5);
const ids = flag('--ids');
const out = resolve(flag('--out') ?? 'docs/previews');
const values = new Set([flag('--zoom'), ids, flag('--out'), flag('--tier'), flag('--material')]);
const wanted = args.filter((a) => !a.startsWith('--') && !values.has(a));
// PR images use the same cells and material choices as the in-game viewer.
const prSheet = (source, id, title, cols, keep = () => true) => {
  const sheet = SHEETS.find(s => s.id === source);
  return { ...sheet, id, title, cols, groups: sheet.groups
    .map(group => ({ ...group, cells: group.cells.filter(keep) }))
    .filter(group => group.cells.length) };
};
const prIcons = new Set([
  'ic_dagger', 'ic_short_sword', 'ic_long_sword', 'ic_axe', 'ic_mining_pick',
  'ic_mace', 'ic_spear', 'ic_club', 'ic_halberd', 'ic_great_maul', 'ic_greatsword',
  'ic_throwing_knives', 'ic_throwing_axes', 'ic_javelins', 'ic_buckler',
  'ic_kite_shield', 'ic_tower_shield', 'ic_hauberk',
  'ic_sig_wardcry', 'ic_sig_snuff', 'ic_sig_sounding', 'ic_sig_threshold', 'ic_sig_temper',
]);
const prProps = new Set([
  'proj_knife', 'proj_axe_thrown', 'proj_javelin', 'pickup_knives',
  'pickup_axes', 'pickup_javelins', 'ward_threshold', 'ward_threshold_dim',
]);
const chosen = args.includes('--pr') ? [
  prSheet('icons', 'weapons-new-icons', 'Weapon overhaul icons', 6, c => prIcons.has(c.id)),
  prSheet('viewmodels', 'weapons-new-viewmodels', 'Final held art', 6),
  prSheet('props', 'weapons-new-props', 'Thrown weapons and wards', 4, c => prProps.has(c.id)),
] : ids
  ? [{ id: 'scratch', title: 'Scratch', note: '', cols: Math.min(4, ids.split(',').length), groups: [{ title: 'Picked', cells: ids.split(',').map((id) => ({ id: id.trim(), label: id.trim() })) }] }]
  : wanted.length ? SHEETS.filter((s) => wanted.includes(s.id)) : SHEETS;
if (!chosen.length) throw new Error(`No such sheet: ${wanted.join(', ')}. Known: ${SHEETS.map((s) => s.id).join(', ')}`);
await mkdir(out, { recursive: true });
for (const sheet of chosen) {
  const cells = sheet.groups.flatMap((g) =>
    g.cells.map((cell) => {
      const def = getArt(cell.id);
      if (!def) throw new Error(`${sheet.id}: missing art ${cell.id}`);
      // A cell carries the material ramp the game would draw it through, if any.
      // Creature cells also carry the full stat block for the caption.
      return { cell, raster: rasterize(def, cell.ramp, getArt), stats: cell.creature ? creatureStatLines(cell.creature) : [] };
    }),
  );
  const file = resolve(out, `${sheet.id}.png`);
  await writeFile(file, draw(sheet, cells));
  console.log(`${sheet.id}: ${cells.length} frames → ${file}`);
}
