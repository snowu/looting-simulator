import { ArtDef } from './raster';
import { rows, stamp, sym } from './helpers';

// --- Ghoul -----------------------------------------------------------------------
const GHOUL_HALF = rows(`
  ................
  ................
  ................
  ................
  ................
  ................
  ..........kkkkkk
  .........khhhhhh
  ........khgggggg
  ........kgfkkggg
  ........kgkyykgg
  ........kggkkggg
  ........kfgggggf
  .........kfmmmmm
  .........kfmwmwm
  ......kkkkkfffff
  ....kkhhhhgggggg
  ...khhgggggggggg
  ..khggkggggfgggg
  ..kggk.kgggfgggg
  .khgk..kggfgggff
  .kggk..kgggfgggg
  kgggk..kfggggggf
  kgfk...kffggggff
  kgfk....kkfffkkk
  kgfk.....kgggk..
  kggk.....kfggk..
  kckck....kfggk..
  kc.ck....kffgk..
  .k..k...kgggggk.
  .........kffffk.
  .........kkkkkk.
`);
const GHOUL_ATK_HALF = rows(`
  ................
  ..c.c...........
  ..kckc..........
  ..kggk..........
  ..kggk..........
  ..kggk..........
  ..kgfk....kkkkkk
  ...kgk...khhhhhh
  ...kgfk.khgggggg
  ....kgk.kgfkkggg
  ....kgfkkgkyykgg
  .....kggkggkkggg
  .....kfgkfgggggf
  ......kggkfmmmmm
  ......kgfkfmmmmm
  ......kkkkkfmwmw
  ....kkhhhhgggggg
  ...khhgggggggggg
  ...kkgkggggfgggg
  ......kkgggfgggg
  .......kggfgggff
  .......kgggfgggg
  .......kfggggggf
  .......kffggggff
  ........kkfffkkk
  .........kgggk..
  .........kfggk..
  .........kfggk..
  .........kffgk..
  ........kgggggk.
  .........kffffk.
  .........kkkkkk.
`);
const GHOUL_PAL = { k: '#0c0e0a', g: '#56644e', h: '#76866c', f: '#3a4634', y: '#e8e040fa', m: '#3a0a0a', w: '#d8d0b0', c: '#c8c0a0' };

// --- Frost wisp ----------------------------------------------------------------------
const WISP_HALF = rows(`
  ................
  ................
  ................
  ..............a.
  ...........a..ab
  ..........ab.abb
  ..........abbabc
  .........abbcbcc
  ........abbccccc
  .......abbccccdd
  ......abbcccdddd
  ......abccdddddd
  .....abbccdkkddd
  .....abccddkkddd
  .....abccdddddde
  .....abbccdddddd
  .....abbcccddkdd
  ......abbcccdkkk
  ......abbbcccccc
  .......abbbccccc
  ........aabbbbbc
  .........aaabbbb
  ..........a.aabb
  .............aab
  ..............ab
  ...............a
  ..........a.....
  ................
  ...........a....
  ................
  ................
  ................
`);
const WISP_MAW = rows(`
  .....abbccdkkkkk
  ......abbccdkkkk
  ......abbbcdkkkk
`);
const WISP_PAL = { a: '#1a3a8afa', b: '#3a70d0fa', c: '#80c0fffa', d: '#e0f4fffa', e: '#fffffffa', k: '#0a1030' };

// --- Hollow knight -------------------------------------------------------------------
const KNIGHT_HALF = rows(`
  ................
  ................
  ...........kkkkk
  ..........kdcccc
  .........kdcbbbb
  .........kcbbbbb
  .........kcbkkkk
  .........kcbkkek
  .........kcbkkkk
  .........kcbbbbb
  .........kcbbkbk
  ..........kcbbbb
  ......kkkkkkkkkk
  ....kkddcckbbbbb
  ...kddccbbkttttt
  ..kdccbbbbktuutt
  ..kcbbkbbbkttutt
  ..kcbk.kbbkttttt
  ..kcbk.kbckttutt
  ..kbbk.kbckttttt
  ..kcbk.kcbktuttt
  ..kbbk.kcbkttttt
  ..kjjk.kbbkttutt
  ..kjjk.kkkkttttt
  ...kk...kcbkuuuu
  ........kcbkuuuu
  ........kcbkkkkk
  ........kcbbk...
  ........kcbbk...
  ........kcbbk...
  .......kddcbbk..
  .......kkkkkkk..
`);
const GREATSWORD_DOWN = rows(`
  ....jj....
  ....hh....
  ....hh....
  .kjjjjjjk.
  ....ss....
  ....sd....
  ....ss....
  ....sd....
  ....ss....
  ....sd....
  ....ss....
  ....sd....
  ....ss....
  ....sd....
  ....ss....
  ....sd....
  ....ss....
  .....s....
`);
const GREATSWORD_SWING = rows(`
  ............ds
  ...........ds.
  ..........ds..
  .........ds...
  ........ds....
  .......ds.....
  ......ds......
  .....ds.......
  ....ds........
  ..kjj.........
  ..jhk.........
  .khk..........
  .hh...........
`);
const KNIGHT_PAL = {
  k: '#0a0a0e', a: '#2a2a32', b: '#464652', c: '#6a6a78', d: '#9a9aa8', e: '#60c8fffa',
  t: '#5a1616', u: '#3a0c0c', s: '#b0b0bc', j: '#707080', h: '#4a2a10',
};
const KNIGHT_BASE = sym(KNIGHT_HALF);

// --- Flame wraith ------------------------------------------------------------------
const WRAITH_HALF = rows(`
  ................
  ................
  ...........o....
  ..........oyo...
  ..........oyokkk
  ...........kkccc
  ..........kcdddd
  .........kcddccc
  .........kdcckkk
  .........kdckwyk
  .........kdckkkk
  ........kddckkkk
  ....oo..kdccckkk
  ...oyyokkdcccccc
  ...oywyokdcccccc
  ....oyokddcccccc
  .....okddcccdccc
  ......kdcccccdcc
  ......kdccdccccc
  .....kddcccccdcc
  .....kdcccdccccc
  .....kdccccccdcc
  ....kddcccdccccc
  ....kdcrcccrcccr
  ....krroccroccro
  ...orroyorryorry
  ...oyo.oyo.oyo.y
  ....o...o...o...
  ................
  ................
  ................
  ................
`);
const WRAITH_CAST = rows(`
  ...oooo.kdccckkk
  ..oyyyyokdcccccc
  ..oywwyokdcccccc
  ..oyyyyokdcccccc
  ...oooookddccdcc
`);
const WRAITH_PAL = { k: '#140604', r: '#7a1a08fa', o: '#d05010fa', y: '#ffa030fa', w: '#fff0a0fa', c: '#2a0e08', d: '#401810' };

// --- The Ashen King (48×48) ----------------------------------------------------------
const KING_HALF = rows(`
  ........................
  ........................
  ........................
  ..............k...k...k.
  ..............kgk.kgk.kg
  ..............kgkkkgkkkg
  ..............kghgggghgj
  ..............kggggggggg
  ..............kkkkkkkkkk
  ..............kwwwwwwwww
  .............kwwwwwwwwww
  .............kwvwwwwwwww
  .............kwwwkkkkwww
  .............kwwwkeekwww
  .............kwwwkkkkwww
  .............kvwwwwwwwwk
  ..............kvwwwwwwwk
  ..............kuwkwkwkwk
  ...............kukwkwkwk
  ...............kkkkkkkkk
  ..........kkkkkkkkkkkkkg
  .........kpqqqqqqqqqqkgh
  ........kpqqrqqqqqqqqkgg
  .......kpqqrrqqqqqqqqkkg
  ......kppqqrqqqqqqqqqqkg
  .....kppqqqqqqqqqqqqqqkg
  ....kkpqqqqqqqqqqqqqqqkh
  ...kwwkpqqqqqqqqqqqqqqkg
  ...kwvkpqqqqrqqqqqqqqqkg
  ...kwwkppqqqrqqqqqqqqqkg
  ....kk.kpqqqqqqqqqqqqqkh
  .......kpqqqqqqqqqqqqqkg
  .......kpqqqqqqqqqqqqqkg
  ......kppqqqqqqqqqqqqqkg
  ......kpqqqqrqqqqqqqqqkh
  ......kpqqqqrqqqqqqqqqkg
  .....kppqqqqqqqqqqqqqqkg
  .....kpqqqqqqqqqqqqqqqkg
  .....kpqqqqqqqqqqqqqqqkh
  ....kppqqqqqqrqqqqqqqqkg
  ....kpqqqqqqqrqqqqqqqqkg
  ....kpqqqqqqqqqqqqqqqqkg
  ...kppqqqqqqqqqqqqqqqqkh
  ...kpqqqqqqqqqqqqqqqqqkg
  ...kgggggggggggggggggggg
  ...khghghghghghghghghghg
  ...kkkkkkkkkkkkkkkkkkkkk
  ........................
`);
const SCEPTER = rows(`
  ..kk..
  .kerk.
  .keek.
  ..kk..
  ..gh..
  ..gh..
  ..gh..
  ..gh..
  ..gh..
  ..gh..
  ..gh..
  ..gh..
  ..gh..
  ..gh..
  ..gh..
  ..gh..
  ..gh..
  ..gh..
  ..gh..
  .kwwk.
  .kwvk.
  ..gh..
  ..gh..
  ..gh..
  ..kk..
`);
const KING_ROAR = rows(`
  kuwmmmmmmk
  .kummmmmmk
  .kkwkwkwkk
`);
const KING_PAL = {
  k: '#0a060e', w: '#e0d6c0', v: '#a89c84', u: '#6a604e', g: '#c89a30', h: '#ffd060',
  p: '#3a1a5a', q: '#5a2a8a', r: '#8a4ac0', e: '#c080fffa', j: '#ff4040', m: '#2a0a3a',
};
const KING_BASE = sym(KING_HALF);

export const ENEMY_ART_B: ArtDef[] = [
  { id: 'ghoul_0', palette: GHOUL_PAL, rows: sym(GHOUL_HALF) },
  { id: 'ghoul_atk', palette: GHOUL_PAL, rows: sym(GHOUL_ATK_HALF) },

  { id: 'wisp_0', palette: WISP_PAL, rows: sym(WISP_HALF) },
  { id: 'wisp_atk', palette: WISP_PAL, rows: sym(stamp(WISP_HALF, WISP_MAW, 0, 16)) },

  { id: 'knight_0', palette: KNIGHT_PAL, rows: stamp(KNIGHT_BASE, GREATSWORD_DOWN, 11, 10) },
  { id: 'knight_atk', palette: KNIGHT_PAL, rows: stamp(KNIGHT_BASE, GREATSWORD_SWING, 17, 1) },

  { id: 'wraith_0', palette: WRAITH_PAL, rows: sym(WRAITH_HALF) },
  { id: 'wraith_atk', palette: WRAITH_PAL, rows: sym(stamp(WRAITH_HALF, WRAITH_CAST, 0, 12)) },

  { id: 'king_0', palette: KING_PAL, rows: stamp(KING_BASE, SCEPTER, 40, 8) },
  { id: 'king_atk', palette: KING_PAL, rows: stamp(stamp(KING_BASE, SCEPTER, 40, 1), KING_ROAR, 19, 17) },
];
