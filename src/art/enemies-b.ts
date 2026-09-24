import { ArtDef } from './raster';
import { fill, rows, stamp, sym } from './helpers';

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
// Wide open, and the light gathers behind it. A wisp is a face made of fire,
// so the only tell it can have is how much of that face is mouth.
const WISP_MAW = rows(`
  ....abbccdkkkkkk
  .....abbcdkkkkkk
  .....abbcdkkkkkk
  .....abbccdkkkkk
`);
const WISP_PAL = { a: '#1a3a8afa', b: '#3a70d0fa', c: '#80c0fffa', d: '#e0f4fffa', e: '#fffffffa', k: '#0a1030' };
// The same light, burning instead of freezing — the trick the archer plays on
// the skeleton, one palette over the shared rows.
const EMBER_PAL = { a: '#6a1606fa', b: '#c8490cfa', c: '#ff9a28fa', d: '#ffe6a8fa', e: '#fffff0fa', k: '#2a0a02' };

// --- Hollow knight -------------------------------------------------------------------
// A great helm: domed crown, one visor slit the eyes burn through, a raised
// ridge down the middle and breath holes punched under it.
const KNIGHT_HALF = rows(`
  ................
  ...........kkkkk
  ..........kdddds
  .........kddcccd
  .........kdcccbd
  .........kccbbbd
  .........kcbbbbd
  .........kckkkkj
  .........kckkrkj
  .........kcbbbbd
  .........kcbkbkd
  .........kcbbbbd
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
// Raised overhead as one connected piece: fist gripping the guard, forearm
// down into the shoulder. The old swing stamped a floating blade while the
// body's arm still hung at its side.
const KNIGHT_RAISED = rows(`
  ....sj...
  ...ssj...
  ...ssj...
  ...ssj...
  ...ssj...
  ...ssj...
  ...ssj...
  ..kjjjk..
  ...khhk..
  ...kcck..
  ...kcck..
  ...kcck..
  ...kcck..
  ...kcck..
  ...kcck..
  ...kcck..
  ..kkcckk.
  ..kcccck.
  ...kkkk..
`);
const KNIGHT_ERASE_RIGHT = fill(7, 13, '_');
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
const KNIGHT_ERASE_LEFT = fill(7, 12, '_');
const KNIGHT_BENT_ARM = rows(`
  kck.....
  kckk....
  kcbck...
  .kcbck..
  ..kcbck.
  ...kkkk.
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
// Both hands up and a gathered ball of fire between them. The old cast frame
// mirrored two small flames to the outside of the body, which is where the
// idle frame already keeps four of them — so the tell was invisible.
const WRAITH_ARMS_UP = rows(`
  ....oo..kdccckkk
  ...oyyokkdcccccc
  ...oywyokdcccccc
  ....oyokdcccccff
  .....okddccdcfcc
`);
const WRAITH_ORB = rows(`
  ...oooo...
  ..oyyyyo..
  .oywwwwyo.
  oywwwwwwyo
  oywwwwwwyo
  oywwwwwwyo
  .oywwwwyo.
  ..oyyyyo..
  ...oooo...
`);
const WRAITH_PAL = { k: '#140604', r: '#7a1a08fa', o: '#d05010fa', y: '#ffa030fa', w: '#fff0a0fa', c: '#2a0e08', d: '#401810', f: '#5a2416' };

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

/**
 * The two inner points of the crown, knocked out. `sym` has already mirrored
 * the sprite by this point, so the break is stamped once across the centre
 * line and takes a spike off each side of it.
 */
const KING_CROWN_BREAK = rows(`
  _.._
  _.._
`);
const KING_LAST_BASE = stamp(KING_BASE, KING_CROWN_BREAK, 22, 3);

/**
 * The shot gathering on the scepter's gem. He is a caster at range, and the
 * raised scepter on its own moved a tenth of his pixels — on a creature that
 * fills half the screen, a tell has to be light, not posture.
 */
const KING_GATHER = rows(`
  ...rrr...
  ..reeer..
  .reeeeer.
  reeeeeeer
  reeeeeeer
  reeeeeeer
  .reeeeer.
  ..reeer..
  ...rrr...
`);

/** A bar of held shadow, emissive so it reads against the dark he made. */
const KING_WARD = rows(`
  .eeeeeeeeeeeeee.
  eeeeeeeeeeeeeeee
  .eeeeeeeeeeeeee.
`);

/**
 * Phase palettes. Same pixels, different light — which is the cheapest way in
 * this engine to make a creature look like it has changed, and the only one
 * that costs no new art. Colours ending `fa` are emissive: they ignore the
 * lighting and the fog, so they are the parts that still show in a black room.
 */
const KING_PAL_DARK = {
  k: '#050308', w: '#3a3630', v: '#2a2822', u: '#1a1814',
  g: '#3a2e12', h: '#5a4820',
  p: '#120826', q: '#1a0c38', r: '#281050', m: '#0a0414',
  e: '#b060fffa', j: '#ff6020fa',
};

const KING_PAL_LAST = {
  k: '#140406', w: '#8a7060', v: '#6a5040', u: '#3a2820',
  g: '#ff8a20', h: '#ffd070',
  p: '#3a0e08', q: '#6a1a0c', r: '#a83a14', m: '#200606',
  e: '#ffb040fa', j: '#ffe060fa',
};

export const ENEMY_ART_B: ArtDef[] = [
  { id: 'ghoul_0', palette: GHOUL_PAL, rows: sym(GHOUL_HALF) },
  { id: 'ghoul_atk', palette: GHOUL_PAL, rows: sym(GHOUL_ATK_HALF) },

  { id: 'wisp_0', palette: WISP_PAL, rows: sym(WISP_HALF) },
  { id: 'wisp_atk', palette: WISP_PAL, rows: sym(stamp(WISP_HALF, WISP_MAW, 0, 15)) },

  { id: 'ember_0', palette: EMBER_PAL, rows: sym(WISP_HALF) },
  { id: 'ember_atk', palette: EMBER_PAL, rows: sym(stamp(WISP_HALF, WISP_MAW, 0, 15)) },

  { id: 'knight_0', palette: KNIGHT_PAL, rows: stamp(stamp(KNIGHT_BASE, GREATSWORD_REST, 25, 19), KNIGHT_SHIELD, 1, 18) },
  { id: 'knight_atk', palette: KNIGHT_PAL, rows: stamp(stamp(stamp(KNIGHT_BASE, KNIGHT_ERASE_RIGHT, 24, 14), KNIGHT_RAISED, 22, 0), KNIGHT_SHIELD, 1, 16) },
  {
    id: 'knight_block',
    palette: KNIGHT_PAL,
    rows: stamp(stamp(stamp(stamp(KNIGHT_BASE, KNIGHT_ERASE_LEFT, 1, 17), KNIGHT_BENT_ARM, 5, 14), KNIGHT_SHIELD, 11, 15), GREATSWORD_REST, 25, 19),
  },

  { id: 'wraith_0', palette: WRAITH_PAL, rows: sym(WRAITH_HALF) },
  // The orb is stamped after the mirror, so there is one of it, in the middle,
  // where a gathered shot belongs.
  { id: 'wraith_atk', palette: WRAITH_PAL, rows: stamp(sym(stamp(WRAITH_HALF, WRAITH_ARMS_UP, 0, 10)), WRAITH_ORB, 11, 14) },

  { id: 'king_0', palette: KING_PAL, rows: stamp(KING_BASE, SCEPTER, 40, 8) },
  { id: 'king_atk', palette: KING_PAL, rows: stamp(stamp(stamp(KING_BASE, SCEPTER, 40, 1), KING_ROAR, 19, 17), KING_GATHER, 39, 0) },

  // The Dark. Same king, drowned: every colour sinks toward the stone and only
  // the eyes and the gem keep their alpha, so once he puts the room out there
  // is nothing left of him but two coals and the light on his scepter.
  { id: 'king_dark_0', palette: KING_PAL_DARK, rows: stamp(KING_BASE, SCEPTER, 40, 8) },
  { id: 'king_dark_atk', palette: KING_PAL_DARK, rows: stamp(stamp(stamp(KING_BASE, SCEPTER, 40, 1), KING_ROAR, 19, 17), KING_GATHER, 39, 0) },

  // The Last Stand. The crown has lost its two inner points and the robe has
  // gone to embers. Bright enough to read against the dark he made.
  { id: 'king_last_0', palette: KING_PAL_LAST, rows: stamp(KING_LAST_BASE, SCEPTER, 40, 8) },
  { id: 'king_last_atk', palette: KING_PAL_LAST, rows: stamp(stamp(stamp(KING_LAST_BASE, SCEPTER, 40, 1), KING_ROAR, 19, 17), KING_GATHER, 39, 0) },
  // The guard. He has no shield, so the tell is the scepter held high and a
  // ward of shadow across his chest — raised-and-silent reads as "up", and the
  // same scepter with the mouth open is the swing landing. The whole phase asks
  // you to read this one difference, so it is drawn, never counted.
  {
    id: 'king_last_block',
    palette: KING_PAL_LAST,
    rows: stamp(stamp(KING_LAST_BASE, SCEPTER, 40, 1), KING_WARD, 17, 22),
  },
];
