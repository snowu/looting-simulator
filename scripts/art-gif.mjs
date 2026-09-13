/**
 * Animated GIFs of the current attack cadence, for a pull request.
 *
 * Same source of truth as the game: frames come from `src/art/registry.ts`,
 * the pose (which frame + how far the body is thrown) comes from
 * `enemyPose` in `src/render/enemy-pose.ts`, and the loop (idle, guard,
 * wind-up with the red flash, blow, settle) is the same one the dev art
 * sheet (`src/dev/art-sheet.ts`) plays. A still posted from `art-sheet.mjs`
 * and a GIF posted from here cannot disagree about what a creature does.
 *
 *   node scripts/art-gif.mjs                      # melee, ranged, guard, boss
 *   node scripts/art-gif.mjs --sheets melee,boss  # subset
 *   node scripts/art-gif.mjs --zoom 4 --fps 12 --seconds 4 --out docs/previews
 *
 * Frames are written as PNGs with the same dependency-free writer as
 * `art-sheet.mjs`, then assembled with ffmpeg (palettegen + paletteuse, so
 * the flat pixel fills stay clean). ffmpeg must be on PATH.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { rolldown } from 'rolldown';

const BG = [13, 11, 16];
const CELL_BG = [19, 16, 24];
const PAD = 10;
const LABEL_H = 15;
const HEADER_H = 30;
const IDLE = 0.75;
const STAGGER = 0.37;

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
  '+': '00100001000010011111001000010000100',
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

const { rasterize } = await loadModule('src/art/raster.ts');
const { getArt } = await loadModule('src/art/registry.ts');
const { sheets } = await loadModule('src/dev/art-sheets.ts');
const SHEETS = sheets();
const { enemyPose } = await loadModule('src/render/enemy-pose.ts');

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const ZOOM = Number(flag('--zoom') ?? 4);
const FPS = Number(flag('--fps') ?? 12);
const SECONDS = Number(flag('--seconds') ?? 4);
const OUT = resolve(flag('--out') ?? 'docs/previews');
const FRAMES_DIR = resolve(flag('--frames-dir') ?? '/tmp/opencode/art-gif');
const wantedSheets = flag('--sheets');
const values = new Set([flag('--zoom'), flag('--fps'), flag('--seconds'), flag('--out'), flag('--frames-dir'), wantedSheets]);
const positional = args.filter((a) => !a.startsWith('--') && !values.has(a));
const wanted = new Set([...(wantedSheets ? wantedSheets.split(',').map((s) => s.trim()) : []), ...positional]);
const chosen = wanted.size ? SHEETS.filter((s) => wanted.has(s.id)) : SHEETS.filter((s) => ['melee', 'ranged', 'guard', 'boss'].includes(s.id));
if (!chosen.length) throw new Error(`No such sheet: ${[...wanted].join(', ')}`);
await mkdir(OUT, { recursive: true });
await mkdir(FRAMES_DIR, { recursive: true });

const poseBase = (c) => ({ hasShield: c.hasShield, ranged: c.ranged, windup: c.windup, recovery: c.recovery });
const cycleOf = (c) => IDLE + (c.hasShield ? 0.8 : 0) + c.windup + c.recovery;

/** One cell per creature when playing — the same dedupe the sheet uses. */
function creaturesOf(sheet) {
  const seen = new Set();
  const out = [];
  for (const g of sheet.groups) {
    for (const cell of g.cells) {
      if (!cell.creature) continue;
      if (seen.has(cell.creature.sprite)) continue;
      seen.add(cell.creature.sprite);
      out.push(cell.creature);
    }
  }
  return out;
}

function rasterOf(id) {
  const def = getArt(id);
  if (!def) throw new Error(`missing art ${id}`);
  return rasterize(def, undefined, getArt);
}

/**
 * The sheet's own loop: idle, guard if it has one, the wind-up with the red
 * flash, the blow, the settle. Poses come from `enemyPose`, so this is the
 * cadence the dungeon draws.
 */
function poseAt(c, t, offset) {
  const guardFor = c.hasShield ? 0.8 : 0;
  const cycle = cycleOf(c);
  const at = (t + offset) % cycle;
  if (at < IDLE) return { pose: enemyPose({ ...poseBase(c), ai: 'chase', timer: 0, sinceStrike: Infinity }), windingUp: false };
  if (at < IDLE + guardFor)
    return { pose: enemyPose({ ...poseBase(c), ai: 'chase', timer: 0, sinceStrike: Infinity, guard: 'up' }), windingUp: false };
  if (at < IDLE + guardFor + c.windup)
    return {
      pose: enemyPose({ ...poseBase(c), ai: 'windup', timer: IDLE + guardFor + c.windup - at, sinceStrike: Infinity }),
      windingUp: true,
    };
  const since = at - (IDLE + guardFor + c.windup);
  return {
    pose: enemyPose({ ...poseBase(c), ai: 'recover', timer: c.recovery - since, sinceStrike: since }),
    windingUp: false,
  };
}

for (const sheet of chosen) {
  const creatures = creaturesOf(sheet);
  // Pre-rasterise every frame each creature can show, once.
  const rasters = new Map();
  for (const c of creatures) {
    for (const frame of c.hasShield ? ['0', 'atk', 'block'] : ['0', 'atk']) {
      const id = `${c.sprite}_${frame}`;
      if (!rasters.has(id)) rasters.set(id, rasterOf(id));
    }
  }
  const cols = sheet.cols;
  const rows = Math.ceil(creatures.length / cols);
  const stageH = Math.max(...[...rasters.values()].map((r) => r.h)) * ZOOM;
  const stageW = Math.max(...[...rasters.values()].map((r) => r.w)) * ZOOM;
  const cellW = Math.max(stageW + PAD * 2, ...creatures.map((c) => textWidth(c.name, 1) + 12));
  const cellH = stageH + PAD + LABEL_H * 2 + 6;
  const W = cellW * cols;
  const H = HEADER_H + 8 + rows * cellH + 8;
  const N = Math.round(FPS * SECONDS);

  for (let f = 0; f < N; f++) {
    const t = f / FPS;
    const buf = new Uint8ClampedArray(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      buf[i * 4] = BG[0]; buf[i * 4 + 1] = BG[1]; buf[i * 4 + 2] = BG[2]; buf[i * 4 + 3] = 255;
    }
    text(buf, W, H, sheet.title, 10, 8, 2, [232, 224, 208]);
    creatures.forEach((c, i) => {
      const cx = (i % cols) * cellW, cy = HEADER_H + 8 + Math.floor(i / cols) * cellH;
      for (let y = 0; y < cellH; y++) {
        for (let x = 0; x < cellW; x++) {
          const o = ((cy + y) * W + cx + x) * 4;
          buf[o] = CELL_BG[0]; buf[o + 1] = CELL_BG[1]; buf[o + 2] = CELL_BG[2]; buf[o + 3] = 255;
        }
      }
      const { pose, windingUp } = poseAt(c, t, i * STAGGER);
      const raster = rasters.get(`${c.sprite}_${pose.frame}`);
      // Toward the player is toward the screen on a flat sheet: the creature
      // grows off its own feet instead of sliding sideways.
      const scale = (1 + pose.lunge * 0.34) * ZOOM;
      const dw = Math.max(1, Math.round(raster.w * scale));
      const dh = Math.max(1, Math.round(raster.h * scale));
      const bob = c.floats ? Math.round((Math.sin(t * 2.5 + i * STAGGER) * 4 * ZOOM) / 3) : 0;
      const ox = cx + Math.round((cellW - dw) / 2);
      const oy = cy + stageH - dh + bob;
      // The red wash the renderer paints over a wind-up: (1, 0.2, 0.1) at
      // 0.12–0.24 alpha, pulsing at 30 rad/s.
      const a = windingUp ? 0.12 + 0.12 * Math.sin(t * 30) : 0;
      for (let dy = 0; dy < dh; dy++) {
        const sy = Math.min(raster.h - 1, Math.floor((dy / dh) * raster.h));
        for (let dx = 0; dx < dw; dx++) {
          const sx = Math.min(raster.w - 1, Math.floor((dx / dw) * raster.w));
          const s = (sy * raster.w + sx) * 4;
          const alpha = raster.data[s + 3];
          if (alpha === 0) continue;
          const tx = ox + dx, ty = oy + dy;
          if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
          const o = (ty * W + tx) * 4;
          const tt = alpha === 250 ? 1 : alpha / 255;
          let r = raster.data[s] * tt + buf[o] * (1 - tt);
          let g = raster.data[s + 1] * tt + buf[o + 1] * (1 - tt);
          let b = raster.data[s + 2] * tt + buf[o + 2] * (1 - tt);
          if (a > 0) {
            r = r * (1 - a) + 255 * a;
            g = g * (1 - a) + 51 * a;
            b = b * (1 - a) + 26 * a;
          }
          buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = 255;
        }
      }
      const label = c.name.slice(0, Math.max(1, Math.floor((cellW - 6) / 6)));
      text(buf, W, H, label, cx + Math.round((cellW - textWidth(label, 1)) / 2), cy + stageH + PAD, 1,
        windingUp ? [255, 150, 130] : [224, 216, 200]);
      const sub = `${c.windup}s + ${c.recovery}s`;
      text(buf, W, H, sub, cx + Math.round((cellW - textWidth(sub, 1)) / 2), cy + stageH + PAD + LABEL_H, 1, [130, 124, 142]);
    });
    await writeFile(resolve(FRAMES_DIR, `${sheet.id}-f${String(f).padStart(3, '0')}.png`), png({ w: W, h: H, data: buf }));
  }

  const framePattern = resolve(FRAMES_DIR, `${sheet.id}-f%03d.png`);
  const palette = resolve(FRAMES_DIR, `${sheet.id}-palette.png`);
  const gif = resolve(OUT, `${sheet.id}.gif`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(FPS), '-i', framePattern, '-vf', 'palettegen', palette]);
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-framerate', String(FPS), '-i', framePattern, '-i', palette,
    '-lavfi', 'paletteuse=dither=bayer:bayer_scale=4',
    gif,
  ]);
  console.log(`${sheet.id}: ${creatures.length} creatures, ${N} frames → ${gif}`);
}
