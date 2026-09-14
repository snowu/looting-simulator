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

/**
 * The two-handed grip: a fist above, a span of haft, a fist below.
 *
 * It used to be the one-handed hand — fourteen rows of fist and forearm — with
 * a second one stacked on top, which ate more than half the sprite and left the
 * weapon squeezed into what was left. A greatsword came out with a stubby blade
 * under an enormous pair of arms. These are the same hands drawn to the size a
 * grip actually needs, so the weapon gets the frame back.
 *
 * The upper fist's forearm exits left and the lower one's exits right, which is
 * what makes the pair read as one grip on one shaft rather than two hands.
 */
/**
 * The two-handed grip: the near hand in full, the far hand as knuckles.
 *
 * Two equal fists stacked on the shaft read as one tapering cone, whatever the
 * finger banding does — and two *full* hands are twenty-eight of the sprite's
 * forty rows, which is what left the greatsword with a stubby blade. This is
 * how the grip actually looks from behind it: the near hand is {@link HAND},
 * the same one every other weapon uses, and the far hand is smaller and further
 * up, mostly behind the shaft, with just enough forearm running out to the left
 * to read as a hand rather than a swelling in the haft.
 */
const GRIP_UPPER = rows(`
  ......kdddddk...........
  .....kdccccdbk..........
  ....kaaaaaaaak..........
  ...kabbdcccdbk..........
  ..kaabbaaaaak...........
  ..kkkbbbbbk.............
  .....kkkkk..............
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
  '..........kkkk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kkkk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kwvk..........',
  '..........kkkk..........',
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
 * The bare left hand, raised open to catch called shafts. Same fist the
 * weapons grip with, mirrored for the left arm, sized to the 24×24 offhand
 * box so it rides the exact pose the shield does — the call reads on the
 * hand, not on whether you happen to wear a shield.
 */
const OPEN_HAND = padTop(LEFT_HAND, 24);

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
