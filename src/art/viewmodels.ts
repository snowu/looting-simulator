import { ArtDef } from './raster';
import { padTop, rows, stamp, sym } from './helpers';

// First-person weapons (24×40), held in the right hand at the bottom of the
// screen. Ramp chars 1-4 take the weapon's primary material colours.

// The gripping fist, seen from behind: three finger bands split by dark
// creases, the heel of the hand, then a lit bracer rim and the sleeve running
// off toward the bottom-right corner. Same silhouette as before — the shape
// worked, it just had no structure inside it.
const HAND = rows(`
  .........kddddk.........
  ........kdccccdbk.......
  ........kaaaaaaak.......
  ........kdccccdbk.......
  ........kaaaaaaaak......
  ........kdccccdbbak.....
  .........kaaaaaabbak....
  .........kbbbbbbbbbak...
  ..........kddddddddbak..
  ..........kaaaaaaaaabak.
  ...........kcbbbbbbbbaak
  ...........kcbbbbbbbaaaa
  ............kcbbbbbaaaaa
  ............kcbbbaaaaaaa
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

// The pick sits farther across the palm than the shared weapon grip. Keeping
// its hand narrower stops the long haft from ending in an oversized striped
// fist when the sprite is enlarged in first person.
const PICK_GRIP = rows(`
  ..........kkddddkk......
  .........kdcccccdbk.....
  .........kaaaaaaabk.....
  .........kdcccccbbk.....
  .........kaaaaaabbk.....
  ..........kbbbbbbak.....
  ..........kddddddbak....
  ..........kaaaaaabbak...
  ...........kcbbbbbbbak..
  ...........kcbbbbbbaak..
  ............kcbbbbaaaak.
  ............kcbbbaaaaaak
  .............kcbaaaaaaaa
  ..............kkaaaaaaaa
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

// Two-handed models share a small forward fist above the main grip. Keeping the
// shaft visible on both sides makes it read as a grip rather than a floating hand.
/**
 * The off hand, higher up the haft, for the two-handed grip.
 *
 * It was six rows of featureless knuckles and read as a bulge in the shaft
 * rather than a hand — which, with every viewmodel sprite being 24x40 and the
 * renderer normalising them all to the same height, left a greatsword looking
 * like a long sword. This one is a whole fist with its forearm running out to
 * the *left*, opposite the main hand at the bottom, so the two together read as
 * a grip at a glance and at speed.
 */
const SECOND_HAND = rows(`
  ......kddddk............
  .....kdccccdbk..........
  ....kaaaaaaaak..........
  ....kdccccdbak..........
  ...kbaaaaaabak..........
  ..kaabbbbbbbak..........
  .kaaabbbbbbak...........
  kaaaaaaaaaak............
  kaaaaaaaak..............
  kkkkkkkk................
`);

const MAUL = [
  '.......kkkkkkkkkk.......',
  '......k4444444443k......',
  '.....k444433333332k.....',
  '.....k433333322222k.....',
  '.....k433332222211k.....',
  '......kkkkkwvkkkkk......',
  '..........kwvvk.........',
  '..........kwvvk.........',
  '..........kkkkk.........',
  '..........kwvvk.........',
  '..........kwvvk.........',
  '..........kkkkk.........',
  '..........kwvvk.........',
  ...SECOND_HAND,
  '.........kwvvk..........',
  '.........kwvvk..........',
  '.........kwvvk..........',
  ...HAND,
];

const POLEARM = [
  '..........k4k...........',
  '..........k43k..........',
  '....kkk..k443k..kk......',
  '...k444kkk433kkk21k.....',
  '..k443333343322211k.....',
  '...k4332kkwvk.k11k......',
  '....kkk..kwvk..kk.......',
  '.........kwvk...........',
  ...Array.from({ length: 6 }, () => '.........kwvk...........'),
  ...SECOND_HAND,
  '.........kwvk...........',
  '.........kwvk...........',
  '.........kwvk...........',
  ...HAND,
];

const GREATSWORD = [
  '........kk44kk..........',
  '.......k443344k.........',
  '.......k432234k.........',
  '.......k432234k.........',
  '.......k432234k.........',
  '.......k432234k.........',
  '.......k432234k.........',
  '.......k432234k.........',
  '.......k432234k.........',
  '.......k432234k.........',
  '.......k432234k.........',
  '.......k433334k.........',
  '.......kk3223kk.........',
  '..kkkghhhhhhhhhhggkkk...',
  '.kggggggggggggggggggk...',
  '..kkkggkkkkkkggkkkk.....',
  '.........kwvvk..........',
  '.........kwvvk..........',
  ...SECOND_HAND,
  '.........kwvvk..........',
  '.........kwvvk..........',
  '.........kwvvk..........',
  ...HAND,
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
];
