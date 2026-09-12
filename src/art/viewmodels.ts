import { ArtDef } from './raster';
import { padTop, rows, sym } from './helpers';

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
  { id: 'vm_fist', palette: PAL, rows: FIST },
  { id: 'vm_shield', palette: PAL, rows: SHIELD },
];
