import { ArtDef } from './raster';
import { rows, stamp, sym } from './helpers';

// Front-facing 32×32 enemy sprites, feet on the bottom row. Each enemy has an
// idle frame (`<id>_0`) and an attack/telegraph frame (`<id>_atk`).
// Glowing eyes are emissive ('fa' alpha) so they read in the dark.

// --- Giant rat ---------------------------------------------------------------
const RAT_HALF = rows(`
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  ......kkk.......
  .....kbpbk......
  .....kppbk......
  .....kbpbk..kkkk
  ......kbkkkkbbbb
  .......kbbbbbbbc
  ......kbbbbbbbcc
  ......kbbccbbbcc
  .....kbbcrrkbbcc
  .....kbbcrwkbbbc
  .....kbbbkkbbbbb
  ..kkkkbbbbbbbbbb
  .kbbbbkbbbbbbbbc
  kbbbbbbkbbbbbbcc
  kbbbbbbbkbbbbccp
  kbbcbbbbckbbbckk
  kabbbbbbbckbbbkw
  kaabbbbbbbkbbbkw
  kaaabbbbbbbkkkkk
  .kaaabbbbbbbbbbb
  .kaaaabbbbbbbbbb
  ..kaaaakbbkaaaaa
  ...kkkkpkpkkkkkk
  ......kkkkk.....
`);
const RAT_BITE = rows(`
  kbbcbbbbckbbkkkk
  kabbbbbbbckbkwkm
  kaabbbbbbbkbkmmm
  kaaabbbbbbbkkwkm
  .kaaabbbbbbbkkkk
`);
const RAT_PAL = { k: '#140e0c', a: '#3a2c24', b: '#5e4a3c', c: '#7e6654', p: '#c88080', r: '#ff3020fa', w: '#f0e8d8', m: '#6a0c0c' };

// --- Goblin cutpurse ---------------------------------------------------------
const GOBLIN_HALF = rows(`
  ................
  ................
  ................
  ................
  ...........kkkkk
  ..........kttttt
  .........kttuuuu
  ........kttukkkk
  kk......ktukgggg
  khkk....ktkggggg
  .khgkk..ktkgfggg
  .khhggkkkkgfrrgg
  ..khggggggggyrgg
  ...kkhggggggggfg
  .....kkgggggggkk
  .......kggggkwkw
  .......kfgggkkkk
  ......kttkkfgggg
  .....ktttuukkkkk
  ....kgtttuuttttt
  ...kggkttuutttut
  ...kgfkttuuttttt
  ...kgfktuuutttut
  ...khgkuuuuttttt
  ...kggkkuuuuuuuu
  ....kk.kuuuukkkk
  .........kffgk..
  .........kfggk..
  .........kfggk..
  ........kuuuuk..
  ........kuuuuuk.
  ........kkkkkkk.
`);
const GOBLIN_DAGGER = rows(`
  .ws.
  .ws.
  .ws.
  .ws.
  .ws.
  .ws.
  .ws.
  kjjk
  kggk
  .kk.
`);
const GOBLIN_RAISED = rows(`
  ...ws.
  ...ws.
  ...ws.
  ...ws.
  ...ws.
  ..kjjk
  ..kggk
  ..kgk.
  ..kgk.
  .kgk..
  .kgk..
  .kgk..
  kgk...
  kgk...
  kgk...
  kk....
`);
const ERASE_3x7 = rows(`
  ___
  ___
  ___
  ___
  ___
  ___
  ___
`);
const GOBLIN_SHRIEK = rows(`
  kwmmmmwk
  kkwmmwkk
`);
const GOBLIN_PAL = {
  k: '#120e08', g: '#5a7a30', h: '#7a9a40', f: '#3a5020', r: '#ff4020fa', y: '#ffd040fa',
  t: '#6a4424', u: '#44280f', w: '#e8e0c0', s: '#a0a0aa', j: '#6a6a74', m: '#4a0808',
};
const GOBLIN_BASE = sym(GOBLIN_HALF);

// --- Skeleton ----------------------------------------------------------------
const SKELETON_HALF = rows(`
  ................
  ................
  ................
  ...........kkkkk
  ..........kwwwww
  .........kwwwwww
  .........kwvwwww
  .........kwkkkvw
  .........kwkrkvw
  .........kvwwwwk
  ..........kvwwww
  ...........kwkwk
  ............kkkv
  ........kkkkkvvv
  .......kwwwwkkkv
  ......kvkkwwkvwv
  ......kwk.kwkkkv
  ......kwk.kvwwwv
  ......kwk.kkkkkv
  ......kvk.kvwwwv
  ......kwk..kkkkv
  ......kwk..kvwwk
  ......kvk.kvwwwk
  .....kwwk.kkkkkk
  .....kkkk..kvk..
  ...........kwk..
  ...........kwk..
  ...........kvk..
  ...........kwk..
  ..........kwwk..
  ..........kvwwk.
  ..........kkkkk.
`);
const SKELETON_SWORD = rows(`
  ..ws..
  ..ws..
  ..wq..
  ..ws..
  ..ws..
  ..ws..
  ..qs..
  ..ws..
  ..ws..
  ..ws..
  ..ws..
  ..ws..
  ..ws..
  ..js..
  kjjjjk
  .khhk.
  .kwwk.
  ..kk..
`);
const SKELETON_RAISED = rows(`
  ....ws..
  ....ws..
  ....wq..
  ....ws..
  ....ws..
  ....ws..
  ....ws..
  ...kjjk.
  ...khhk.
  ...kwwk.
  ...kwk..
  ..kwk...
  ..kwk...
  .kwk....
  .kwk....
`);
const ERASE_4x11 = rows(`
  ____
  ____
  ____
  ____
  ____
  ____
  ____
  ____
  ____
  ____
  ____
`);
const SKELETON_PAL = {
  k: '#0e0c0a', w: '#e2d9c2', v: '#aa9e84', u: '#6e6452', r: '#ff5030fa',
  s: '#8a8a94', q: '#7a4a2a', j: '#5a5a64', h: '#5a3a1a',
};
const SKELETON_BASE = sym(SKELETON_HALF);

// --- Skeleton archer -----------------------------------------------------------
const BOW_SIDE = rows(`
  ...kh
  ..khl
  ..khl
  .kh.l
  .kh.l
  kh..l
  kh..l
  kg..l
  kg..l
  kh..l
  kh..l
  .kh.l
  .kh.l
  ..khl
  ..khl
  ...kh
`);
const BOW_DRAWN = rows(`
  ..hh..
  ..hh..
  ..hh..
  ..hh..
  ..hh..
  ..hh..
  ..hh..
  .kssk.
  kswwsk
  .kssk.
  ..hh..
  ..hh..
  ..hh..
  ..hh..
  ..hh..
  ..hh..
  ..hh..
`);
const ARCHER_PAL = { ...SKELETON_PAL, h: '#6a4424', g: '#e2d9c2', l: '#d8d0c0', s: '#b0b0ba', w: '#fff4d0fa' };

// --- Cave spider ---------------------------------------------------------------
const SPIDER_HALF = rows(`
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  ................
  ..k.............
  ..kk............
  ...kk.......kkkk
  ....kk....kkbbbb
  .kk..kk..kbbcbbb
  ..kk..kkkbbbbbbb
  ...kkk.kbbbcbbbc
  kk...kkkbbbbbbbb
  .kkk..kbbbkkkbbb
  ...kkkkbbkrrrkbb
  ......kbbkryrkkk
  kkkk..kbbbkkkkrr
  ...kkkkbbbbbbkyr
  ......kbbbbbbbkk
  ..kkkkkkbbbbbbbb
  .kk....kkbbbbbkf
  kk.......kkbbkff
  k.......kk.kkk.f
  .......kk.......
  ......kk........
  .....kk.........
  ................
  ................
  ................
`);
const SPIDER_LUNGE = rows(`
  ..k.............
  ..kk............
  ...kk.......kkkk
  ....kk....kkbbbb
  .kk..kk..kbbcbbb
  ..kk..kkkbbbbbbb
  ...kkk.kbbbcbbbc
  kk...kkkbbbbbbbb
  .kkk..kbbbkkkbbb
  ...kkkkbbkrrrkbb
  ......kbbkryrkkk
  kkkk..kbbbkkkkrr
  ...kkkkbbbbbbkyr
  ......kbbbbbbbkk
  ..kkkkkkbbbbbbbb
  .kk....kkbbbbbkf
  kk.......kkbbkff
  k.......kk.kkkff
  .......kk....kff
  ......kk......kf
`);
const SPIDER_PAL = { k: '#0e0a0c', a: '#2a1c22', b: '#44303a', c: '#644a56', r: '#ff2a2afa', y: '#ffb0a0fa', f: '#d8d0c0' };

export const ENEMY_ART_A: ArtDef[] = [
  { id: 'rat_0', palette: RAT_PAL, rows: sym(RAT_HALF) },
  { id: 'rat_atk', palette: RAT_PAL, rows: sym(stamp(RAT_HALF, RAT_BITE, 0, 23)) },

  { id: 'goblin_0', palette: GOBLIN_PAL, rows: stamp(GOBLIN_BASE, GOBLIN_DAGGER, 28, 15) },
  {
    id: 'goblin_atk',
    palette: GOBLIN_PAL,
    rows: stamp(stamp(stamp(GOBLIN_BASE, ERASE_3x7, 26, 19), GOBLIN_RAISED, 25, 3), GOBLIN_SHRIEK, 12, 15),
  },

  { id: 'skeleton_0', palette: SKELETON_PAL, rows: stamp(SKELETON_BASE, SKELETON_SWORD, 23, 8) },
  { id: 'skeleton_atk', palette: SKELETON_PAL, rows: stamp(stamp(SKELETON_BASE, ERASE_4x11, 23, 14), SKELETON_RAISED, 20, 0) },

  { id: 'archer_0', palette: ARCHER_PAL, rows: stamp(SKELETON_BASE, BOW_SIDE, 2, 8) },
  { id: 'archer_atk', palette: ARCHER_PAL, rows: stamp(SKELETON_BASE, BOW_DRAWN, 13, 6) },

  { id: 'spider_0', palette: SPIDER_PAL, rows: sym(SPIDER_HALF) },
  { id: 'spider_atk', palette: SPIDER_PAL, rows: sym(stamp(SPIDER_HALF, SPIDER_LUNGE, 0, 4)) },
];
