import { ArtDef } from './raster';
import { fill, rows, stamp, sym } from './helpers';

/**
 * The Forbidden Pasture's herd.
 *
 * Drawn head-on like everything else in the dungeon, which for cattle means a
 * broad face, a wet muzzle low in the frame, and a body that is mostly
 * shoulder. The hide is the one thing doing the work at a distance: hard
 * black patches on white, no dithering, so a cow reads as a cow across a dark
 * room at 320×240.
 *
 * One body serves the whole herd. A calf is the same drawing at half scale, a
 * bull is the same drawing with horns and a darker hide, and the Prize Bull is
 * the bull wearing a rosette. Three creatures, one set of rows.
 */

const COW_PAL: Record<string, string> = {
  k: '#171418', // outline
  w: '#ece8e0', // hide, lit
  b: '#c4beb4', // hide
  c: '#8e8884', // hide in shadow
  x: '#242028', // the hard patches
  y: '#423c48', // a patch catching the light
  o: '#c87888', // inside of the ear
  p: '#e09aa6', // muzzle
  q: '#b8707e', // muzzle in shadow
  n: '#5a2432', // nostril
  m: '#8a3848', // tongue
  e: '#0c0a0e', // eye
  s: '#f4f0e8', // the wet shine on it
  h: '#3a3038', // hoof
};

/**
 * Left half, mirrored. A long skull narrowing to a muzzle that flares back
 * out, ears straight out to the sides, eyes on the edges of the head where a
 * grazing animal keeps them. The shoulders show either side of the face and
 * two front legs come down under them, so the thing stands on the floor
 * instead of hovering like a totem.
 */
const COW_HALF = rows(`
  ................
  ................
  ................
  .........kkkkkkk
  ........kwwwwwww
  .......kbwwwwwww
  .......kbwwwwwww
  .......kbwwwwwww
  .kkkkkkkbwwwwwww
  kwwbbbbkbbwwwwww
  kcoooookbbwwwwww
  .kkkkkkkbeswwwww
  .......kbeewwwww
  ..kkkkkkkbbwwwww
  .kbwwwwbkbbwwwww
  kcbwwwwbbkbwwwww
  kcbbbwwbbkbbwwww
  kcbbbbbbkppppppp
  kccbbbbbkppnnppp
  kccbbbbbkpqnnppp
  kccbbbbbkqpppppp
  kccbbbbbbkqqqqqq
  kcccbbbbbbkkkkkk
  kcccbbbbbbbbbbbb
  kcccbbbbbbbbbbbb
  .kccbbbbkkkkkkkk
  ..kcbbbk........
  ..kcbbbk........
  ..kcbbbk........
  ..khhhhk........
  ..khhhhk........
  ..kkkkkk........
`);

/**
 * The patches go on after the mirror, so no two cows are the same cow twice
 * over: one eye in a black mask, one shoulder, a splash on the chest.
 */
const EYE_PATCH = rows(`
  ..xxx.
  .xxyxx
  xxxxxx
  xxxxx.
  xxxse.
  .xxxxx
  ..xxx.
`);
const SHOULDER_PATCH = rows(`
  .xx.
  xyxx
  xxxx
  .xxx
  ..x.
`);
const CHEST_PATCH = rows(`
  .xxxx
  xxx..
`);
const patched = (r: string[]) => stamp(stamp(stamp(r, EYE_PATCH, 18, 7), SHOULDER_PATCH, 2, 16), CHEST_PATCH, 18, 23);

/** The bite: the jaw drops and the tongue comes out with the noise. */
const COW_MOO = rows(`
  kqkkkk
  .kmmmm
  ..kkkk
`);

/** Horns, for anything with an opinion. They come off the skull sideways and turn up. */
const COW_HORNS = rows(`
  ..k.....
  .kgk....
  .kgk....
  .kgGk...
  ..kgGkk.
  ...kggGk
  ....kkkk
`);

/** A brass ring through the nose. */
const NOSE_RING = rows(`
  j..j
  .jj.
`);

/** Charging: the eyes go red and the breath comes out in two jets. */
const SNORT = rows(`
  .vv..............vv.
  vvvv............vvvv
  vvvv............vvvv
  .vv..vv......vv..vv.
  ....vvvv....vvvv....
  .....vv......vv.....
`);
const RED_EYES = rows(`
  rt..........tr
  rr..........rr
`);

/** A rosette: first prize, and the only colour on the floor that is not hide. */
const ROSETTE = rows(`
  .RRR.
  RRYRR
  .RRR.
  .RR..
  .R...
`);

const BULL_PAL: Record<string, string> = {
  ...COW_PAL,
  w: '#6a5a54', // a bull is the same animal in a worse mood
  b: '#4e403e',
  c: '#34292a',
  x: '#1c1618',
  y: '#2c2426',
  o: '#8a5a60',
  p: '#9a7078',
  q: '#74525a',
  n: '#2a1418',
  g: '#ece0b8',
  G: '#a89470',
  j: '#d8a838',
  r: '#ff3020fa',
  s: '#ffc070fa', // and its eye catches the light
  v: '#e4e0e8b0',
  t: '#ffd0a0fa',
};

const PRIZE_PAL: Record<string, string> = {
  ...BULL_PAL,
  R: '#c8324a',
  Y: '#f0d060',
};

/**
 * The wind-up: head and shoulders drop two pixels to lead with the skull, the
 * chest folding under them. The legs stay planted, so it reads as a lunge and
 * not as the whole animal sinking into the floor.
 */
const lowered = (r: string[]) => [...fill(r[0].length, 2), ...r.slice(0, 23), ...r.slice(25)];

const cow = patched(sym(COW_HALF));
const cowAtk = lowered(patched(sym(stamp(COW_HALF, COW_MOO, 10, 21))));
const bull = stamp(patched(sym(stamp(COW_HALF, COW_HORNS, 0, 0))), NOSE_RING, 14, 21);
const bullAtk = stamp(stamp(lowered(bull), RED_EYES, 9, 13), SNORT, 6, 23);

/**
 * A top hat, for the Silent Picture.
 *
 * Drawn once and billboarded above every creature on the floor rather than
 * painted into sixty enemy frames — which is the only reason the gag can
 * apply to a Gravecaller, a mimic and whatever gets added next year without
 * anyone drawing anything.
 */
/*
 * Lighter than a top hat has any business being. The Silent Picture takes
 * every colour out of the frame, and a black hat on a black ceiling is not a
 * joke anyone can see — the first cut read as two grey stripes floating over a
 * skull. Charcoal crown, bright band, so the silhouette survives the grade.
 */
const HAT_PAL: Record<string, string> = {
  A: '#1a1820',
  B: '#6e6a7c',
  C: '#dcd8e4',
  D: '#a8384c',
};

const TOP_HAT: ArtDef = {
  id: 'prop_tophat',
  palette: HAT_PAL,
  rows: rows(`
    ....AAAAAAAA....
    ...ABBBBBBBBA...
    ...ABBBBBBBBA...
    ...ABBBBBBBBA...
    ...ABBBBBBBBA...
    ...ABBBBBBBBA...
    ...ACCCCCCCCA...
    ...ADDDDDDDDA...
    ...ABBBBBBBBA...
    .AAABBBBBBBBAAA.
    AABBBBBBBBBBBBAA
    ACCCCCCCCCCCCCCA
    AAAAAAAAAAAAAAAA
  `),
};


/**
 * A monocle, for the Silent Picture. Billboarded over one eye the way the hat
 * is billboarded over the skull, and for the same reason: it has to fit a
 * skeleton, a mimic and a bat without anyone repainting them.
 *
 * The lens is left transparent so whatever is behind it still shows through —
 * the gag only works if you can see the eye being monocled.
 */
const MONOCLE_PAL: Record<string, string> = {
  A: '#e8e4f0',
  B: '#9a94a8',
};

const MONOCLE: ArtDef = {
  id: 'prop_monocle',
  palette: MONOCLE_PAL,
  rows: rows(`
    ....AAAAAA......
    ..AA......AA....
    .A..........A...
    .A..........A...
    A............A..
    A............A..
    A............A..
    A............A..
    .A..........A...
    .A..........A...
    ..AA......AA....
    ....AAAAAA..B...
    ............B...
    ...........B....
    ...........B....
    ..........B.....
  `),
};

export const ENEMY_ART_PASTURE: ArtDef[] = [
  { id: 'cow_0', palette: COW_PAL, rows: cow },
  { id: 'cow_atk', palette: COW_PAL, rows: cowAtk },

  { id: 'bull_0', palette: BULL_PAL, rows: bull },
  { id: 'bull_atk', palette: BULL_PAL, rows: bullAtk },

  { id: 'prizebull_0', palette: PRIZE_PAL, rows: stamp(bull, ROSETTE, 3, 15) },
  { id: 'prizebull_atk', palette: PRIZE_PAL, rows: stamp(bullAtk, ROSETTE, 3, 17) },

  TOP_HAT,
  MONOCLE,
];
