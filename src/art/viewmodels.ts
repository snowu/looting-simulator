import { ArtDef } from './raster';
import { padTop, rows, stamp, sym } from './helpers';

// First-person weapons (24×40), held in the right hand at the bottom of the
// screen. Ramp chars 1-4 take the weapon's primary material colours.

// The gripping fist, seen from behind: a broad lit knuckle crown, short
// brown grooves that split only the knuckles, fingers merged into thick lit
// masses below, the thumb a lit wedge on the left, then a bracer cuff with a
// bright rim and a dark sleeve. Broad on purpose — a slimmer read went in
// first and came back as "too thin" from the game. Torch light crushes
// mid-tones, so separations stay dark brown and short: below the knuckle
// line a fist is one united mass catching the light.
const HAND = rows(`
  .......kddddddddk.......
  .......kddaddaddk.......
  .......kddaddaddk.......
  .......kddaddaddk.......
  .....kddddaddkddddk.....
  .....kddddaddkddcck.....
  ......kdddaddkdddk......
  ......kccccaccccck......
  .......kcccaaaacck......
  ........khhhhhhhhk......
  ........kggkggkggk......
  .........kdaaaaak.......
  ..........kaaaaaak......
  ...........kaaaaaak.....
`);

const LEFT_HAND = HAND.map((row) => [...row].reverse().join(''));

const BLADE = [
  '............k...........',
  '...........k4k..........',
  '...........k43k.........',
  '..........k432k.........',
  ...Array.from({ length: 18 }, (_, i) => (i % 5 === 2 ? '..........k442k.........' : '..........k432k.........')),
  '.....kghhhhhhhhhhhhgk...',
  '.....kggggggggggggggk...',
  '..........kjjjk.........',
  '..........kjjjk.........',
  ...HAND,
];

const HAFT = (n: number) => Array.from({ length: n }, () => '...........kwvk.........');

// The pick sits farther across the palm than the shared weapon grip. Same
// language as HAND — vertical finger separations, thumb in shadow on the
// left, bracer cuff, dark sleeve — drawn narrower so the long haft does not
// end in an oversized fist when the sprite is enlarged in first person.
const PICK_GRIP = rows(`
  ..........kdddk.........
  .........kddadk.........
  .........kddadk.........
  .........kddddk.........
  ........kdddkddk........
  ........kdddkdcck.......
  .........kddkddck.......
  .........kcccacck.......
  ..........kccaack.......
  ..........khhhhhk.......
  ..........kggkggk.......
  ...........kdaaak.......
  ............kaaaak......
  .............kaaaak.....
`);

const AXE = [
  '...........kwvk.........',
  '...........kwvk.........',
  '....kkkk...kwvk.........',
  '...k4443k..kwvk.........',
  '..k44333kkkkwvk.........',
  '.k443332222kwvk.........',
  '.k43332222kkwvk.........',
  '.k43322222kkwvk.........',
  '.k443322kkkkwvk.........',
  '..k4433k...kwvk.........',
  '...kkkk....kwvk.........',
  ...HAFT(15),
  ...HAND,
];

const PICK = [
  '.........kkkkkk.........',
  '......kk443322kk........',
  '....kk4443332221kk......',
  '..kk4433kkkkkkkk2211kk..',
  '.k4433kk..kkwvkk..2211k.',
  'k433kk...kwvvk....kk21k.',
  'k32k.....kkwvkk.....k21k',
  '.........kwvk...........',
  '.........kwvk...........',
  '.........kwvk...........',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  '...........kwvk.........',
  '...........kwvk.........',
  '...........kwvk.........',
  '...........kwvk.........',
  '............kwvk........',
  '............kwvk........',
  '............kwvk........',
  '............kwvk........',
  '............kwvk........',
  '............kwvk........',
  '............kwvk........',
  '............kwvk........',
  '............kwvk........',
  ...PICK_GRIP,
];

const MACE = [
  '...........k.k..........',
  '........k.k444k.k.......',
  '........kk44443kk.......',
  '.......k444433322k......',
  '......kk44333222kk......',
  '.......k43332222k.......',
  '......kk43322221kk......',
  '.......k4322221k........',
  '........kk2211kk........',
  '.........kkkkkk.........',
  ...Array.from({ length: 16 }, () => '..........kwvk..........'),
  ...HAND,
];

const SPEAR = [
  '...........k............',
  '..........k4k...........',
  '..........k43k..........',
  '.........k443k..........',
  '.........k432k..........',
  '.........k432k..........',
  '..........k32k..........',
  '..........k2k...........',
  '..........kkkk..........',
  ...Array.from({ length: 17 }, () => '..........kwvk..........'),
  ...HAND,
];

/**
 * The two-handed grip: the near hand in full, the far hand wrapped on the shaft.
 *
 * Two equal fists stacked beside the shaft read as one tapering cone, and a
 * hand floating entirely to one side of the haft reads as a mitten that missed
 * — whatever the finger banding does. This is how the grip actually looks from
 * behind it: knuckles centred *on* the shaft so it disappears under the hand
 * and re-emerges below, the thumb massed on the left in shadow, just enough
 * forearm running out to the left to read as an arm rather than a swelling in
 * the haft. Same finger/bracer language as {@link HAND}; the lower hand *is*
 * HAND, so the pair always matches.
 */
const GRIP_UPPER = rows(`
  .......kddddk...........
  ......kddaddadk.........
  ......kddaddadk.........
  ......kddaddadk.........
  .....kddaddddcdk........
  .....kddadddcck.........
  ......kddaddcck.........
`);
const GRIP_LOWER = HAND.slice(0, 12);

const MAUL = [
  '......kkkkkkkkkkk.......',
  '.....k44444444443k......',
  '....k4444433333332k.....',
  '....k4333333322222k.....',
  '....k4333322222211k.....',
  '.....kkkkkkwvkkkkkk.....',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kggk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kggk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kggk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  ...GRIP_UPPER,
  '..........kwvk..........',
  '..........kwvk..........',
  ...GRIP_LOWER,
];

const POLEARM = [
  '..........kk............',
  '.........k44k...........',
  '.........k443k..........',
  '.........k443k..........',
  '..........k43k..........',
  '...kkkkkkkk43k..........',
  '...k444443k43k..........',
  '..k4444333k43k..........',
  '..k4433333k43k..........',
  '..k4333333k43k..........',
  '...k433333k43k..........',
  '....k33333k43k..........',
  '.....kkkkkk43k..........',
  '..........k43k..........',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  ...GRIP_UPPER,
  '..........kwvk..........',
  '..........kwvk..........',
  ...GRIP_LOWER,
];

const GREATSWORD = [
  '..........kk............',
  '.........k44k...........',
  '.........k43k...........',
  '.........k443k..........',
  '.........k433k..........',
  '.........k443k..........',
  '.........k433k..........',
  '.........k443k..........',
  '.........k433k..........',
  '.........k443k..........',
  '.........k433k..........',
  '.........k443k..........',
  '.........k433k..........',
  '.........k443k..........',
  '.........k433k..........',
  '.........k443k..........',
  '.........k433k..........',
  '.........kk33kk.........',
  '....kghhhhhhhhhhhgk.....',
  '....kgggggggggggggk.....',
  '.....kkggkkkkkggkk......',
  '..........kwvk..........',
  ...GRIP_UPPER,
  '..........kwvk..........',
  '..........kwvk..........',
  ...GRIP_LOWER,
];

// A thrown weapon has no first-person model. The shaft leaves the player and is
// a projectile from that moment; a fistful of javelins held up through the
// wind-up put a second pair of hands in the frame beside the ones already
// holding your weapon. The pickup and projectile sprites in props.ts are the
// only art a thrown weapon needs.



// Casting uses the otherwise-unseen left hand, with the stone face held toward
// the player. The lit frame changes only the graven mark and loose sparks.
/**
 * The stone held up to cast.
 *
 * It was a small grey square with a cross scratched on it, tucked at the top of
 * the frame — at the size the cast pose draws it, that reads as a pebble with a
 * plus sign, not as the thing a whole spell system is named after. This is a
 * round stone with a carved rim and a mark cut through it, big enough to be the
 * subject of the frame, gripped rather than balanced.
 */
const SIGIL = [
  ...Array.from({ length: 4 }, () => '........................'),
  '......kkkkkkkkk.........',
  '....kk1111m1111kk.......',
  '...k11111mmm11111k......',
  '..k11111m111m11111k.....',
  '..k1111m11111m1111k.....',
  '..k1111m11111m1111k.....',
  '..k1111m11111m1111k.....',
  '..k11111m111m11111k.....',
  '..k111111mmm111111k.....',
  '...k111111m111111k......',
  '....kk1111111kk.........',
  '......kkkkkkkkk.........',
  '.......kdddk............',
  '......kdccdk............',
  '.....kdaaaadk...........',
  '....kdbaaaaak...........',
  '...kdbbaaaaak...........',
  '..kabbbbbbbak...........',
  '..kaddddddbak...........',
  '..kaaaaaaabbak..........',
  '..kbbbbbbbbbak..........',
  '..kddddddddbak..........',
  ...LEFT_HAND,
];

/**
 * The same stone with the mark burning, and light thrown off it.
 *
 * The old lit frame changed one colour and scattered three loose pixels in the
 * corner of the canvas, which looked like dirt on the screen rather than like
 * the stone doing anything. Here the carving lights right through and the glow
 * sits around the stone, where light would actually be.
 */
const SIGIL_LIT = stamp(
  SIGIL.map((row) => row.replaceAll('m', 'x')),
  rows(`
    ....x.......x...
    ..x...........x.
    x...............
    ................
    ................
    ................
    ................
    ................
    ................
    ................
    ................
    x...............
    ..x...........x.
    ....x.......x...
  `),
  3,
  3,
);

const FIST = padTop(['.........kkkkkk.........', '.........kcbcbk.........', ...HAND], 40);

const SHIELD = sym(rows(`
  ......kkkkkk
  ....kk444444
  ...k44433333
  ..k443333333
  .k4433333333
  .k4333333333
  k43333333222
  k43333332222
  k43333322222
  k4333322kkkk
  k433332kghhh
  k433332kghhh
  k433332kgghh
  k4333322kkkk
  k43333322222
  k33333332222
  k33333333222
  .k3333333322
  .k3333333332
  ..k333333333
  ...k22333333
  ....kk222222
  ......kkkkkk
  ............
`));

const PAL = {
  k: '#0a0806', a: '#4a3222', b: '#7a5638', c: '#9a7450', d: '#c49a6e', g: '#7a5a28', h: '#c8a050',
  j: '#3a2410', w: '#7a5230', v: '#4a2e16',
  1: '#2a2a30', 2: '#55555e', 3: '#8a8a94', 4: '#c8c8d0',
};

/**
 * The bare left hand, raised open to catch called shafts — drawn at 2×
 * density (48 rows) as an experiment in buying detail with pixels. The
 * renderer height-normalises viewmodels, so it rides the exact pose the
 * 24-row art did, at the same on-screen size with finer pixels: round
 * fingertip caps at staggered heights, one soft joint dash per finger, gaps
 * that fade as fingers meet the palm, real palm creases, a thumb with a
 * rounded tip, and a bracer with strap and buckle. If it reads better than
 * the 1× fists in game, the hands — and then the weapons — follow it up.
 */
const OPEN_HAND = [
  '................................................',
  '................................................',
  '................................................',
  '................kdddk...........................',
  '..............kkdddddkk..kdddk..................',
  '.......kdddk...kdddddckkkdddddkk................',
  '.....kkdddddkk.kdddddck.kdddddck..kdddk.........',
  '......kdddddckakdddddckakdddddckkkdddddk........',
  '......kdddddckakdddddckakdddddckakddddck........',
  '......kdddddckakdddddckakdddddckakddddck........',
  '......kdddddckakdddddckakdddddckakddddck........',
  '......kdddddckakdddddckakdddddckakddddck........',
  '......kdbbbdckakdddddckakdddddckakdbbbck........',
  '......kdddddckbkdddddckbkdbbbdckbkddddck........',
  '......kdddddckbkdbbbdckbkdddddckbkddddck........',
  '......kdddddckbkdddddckbkdddddckbkddddck........',
  '......kdddddckbkdddddckbkdddddckbkddkddddk......',
  '......kdddddckckdddddckckdddddckckdkddddddk.....',
  '......kdddddckckdddddckckdddddckckkdddckddck....',
  '......kdddddckckdddddckckdddddckckkdddckddck....',
  '......kdddddckckdddddckckdddddckckdkddckddck....',
  '.....kkdddddckdkdddddckdkdddddckdkdkddckkddck...',
  '.....kddddddddddddddddddddddddddddddkddckddck...',
  '.....kddddddddddddddddddddddddddddddkddckddck...',
  '.....kddddddddddaaddaadddddddddddddddkdckdddck..',
  '.....kddaaddaaddddddddddaadddddddddddkdckdddck..',
  '.....kdddddddddddddddddddddaadddddddddkckdddck..',
  '.....kddddddddddddddddddddddddaadddddddck.......',
  '.....kccccccccccccccccccccccccccccbbcccck.......',
  '.....kcccccccccccaaaaaaaccccccccccccbbcck.......',
  '.....kcccaaaaaaaacccccccccccccccccccccbbk.......',
  '.....kcccccccccccccccccccccccccccccccccck.......',
  '.....kcccccccccccccccccccccccccccccccccck.......',
  '.....kcccccccccccccccccccccccccccccccccck.......',
  '.....kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.......',
  '.........kccccccccccccccccccccccccck............',
  '.........kccccccccccccccccccccccccck............',
  '..........kccccccccccccccccccccccck.............',
  '..........kccccccccccccccccccccccck.............',
  '..........kkkkkkkkkkkkkkkkkkkkkkkkk.............',
  '..........khhhhhhhhhkkhhhhhhhhhhhhk.............',
  '..........kgggggggggkkggghkhggggggk.............',
  '..........kgggggggggkkggghhhggggggk.............',
  '..........kgggggggggkkggggggggggggk.............',
  '..........kkkkkkkkkkkkkkkkkkkkkkkkk.............',
  '...........kaaaadaaaaaaaaaaabaaaak..............',
  '...........kaaaadaaaaaaaaaaabaaaak..............',
  '...........kaaaadaaaaaaaaaaabaaaak..............',
];

export const VIEWMODELS: ArtDef[] = [
  { id: 'vm_blade', palette: PAL, rows: BLADE },
  { id: 'vm_axe', palette: PAL, rows: AXE },
  { id: 'vm_pick', palette: PAL, rows: PICK },
  { id: 'vm_blunt', palette: PAL, rows: MACE },
  { id: 'vm_spear', palette: PAL, rows: SPEAR },
  { id: 'vm_maul', palette: PAL, rows: MAUL },
  { id: 'vm_polearm', palette: PAL, rows: POLEARM },
  { id: 'vm_greatsword', palette: PAL, rows: GREATSWORD },
  { id: 'vm_sigil', palette: { ...PAL, m: PAL[2] }, rows: SIGIL },
  { id: 'vm_sigil_lit', palette: { ...PAL, m: PAL[2], x: '#ffe8a0fa' }, rows: SIGIL_LIT },
  { id: 'vm_fist', palette: PAL, rows: FIST },
  { id: 'vm_shield', palette: PAL, rows: SHIELD },
  { id: 'vm_hand', palette: PAL, rows: OPEN_HAND },
];
