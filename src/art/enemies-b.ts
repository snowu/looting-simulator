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
  .c.c.c..........
  .khghk..........
  .khggk..........
  .khggk..........
  ..khggk.........
  ..khggk...kkkkkk
  ..khggk..khhhhhh
  ...khggk.khggggg
  ...khggkkgfkkggg
  ....khggkgkyykgg
  .....khgkggkkggg
  .....khgkfgggggf
  ......khgkfmmmmm
  ......khgkfmmmmm
  ......khkkkfmwmw
  ......kkhhhggggg
  ......khhhgggggg
  ......kkggggfggg
  ......kkgggfgggg
  ......kkggfgggff
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
// The same light, burning instead of freezing — the trick the archer plays on
// the skeleton, one palette over the shared rows.
const EMBER_PAL = { a: '#6a1606fa', b: '#c8490cfa', c: '#ff9a28fa', d: '#ffe6a8fa', e: '#fffff0fa', k: '#2a0a02' };

// --- Hollow knight -------------------------------------------------------------------
const KNIGHT_HALF = rows(`
  ................
  ................
  ..........kkkkkk
  .........kdddccc
  .........kdccbbb
  .........kcbbbbb
  .........kcbbbbb
  .........kckkkkk
  .........kckkrkk
  .........kckkkkk
  .........kcbbkkb
  .........kcbbbbb
  ....kkkkkkkkkkkk
  ...kdddddddcckbb
  ..kddccccbkttttt
  ...kccbbbbktuutt
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
// Held point-down at his right side, hilt inside the fist — the two blank rows
// are the gauntlet showing through, so the grip reads as gripped rather than
// painted over the hand. The old idle sword
// hung straight down the centre of the sprite with its guard at the collarbone
// and both hands empty, so it read as a blade through the chest.
const GREATSWORD_REST = rows(`
  ..jj..
  ..hh..
  ..hh..
  kjjjjk
  .ksdk.
  .ksdk.
  .ksdk.
  .ksdk.
  .ksdk.
  .ksdk.
  .ksdk.
  .ksdk.
  .ksdk.
  ..kk..
`);
// Raised overhead with a real blade behind it: the old swing frame was a
// one-pixel diagonal that read as an antenna rather than a sword.
const GREATSWORD_SWING = rows(`
  ............kss
  ...........kssd
  ..........kssdk
  .........kssdk.
  ........kssdk..
  .......kssdk...
  ......kssdk....
  .....kssdk.....
  ....kjjjjk.....
  ...kkhhkk......
  ...khhk........
  ..kjjk.........
  ..kkk..........
`);
const KNIGHT_PAL = {
  k: '#0a0a0e', a: '#2a2a32', b: '#464652', c: '#6a6a78', d: '#9a9aa8', e: '#ff3830fa', r: '#ff3830fa',
  t: '#5a1616', u: '#3a0c0c', s: '#b0b0bc', j: '#707080', h: '#4a2a10',
};
// Steel heater on the left forearm in idle, braced aside for the swing, and
// swept center for the guard — the same arm bent across, like the lesser
// shieldbearers.
const KNIGHT_SHIELD = rows(`
  ..kkk..
  .kccck.
  kccddck
  kcdjdck
  kcdsdck
  kcdjdck
  kccddck
  .kccck.
  ..kkk..
`);
const KNIGHT_ERASE_LEFT = rows(`
  _______
  _______
  _______
  _______
  _______
  _______
  _______
  _______
  _______
  _______
  _______
  _______
`);
const KNIGHT_BENT_ARM = rows(`
  .....kk..........
  .....kcck........
  ......kcck.......
  .......kcck......
  .......kcckk.....
  ........kcck.....
  .........kkk.....
  ..........k......
`);
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
  ..............kggjgggkgg
  ..............kkkkkkkkkk
  ..............kwwwwwwwww
  .............kwwwwwwwwww
  .............kwvwwwwwwww
  .............kvvvkkkkwww
  .............kwwweeekwww
  .............kwwwkkkkwww
  .............kvwwwwwwwwk
  ..............kvwwwwwwwk
  ..............kuwkwkwkwk
  ...............kukwkwkwk
  ...............kkkkkkkkk
  ..........kwwwwwwwwwwwkg
  .........kvvwwwwwwwqqkgh
  ........kpqprqqqqqqqpkgg
  .......kpqprrqqqqqqppkkg
  ......kppqprqqqqqqqppqkg
  .....kppqpqrqqqqqqppqqkg
  ....kkpqqqqqqqqqqqqqqqkh
  ...kwwkgpqqqqqqqppqqqqkg
  ...kwvkgpqprqqqqppqqqqkg
  ...kwwkgppqprqqqppqqqqkg
  ....kk.kpqqqqqqqqqqqqqkh
  .......kpqpqqqqqqqppqqkg
  .......kpqpqqqqqqqppqqkg
  ......kppqpqrqqqqppqqqkg
  ......kpqpqrqqqqqppqqqkh
  ......kpqpqrqqqqqppqqqkg
  .....kppqpqrqqqqppqqqqkg
  .....kpqpqqqqqqqppqqqqkg
  .....kpqpqqqqqqqppqqqqkh
  ....kppqpqqrqqqppqqqqqkg
  ....kpqpqqqrqqqppqqqqqkg
  ....kpqpqqqqqqqppqqqqqkg
  ...kppqpqqqqqqqppqqqqqkh
  ...kpqpqqqqqqqqppqqqqqkg
  ...kgggggggggggggggggggg
  ...khghghghghghghghghghg
  ...kkkkkkkkkkkkkkkkkkkkk
  ........................
`);
const SCEPTER = rows(`
  ..kkkk..
  .kreeek.
  kreeeeek
  krewemer
  kreeeeek
  .kreeek.
  ..kkkk..
  .kghhk..
  .kghhk..
  .kghhk..
  .kghhk..
  .kghhk..
  .kghhk..
  .kghhk..
  .kghhk..
  .kghhk..
  .kghhk..
  .kghhk..
  .kghhk..
  .kwwk...
  .kwvk...
  .kghhk..
  .kghhk..
  .kghhk..
  ..kkk...
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

  { id: 'ember_0', palette: EMBER_PAL, rows: sym(WISP_HALF) },
  { id: 'ember_atk', palette: EMBER_PAL, rows: sym(stamp(WISP_HALF, WISP_MAW, 0, 16)) },

  { id: 'knight_0', palette: KNIGHT_PAL, rows: stamp(stamp(KNIGHT_BASE, GREATSWORD_REST, 25, 19), KNIGHT_SHIELD, 1, 18) },
  { id: 'knight_atk', palette: KNIGHT_PAL, rows: stamp(stamp(KNIGHT_BASE, GREATSWORD_SWING, 17, 1), KNIGHT_SHIELD, 1, 16) },
  {
    id: 'knight_block',
    palette: KNIGHT_PAL,
    rows: stamp(stamp(stamp(stamp(KNIGHT_BASE, KNIGHT_ERASE_LEFT, 1, 17), KNIGHT_BENT_ARM, 0, 13), KNIGHT_SHIELD, 12, 13), GREATSWORD_REST, 25, 19),
  },

  { id: 'wraith_0', palette: WRAITH_PAL, rows: sym(WRAITH_HALF) },
  { id: 'wraith_atk', palette: WRAITH_PAL, rows: sym(stamp(WRAITH_HALF, WRAITH_CAST, 0, 12)) },

  { id: 'king_0', palette: KING_PAL, rows: stamp(KING_BASE, SCEPTER, 40, 8) },
  { id: 'king_atk', palette: KING_PAL, rows: stamp(stamp(KING_BASE, SCEPTER, 40, 1), KING_ROAR, 19, 17) },
];
