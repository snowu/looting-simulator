import { ArtDef } from './raster';
import { mirror, rows, stamp, sym } from './helpers';
import { ENEMY_ART_A } from './enemies-a';
import { ENEMY_ART_B } from './enemies-b';
import { ELEMENTAL_VARIANTS } from '../data/elemental-variants';

const originals = [...ENEMY_ART_A, ...ENEMY_ART_B];
const prefixes: Record<string, string> = { skeleton: 'skeleton', skeleton_shield: 'skelshield', spider: 'spider', ghoul: 'ghoul', bat: 'bat', goblin_shield: 'gobshield' };
const coal = { k: '#171112', w: '#8c7267', v: '#57453e', u: '#352b29', r: '#ff8b32fa' };
const rime = { k: '#172c3e', w: '#e4f5fc', v: '#91bbd0', u: '#4e738d', r: '#87d8fffa' };
const ribHeat = rows(`
  .X.X.X.
  XHXHXHX
  .XHXHX.
  XHXHXHX
  .X.X.X.
`);
const iceShoulder = rows(`
  ..H..H....H..
  .HCHHCH..HCH.
  HCCCCCCCCHCCB
  .BCBCBCCBCBB.
  ..B..B..B.B..
`);
// Short frost ridges follow the wing bones; neither overlaps the face or maw.
const batRime = rows(`
  .HC..
  HCCB.
  .B...
`);
// Torso details stay below the collar in BOTH poses. The raised arms do not
// carry the chest crust up beside the head.
const frozenChest = rows(`
  .HC...HC..
  HCCBHCCCB.
  .BCBBCBCB.
  ..B...B...
`);
const moltenChest = rows(`
  .X....X...
  XHX..XHX..
  .XXHXHX...
  ...X..X...
`);
const hotShell = rows(`
  ...X....X...
  ..XHX..XHX..
  .XHXXHXHXX..
  XHX..XHX..X.
`);
const boss = rows(`
  ..XXX..
  .XHHHX.
  XHXXXHX
  XHXHXHX
  XHXXXHX
  .XHHHX.
  ..XXX..
`);
function themed(source: ArtDef, variant: typeof ELEMENTAL_VARIANTS[number], pose: string): ArtDef {
  const hot = variant.element === 'fire';
  let palette = { ...source.palette };
  if (variant.base.startsWith('skeleton')) Object.assign(palette, hot ? coal : rime);
  if (variant.base === 'ghoul') Object.assign(palette, hot
    ? { k: '#170e0d', g: '#644238', h: '#95654a', f: '#392926', y: '#ffb13bfa' }
    : { k: '#142939', g: '#7495aa', h: '#c0dae6', f: '#405f79', y: '#a7e6fffa' });
  if (variant.base === 'spider') Object.assign(palette, { a: '#291817', b: '#52332a', c: '#85513a', d: '#b07448', r: '#ff8c20fa', y: '#ffe9a9fa' });
  if (variant.base === 'bat') Object.assign(palette, { a: '#45627c', b: '#80a9c3', c: '#aecfdf', d: '#e0f1f9', r: '#8ddbfffa', m: '#28465b' });
  if (variant.base === 'goblin_shield') Object.assign(palette, { g: '#739ba3', h: '#abcbd2', f: '#416977', t: '#b0cddc', u: '#51738f', r: '#9ee5fffa', y: '#d3f4fffa' });
  Object.assign(palette, hot ? { X: '#ff7624fa', H: '#ffe5a0fa' } : { X: '#638eac', H: '#f0fbff', C: '#b2d9e9', B: '#537c9b' });
  let pixels = source.rows;
  if (variant.base.includes('shield')) pixels = stamp(pixels, hot ? boss : iceShoulder,
    pose === 'block' ? 10 : 1, pose === 'block' ? 18 : pose === 'atk' ? 17 : 19);
  else if (variant.base === 'spider') pixels = stamp(pixels, hotShell, 10, 6);
  else if (variant.base === 'ghoul') pixels = stamp(pixels, hot ? moltenChest : frozenChest, 11, 17);
  else if (variant.base === 'bat') pixels = stamp(stamp(pixels, batRime, 5, 10), mirror(batRime), 22, 10);
  else pixels = stamp(pixels, hot ? ribHeat : iceShoulder, hot ? 12 : 9, 16);
  return { id: `${variant.sprite}_${pose}`, palette, rows: pixels };
}
const moleHalf = rows(`
  ................
  ................
  ................
  ................
  ................
  ................
  ............kkkk
  ..........kkbbbb
  ........kkbbbccc
  .......kbbbccccc
  ......kbbbcccccc
  .....kbbbcccccbb
  ....kbbbccccbbbb
  ...kbbbccckkbbpp
  ...kbbbcckwwkppp
  ..kbbbbccckkpppp
  ..kbbbbcccckpppp
  .kbbbbbbccckppap
  .kbbbbbbccckpppp
  .kbbbbbccccckkkk
  kbbbbccccccccckw
  kbbbccccccccbbbb
  kbbbcccccccbbbbb
  kbbbccccccbbbbbb
  .kbbccccccbbbbbb
  .kbbbbcccbbbbbbb
  ..kbbbbbbbbbbbbb
  ...kbbbbbbbbbbbb
  ....kkbbbbbbbbbb
  .....kbbbaaakbbb
  ....kwwkwwkkkwww
  ....kkkkkkkkkkkk
`);
// Big digging hands: three thick pale talons, lit on one side, with clear
// gaps between them so they read as claws and not as stripes.
const claw = rows(`
  ..kkbbbbkk..
  .kbbbbbbbbk.
  kbbccccccbbk
  kcccccccccck
  .kcccccccck.
  .kwvkwvkwvk.
  .kwvkwvkwvk.
  .kwvkwvkwvk.
  .kwk.kwk.kwk
  ..w...w...w.
  ............
`);
// The bite under the snout when it lunges.
const moleMouth = rows(`
  kkkkkk
  kwmmwk
  kmmmmk
  .kmmk.
`);
const molePal = { k: '#201712', a: '#423024', b: '#66503b', c: '#937455', p: '#c58b80', w: '#ede0bd', v: '#b8a47e', m: '#4a1410' };
const body = sym(moleHalf);
const raisedArms = Array.from({ length: 32 }, (_, y) => {
  const row = Array.from('.'.repeat(32));
  if (y >= 10 && y <= 23) {
    const x = 3 + Math.floor((y - 10) / 3);
    for (let n = 0; n < 5; n++) row[x + n] = row[31 - x - n] = n === 0 || n === 4 ? 'k' : 'b';
  }
  return row.join('');
});
export const ENEMY_ART_BIOMES: ArtDef[] = [
  ...ELEMENTAL_VARIANTS.flatMap((variant) => ['0', 'atk', ...(variant.base.includes('shield') ? ['block'] : [])].map((pose) => {
    const source = originals.find((a) => a.id === `${prefixes[variant.base]}_${pose}`)!;
    return themed(source, variant, pose);
  })),
  { id: 'mole_0', palette: molePal, rows: stamp(stamp(body, claw, 0, 19), claw, 20, 19) },
  { id: 'mole_block', palette: molePal, rows: stamp(stamp(body, claw, 5, 12), claw, 15, 12) },
  { id: 'mole_atk', palette: molePal, rows: stamp(stamp(stamp(stamp(body, raisedArms), moleMouth, 13, 19), claw, 0, 2), claw, 20, 2) },
];
