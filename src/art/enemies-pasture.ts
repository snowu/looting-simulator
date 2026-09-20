import { ArtDef } from './raster';
import { rows, stamp, sym } from './helpers';

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
  A: '#171418', // outline and the hard patches
  B: '#e8e4dc', // hide
  C: '#b4aea4', // hide in shadow
  D: '#d98f9c', // muzzle
  E: '#8a4a58', // nostril
  F: '#f4f0e8', // eye white
  G: '#e8d8a8', // horn
  H: '#3a3038', // hoof
};

/**
 * Left half, mirrored. The face fills the top two-thirds; the body below it is
 * deliberately plain, because at this size a cow is a face with a shape under
 * it.
 */
const COW_HALF = rows(`
  ................
  ................
  ................
  .......AAAAAAAAA
  ......ABBBBBBBBB
  .....ABBBBBBBBBB
  ....ABBBAAAABBBB
  ....ABBAAAAAABBB
  ....ABBAAAAAABBB
  ....ABBBAAAABBBB
  ....ABBBBBBBBBBB
  ....ABAFFABBBBBB
  ....ABAFFABBBBBB
  ....ABBAAABBBBBB
  ....ABBBBBBBBBBB
  .....ABBBBBBBBBB
  ......ADDDDDDDDD
  ......ADDEEDDDDD
  ......ADDEEDDDDD
  .......ADDDDDDDD
  ........AAAAAAAA
  .....AAABBBBBBBB
  ....ABBBBBBBBBBB
  ...ABBBAAAAABBBB
  ...ABBAAAAAAABBB
  ...ABBBAAAAABBBB
  ...ABBBBBBBBBBBB
  ...ACCBBBBBBBBBB
  ...ACCBBBBBBBBBB
  ...AHHBBBBBBBBBB
  ...AHHBBBBBBBHHH
  ...AHHAAAAAAAHHH
`);

/** The bite: the muzzle opens and the head comes forward. */
const COW_CHEW = rows(`
  ADDDDDDD
  ADAAAAAA
  ADAFFFFA
  ADAAAAAA
  ADDDDDDD
`);

/** Horns, for anything with an opinion. They sit on the skull, not above it. */
const COW_HORNS = rows(`
  GG..............
  AGG.............
  .AGG............
  ..AGG...........
  ...AG...........
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
  B: '#4a4048', // a bull is the same animal in a worse mood
  C: '#332c34',
  F: '#ffd8a0', // and its eye catches the light
};

const PRIZE_PAL: Record<string, string> = {
  ...BULL_PAL,
  R: '#c8324a',
  Y: '#f0d060',
};

const cow = sym(COW_HALF);
const cowAtk = sym(stamp(COW_HALF, COW_CHEW, 8, 16));
const bull = sym(stamp(COW_HALF, COW_HORNS, 1, 3));
const bullAtk = sym(stamp(stamp(COW_HALF, COW_HORNS, 1, 3), COW_CHEW, 8, 16));

/**
 * A top hat, for the Silent Picture.
 *
 * Drawn once and billboarded above every creature on the floor rather than
 * painted into sixty enemy frames — which is the only reason the gag can
 * apply to a Gravecaller, a mimic and whatever gets added next year without
 * anyone drawing anything.
 */
const HAT_PAL: Record<string, string> = {
  A: '#0c0a0e',
  B: '#2a2630',
  C: '#6a6270',
  D: '#4a1820',
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
    ................
    ................
    ................
  `),
};

export const ENEMY_ART_PASTURE: ArtDef[] = [
  { id: 'cow_0', palette: COW_PAL, rows: cow },
  { id: 'cow_atk', palette: COW_PAL, rows: cowAtk },

  { id: 'bull_0', palette: BULL_PAL, rows: bull },
  { id: 'bull_atk', palette: BULL_PAL, rows: bullAtk },

  { id: 'prizebull_0', palette: PRIZE_PAL, rows: stamp(bull, ROSETTE, 4, 22) },
  { id: 'prizebull_atk', palette: PRIZE_PAL, rows: stamp(bullAtk, ROSETTE, 4, 22) },

  TOP_HAT,
];
