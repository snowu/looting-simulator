import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error pngjs ships no types; it decodes any PNG a painting program writes (filters, palettes)
import { PNG } from 'pngjs';
import { ALL_ART, ART_FOLDERS, artFile } from '../art/registry';

// public/art/<folder>/<id>.png is the one copy of every sprite: what the game
// ships and what the artist paints over (CONTRIBUTING.md, "Art"). These guard
// the layout that `npm run art:sync` keeps and the alpha rule in art-lib.mjs.
const artDir = resolve('public/art');
const pngs = (dir: string, prefix = ''): string[] =>
  readdirSync(resolve(artDir, dir), { withFileTypes: true }).flatMap((e: { name: string; isDirectory(): boolean }) =>
    e.isDirectory() ? pngs(`${dir}${e.name}/`, `${prefix}${e.name}/`) : e.name.endsWith('.png') ? [`${prefix}${e.name}`] : [],
  );

describe('public/art', () => {
  it('puts every registered sprite in exactly one folder', () => {
    const inFolders = Object.values(ART_FOLDERS).flat().map((d) => d.id);
    expect(new Set(inFolders).size).toBe(inFolders.length);
    expect([...inFolders].sort()).toEqual(ALL_ART.map((d) => d.id).sort());
  });

  it('lists every sprite in the manifest by its path, in registry order (run npm run art:sync)', () => {
    expect(JSON.parse(readFileSync(resolve(artDir, 'manifest.json'), 'utf8'))).toEqual(ALL_ART.map((d) => artFile(d.id)));
  });

  it('holds exactly those PNGs: nothing missing, nothing extra, nothing loose at the top (run npm run art:sync)', () => {
    expect(pngs('').sort()).toEqual(ALL_ART.map((d) => artFile(d.id)).sort());
  });

  it('has no stray alpha: no soft-brush specks or accidental glow (run npm run art:alpha -- --fix)', () => {
    const stray = (a: number) => (a >= 1 && a <= 15) || (a >= 245 && a <= 254 && a !== 250);
    const bad = ALL_ART.map((d) => artFile(d.id)).filter((f) => {
      const { data } = PNG.sync.read(readFileSync(resolve(artDir, f))) as { data: Uint8Array };
      for (let i = 3; i < data.length; i += 4) if (stray(data[i])) return true;
      return false;
    });
    expect(bad).toEqual([]);
  });
});
