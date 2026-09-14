import { ArtDef } from './raster';
import { rows } from './helpers';

// See docs/design/viewmodel-style.md. All held art uses the same pixel density,
// upper-left light, short brown creases, and shared hand/cuff motifs.
const PAL = {
  k: '#171318', a: '#51372c', b: '#80553c', c: '#ad7952', d: '#d1a477',
  e: '#e6bd8c', g: '#705333', h: '#b18b4b', i: '#d9b875',
  j: '#332622', w: '#88613d', v: '#55402d',
  1: '#30303c', 2: '#555968', 3: '#929eac', 4: '#dce4e7',
};

const canvas = (h = 80): string[] => Array.from({ length: h }, () => '.'.repeat(48));

/** Place an authored motif; omitted trailing pixels and dots are transparent. */
function ink(base: string[], motif: string[], x: number, y: number): void {
  motif.forEach((row, dy) => {
    if (y + dy < 0 || y + dy >= base.length || x < 0 || x + row.length > 48) {
      throw new Error('Viewmodel motif outside canvas');
    }
    const line = [...base[y + dy]];
    [...row].forEach((ch, dx) => { if (ch !== '.') line[x + dx] = ch; });
    base[y + dy] = line.join('');
  });
}

// Broad back of the hand, three short knuckle creases, a thumb curled across
// the near side. The joined palm retains the intent of the previous blade edit.
const CUP_HAND = rows(`
  ......kkkkkkkkkkkkkk
  ....kkcddddedddedddcckk
  ...kcdeeeedeeeddddddcck
  ...kcddddbdddbdddbdddcck
  ...kcddddbdddbdddbdddcck
  ...kcddddcdddcdddcccccck
  ...kcddddddddddddccccck
  ..kcddeeddddddddcccccck
  .kcdeeeeddddddddcccccck
  kcdeedddccddddddcccccck
  kcdddddddbbccddddccccck
  .kcddddddddbbcccccccck
  ..kccddddddddcccccccbk
  ...kccccddddccccccbbk
  ....kcccccccccccbbbk
  .....kccccccccbbbbk
  .....kkkkkkkkkkkkkk
  .....khiiiiiiiiihgk
  .....khhhhhhhhhhhgk
  .....kgggggihiggggk
  .....kgggggihiggggk
  ......kkkkkkkkkkkkk
  ......kwvvvvvvvvvjk
  .......kwvvvvvvvvvjk
  ........kwvvvvvvvvvjk
  .........kwvvvvvvvvvjk
  ..........kwvvvvvvvvvjk
  ...........kwvvvvvvvvvjk
`);

// Side grip: fingers curl horizontally around the vertical hilt. Reflect the
// authored motif around the shaft so the right forearm approaches from below
// and to the right, opposite the cutting edge of the asymmetric weapons.
const HAND = rows(`
  ................kkkkkkkk
  ..............kkcdeeedddck
  .............kcdddddddddcck
  ............kcddddcccccccck
  ...........kcdddeedddddddcck
  ..........kcdddddccccccbbbk
  .........kcddddddddddddddcck
  ........kcdddddcccccccbbbbk
  ......kkcdddddeeddddddddcck
  .....khgkcddddddccccccbbbk
  ....khigkccdddddddddddcck
  ...khigkcccccccccccccbk
  ..khigkccccccccccccbbk
  .kwhigkccccccccccbbkk
  kwvhggkcccccccbbkk
  kwvvggkccccbbkk
  kwvvvkkkkkkk
  kwvvvvvvvvjk
  kwvvvvvvvjk
  kwvvvvvvvjk
  kwvvvvvvjk
  kwvvvvvvjk
  kwvvvvvjk
  kwvvvvvjk
  kwvvvvjk
  kwvvvvjk
  kwvvvjk
  kwvvvjk
`).map(row => [...row.padEnd(39, '.')].reverse().join(''));

// The smaller far hand wraps across the shaft; its cuff and forearm exit left.
const FAR_HAND = rows(`
  ...............kkkkkkkkkk
  ............kkkcdeeeddddcck
  ...........kcdddddddddddcck
  ..........kcddddccccccbbbbk
  ........kkcdddeeddddddddcck
  ......khgkcddddccccccbbcck
  ....kkhigkccddddddccddecck
  ..kkwvhigkcccddddddcdecck
  kwvvvvhggkccccdddddddcck
  kwvvvvvkkkccccccccccbbk
  kwvvvvk...kkccccccbbkk
  kwvvkk......kkkkkkk
  kkkk
`);

function haft(base: string[], top: number, bottom: number): void {
  for (let y = top; y <= bottom; y++) ink(base, ['kwcvk'], 22, y);
  ink(base, ['khhgk', 'kgggk'], 22, top);
}

function grip(base: string[], two = false): string[] {
  if (two) ink(base, FAR_HAND, 2, 44);
  ink(base, HAND, 5, two ? 60 : 52);
  return base;
}

const GUARD = rows(`
  .kk......................kk
  khhk....................khhk
  khihkkkkkkkkkkkkkkkkkkkkhihk
  .khiiiiiiiiihiiiiiiiiiiiihk
  ..kghhhhhhhg11ghhhhhhhhggk
  ...kkkkkkkkg22gkkkkkkkkkk
  ...........kggk
`);

function sword(two: boolean, tip = 0): string[] {
  const out = canvas(two ? 88 : 80);
  ink(out, rows(`
    ...kk
    ..k44k
    .k3442k
    k234432k
  `), 21, tip);
  for (let y = tip + 4; y < (two ? 37 : 42); y++) ink(out, ['k234432k'], 21, y);
  ink(out, ['k234432k', 'k123321k'], 21, two ? 37 : 42);
  ink(out, GUARD, 11, two ? 38 : 43);
  for (let y = two ? 45 : 50; y < (two ? 62 : 54); y++) {
    ink(out, [y % 3 === 0 ? 'kwccjk' : 'kwjvvk'], 22, y);
  }
  return grip(out, two);
}

const BLADE = sword(false);
// Same canvas and hand position: shorter blades stay physically shorter when
// the renderer normalises height. Each base selects its own model below.
const SHORT_SWORD = sword(false, 17);
const DAGGER = canvas();
ink(DAGGER, rows(`
  ...k
  ..k4k
  ..k432k
  .k44321k
  .k44321k
  k3443221k
  k3443221k
  k3443221k
  k3443221k
  k3443221k
  k3443221k
  k2343211k
  .k23321k
  .k12311k
`), 20, 29);
ink(DAGGER, rows(`
  kkhhhhhhhhhhhkk
  khiiiiiiiiiiihk
  .kgggggggggggk
  ..kkkkkkkkkkk
`), 17, 43);
ink(DAGGER, ['kwccjk', 'kwjvvk', 'kwjvvk', 'kwccjk', 'kwjvvk', 'kwjvvk'], 22, 47);
grip(DAGGER);
// Claymore: long two-edged blade, sloping quillons with quatrefoil terminals,
// and a long wrapped hilt. Extra canvas height buys blade, not a larger fist.
const GREATSWORD = canvas(112);
ink(GREATSWORD, ['....kk', '...k44k', '..k3442k', '.k334432k', 'k23344321k'], 20, 0);
for (let y = 5; y < 62; y++) ink(GREATSWORD, ['k23344321k'], 20, y);
ink(GREATSWORD, ['k12344321k', 'k12333321k'], 20, 62);
ink(GREATSWORD, rows(`
  ...............kkkkkkkk
  ............kkkhiiiiiiihkkk
  .........kkkhhhhhh11hhhhhhhkkk
  ......kkkhhhhhkkkk22kkkkhhhhhhkkk
  ....kkhhiihkk....kggk....kkhiihhkk
  ...khhiihkk.....kkkkkk.....kkhiihhk
  ..khihkk......................kkhihk
  .khihk..........................khihk
  khihik..........................kihihk
  khkhk............................khkhk
  .khk..............................khk
`), 5, 64);
for (let y = 70; y < 87; y++) ink(GREATSWORD, [y % 3 === 0 ? 'kwccjk' : 'kwjvvk'], 22, y);
ink(GREATSWORD, FAR_HAND, 2, 75);
ink(GREATSWORD, HAND, 5, 84);

const AXE = canvas();
haft(AXE, 3, 54);
ink(AXE, rows(`
  ........kkkkkk
  ......kk443332k
  ....kk44433322k
  ...k4443333221k
  ..k44333332221kkkkkk
  .k44333332222122231k
  k443333322222122231k
  k443333322222122231k
  k4433333222221kkkkkk
  k443333322221k
  .k44333332221k
  .k4433333221k
  ..k44333221k
  ...k443221k
  ....k4321k
  .....kkkk
`), 5, 6);
// The socket shares the shaft's centre and highlight column.
ink(AXE, ['k432k', 'k332k', 'k221k'], 22, 10);
grip(AXE);

const PICK = canvas();
haft(PICK, 8, 54);
ink(PICK, rows(`
  ................kkkkkkkk
  ............kkkk44443332kkk
  .........kkk444333333322222kk
  ......kkk44433332222222211111kk
  ....kk44433322211kkkkkkk1111111kk
  ..kk443332211kkkk.......kkk111111k
  .k4433221kkk..............kk11111k
  k44321kk....................kk111k
  k432kk........................k11k
  k32k...........................k1k
  k2k.............................kk
  kk
`), 3, 4);
ink(PICK, ['k432k', 'k332k', 'k221k'], 22, 9);
// The short rear beak still needs a visible plane under torch light.
for (let y = 4; y < 16; y++) {
  PICK[y] = [...PICK[y]].map((ch, x) => x > 26 && ch === '1' ? '2' : ch).join('');
}
grip(PICK);

const MACE = canvas();
haft(MACE, 22, 54);
ink(MACE, rows(`
  ........kkk
  .......k432k
  ....kk.k432k.kk
  ...k43kk432kk32k
  ...k443443233322k
  ..k44334432333221k
  .k4433344323332211k
  k443333443233322111k
  .k4433344323332211k
  ..k44334432333221k
  ...k443443233322k
  ...k43kk432kk32k
  ....kk.k432k.kk
  .......k221k
  .......kkkkk
  .......khhgk
  .......kgggk
`), 15, 5);
grip(MACE);

// A solid tapered cudgel, with its body recoloured as wood or bone.
// Keep the shared wrist and a fixed leather binding above the fingers.
const CLUB = canvas();
ink(CLUB, rows(`
  ....kkkkkkkk
  ..kk44333322kk
  .k444333333221k
  k44433333332211k
  k44333333332211k
  k44333333332211k
  k44333333332211k
  k44333333332211k
  k44333333332211k
  k44333333332211k
  k44333333332211k
  .k433333332211k
  .k433333332211k
  .k433333332211k
  .k433333332211k
  ..k4333332211k
  ..k4333332211k
  ..k4333332211k
  ...k43332211k
  ...k43332211k
  ...k43332211k
  ....k433211k
  ....k433211k
  ....k433211k
  .....k4321k
  .....k4321k
  .....k4321k
  .....k4321k
  .....k4321k
  .....k4321k
  .....k4321k
  .....k4321k
  .....kwvvjk
  .....kvvvjk
  .....kwvvjk
  .....kvvvjk
  .....kwvvjk
  .....kvvvjk
  .....k4321k
  .....k4321k
  .....k4321k
  .....k4321k
  .....k4321k
`), 16, 12);
grip(CLUB);

const SPEAR = canvas();
haft(SPEAR, 21, 54);
ink(SPEAR, rows(`
  .....k
  ....k4k
  ....k43k
  ...k4432k
  ...k4432k
  ..k344322k
  ..k344322k
  .k33443221k
  .k33443221k
  k3334432221k
  k3334432221k
  k2334432211k
  .k23443211k
  .k23443211k
  ..k244321k
  ...k4431k
  ....k32k
  ....k32k
  ...k3332k
  ...k2221k
  ...kkkkkk
`), 18, 1);
grip(SPEAR);

const MAUL = canvas(88);
haft(MAUL, 17, 62);
ink(MAUL, rows(`
  ..kkkkkkkkkkkkkkkkkkkkkkkkkk
  .k34444444444444444444444332k
  k3443333333333333333333333221k
  k4433333333333333333333333221k
  k4333222222222222222222333221k
  k4333222222222222222222333221k
  k4333222222222222222222333221k
  k4333222222222222222222333221k
  k2333222222222222222222332211k
  k2333111111111111111111332211k
  .k22211111111111111111122211k
  ..kkkkkkkkkkk2231kkkkkkkkkkk
  ............k2231k
  ............kkkkkk
`), 10, 3);
grip(MAUL, true);

const POLEARM = canvas(88);
haft(POLEARM, 22, 62);
ink(POLEARM, rows(`
  .................k
  ................k4k
  ................k43k
  ...............k4432k
  ...............k4432k
  ...............k3432k
  ...............k3432k
  ...kk..........k3432k
  ..k44kkk.......k3432k
  ..k44333kkkkkkkk3432k
  .k4433333332222k3432kkkk
  .k4433333322222k34322221kk
  k44333333222221k3432221111kk
  k44333332222221k3432kkkk1111k
  k44333332222221k3432k...kk11k
  k44333332222221k3432k.....kk
  .k443333222221k.kkkk
  .k44333322221k..k32k
  ..k443332221k...k32k
  ...k4432221k....k32k
  ....k43211k.....k32k
  .....kkkkk......k32k
  ................kkkk
`), 6, 0);
grip(POLEARM, true);

const FIST = canvas();
ink(FIST, HAND, 5, 52);

// Receiving left hand: staggered curled fingertips, broad knuckles and a
// separated thumb. Warm crease clusters model the back without black stripes.
// The wrist exits toward the lower left, matching the left-hand screen pose.
const OPEN_HAND = canvas(48);
ink(OPEN_HAND, rows(`
  ....................kkkk
  ...................kdeedk
  ..................kdeeddk
  .............kkkk.kdedcck
  ............kdeedkkdddck...kkk
  ...........kdeeddkdddck...kdedk
  ...........kdedcckdddck..kdeedk
  ...........kdddckkdddck.kdddck
  ..........kddddkkddddck.kdddck
  ..........kddddckddddckkdddck
  ..........kddddcddddddckdddck..kkk
  .........kdddddcddddddcddddck.kdedk
  .........kdeedddddddddddddck.kddck
  .........kdeeeddddeeddddddc kkddck
  ........kdddddddddeedddddddkcddck
  ........kdddddddddddddddddddddck
  ........kddddddddddddddddddddck
  .......kddddddddddddddddddddcck
  ..kkk..kdddddddddddddddddddcck
  .kdeek.kddddddddddddddddddccck
  kdeedckkddddddddddddddddcccck
  kdddcckcdddddddddddddddccccck
  .kdddccdddddddddddddddccccck
  ..kddddddddddddddddddcccccck
  ...kdddddddeedddddddcccccck
  ....kcdddddddddddddcccccck
  .....kccddddddddddcccccck
  ......kcccdddddddcccccck
  ......kccccdddddcccccck
  .....kccccccccccccccck
  ....khiiihhccccccccck
  ...khiiiiiiiihhcccck
  ..khhhhiiiiiiiiihhk
  .kgggghhhhiiiiihhk
  kwvgggggghhhhhhkk
  kwvvvgggggghhhk
  kwvvvvvggggggk
  kwvvvvvvvgggk
  kwvvvvvvvvjk
  kwvvvvvvvjk
  kwvvvvvvjk
  kwvvvvvjk
  kwvvvvjk
  kkkkkkk
`).map(row => row.replaceAll(' ', '.')), 5, 4);

// Left hand cups the rim. A thumb crosses the face; the shared cuff exits left.
const SIGIL = canvas();
ink(SIGIL, CUP_HAND.map(row => row.padEnd(25, '.').split('').reverse().join('')), 9, 52);
ink(SIGIL, rows(`
  ........kkkkkkkkkkkk
  .....kkk333333333322kkk
  ...kk333222222222222211kk
  ..k3332211111111111122211k
  .k33221111111m111111112211k
  k33221111111mmm111111112211k
  k3221111111m111m11111111211k
  k321111111m11111m1111111211k
  k32111111m1111111m111111211k
  k32111111m1111111m111111211k
  k32111111m1111111m111111211k
  k321111111m11111m1111111211k
  k3221111111m111m11111112211k
  k33221111111mmm111111122211k
  .k33221111111m111111122211k
  ..k3332211111111111222211k
  ...kk333222222222222211kk
  .....kkk222222222211kkk
  ........kkkkkkkkkkkk
`), 9, 33);
ink(SIGIL, rows(`
  ....kkk
  ..kkdeek
  .kddedcck
  kdddccck
  kddccck
  kcccck
  kccck
`), 12, 48);
const SIGIL_LIT = SIGIL.map(row => row.replaceAll('m', 'x'));
ink(SIGIL_LIT, ['x', 'x'], 7, 37);
ink(SIGIL_LIT, ['xx'], 17, 29);
ink(SIGIL_LIT, ['xx'], 34, 31);
ink(SIGIL_LIT, ['x', 'x'], 39, 44);

// Round buckler with a faceted steel boss and four small brass rivets.
const SHIELD = canvas(48);
const SHIELD_HALF = rows(`
  .................kkkkkkk
  .............kkkk4444444
  ..........kkk44443333333
  ........kk44433333333333
  ......kk443333333333333
  .....k44333333333333333
  ....k443333333333333333
  ...k4433333333333333333
  ..k44333333333333333333
  ..k43333333333333333333
  .k443333333333333333333
  .k433333333333333333333
  .k433333333333333333333
  k4433333333333333333333
  k4333333333333333333333
  k4333333333333333333333
  k4333333333333333333333
  k4333333333333333333333
  k4333333333333333333333
  k4333333333333333333333
  k4333333333333333333333
  k4333333333333333333333
  k4333333333333333333333
  k4333333333333333333333
`);
const shieldTop = SHIELD_HALF.map(row => {
  const left = row.padEnd(24, '3');
  return left + [...left].reverse().join('');
});
const shieldBody = [...shieldTop, ...shieldTop.slice().reverse()];
ink(SHIELD, shieldBody.map((row, y) => [...row].map((ch, x) => {
  if (ch === '4') return x + y > 48 ? '2' : '4';
  if (ch === '3') return x + y > 49 ? '2' : '3';
  return ch;
}).join('')), 0, 0);
ink(SHIELD, rows(`
  .....kkkkkkkk
  ...kk34444322kk
  ..k344433322211k
  .k34443332222111k
  k3444333222221111k
  k3443333222221111k
  k3433332222221111k
  k3333322222211111k
  k2333222222111111k
  .k22222221111111k
  ..k222111111111k
  ...kk11111111kk
  .....kkkkkkkk
`), 15, 17);
for (const [x, y] of [[22, 5], [5, 22], [39, 22], [22, 39]]) {
  ink(SHIELD, ['khk', 'kgk'], x, y);
}

/** Forged shield plate with a lit rim and a central raised spine. */
function shieldPlate(widths: number[]): string[] {
  const out = canvas(64);
  widths.forEach((half, y) => {
    const line = [...out[y]];
    for (let x = 24 - half; x <= 24 + half; x++) {
      const edge = Math.min(x - (24 - half), 24 + half - x);
      line[x] = edge === 0 ? 'k' : edge === 1 ? (x < 24 ? '4' : '1')
        : edge === 2 ? '2' : x === 23 ? '4' : x === 24 ? '3' : x === 25 ? '1'
        : x < 24 ? '3' : '2';
    }
    out[y] = line.join('');
  });
  return out;
}

// Kite: rounded shoulders narrowing to a long point, with a brass chevron.
const KITE_SHIELD = shieldPlate(Array.from({ length: 64 }, (_, y) =>
  y < 8 ? [7, 12, 15, 17, 19, 20, 21, 22][y]
    : y < 20 ? 22 : Math.max(0, 22 - Math.floor((y - 19) / 2)),
));
ink(KITE_SHIELD, rows(`
  khk...............khk
  khihk...........khihk
  .khihk.........khihk
  ..khihk.......khihk
  ...khihk.....khihk
  ....khihk...khihk
  .....khihk.khihk
  ......khihkhihk
  .......khiiihk
  ........khhhk
  .........kgk
`), 14, 20);
for (const [x, y] of [[9, 10], [37, 10], [13, 36], [33, 36]]) ink(KITE_SHIELD, ['khk', 'kgk'], x, y);

// Tower: broad rectangular coverage, clipped corners and reinforced bands.
const TOWER_SHIELD = shieldPlate(Array.from({ length: 64 }, (_, y) =>
  y < 5 ? [15, 18, 20, 21, 22][y] : y > 58 ? [22, 21, 20, 18, 15][y - 59] : 22,
));
for (const y of [10, 46]) {
  ink(TOWER_SHIELD, ['k444444444444444444444444444444444444444k',
    'k333333333333333333322222222222222222222k',
    'k111111111111111111111111111111111111111k'], 4, y);
  for (const x of [7, 37]) ink(TOWER_SHIELD, ['khk', 'kgk'], x, y);
}
ink(TOWER_SHIELD, rows(`
  .....khk
  ....khihk
  ...khiiihk
  ..khiiiiihk
  .khiiihiiihk
  khiiihihiiihk
  .khiiihiiihk
  ..khiiiiihk
  ...khiiihk
  ....khihk
  .....khk
`), 18, 25);

export const VIEWMODELS: ArtDef[] = [
  { id: 'vm_dagger', palette: PAL, rows: DAGGER },
  { id: 'vm_short_sword', palette: PAL, rows: SHORT_SWORD },
  { id: 'vm_blade', palette: PAL, rows: BLADE },
  { id: 'vm_axe', palette: PAL, rows: AXE },
  { id: 'vm_pick', palette: PAL, rows: PICK },
  { id: 'vm_blunt', palette: PAL, rows: MACE },
  { id: 'vm_club', palette: { ...PAL, 1: '#29251f', 2: '#494238', 3: '#75694f', 4: '#ad9873' }, rows: CLUB },
  { id: 'vm_spear', palette: PAL, rows: SPEAR },
  { id: 'vm_maul', palette: PAL, rows: MAUL },
  { id: 'vm_polearm', palette: PAL, rows: POLEARM },
  { id: 'vm_greatsword', palette: PAL, rows: GREATSWORD },
  { id: 'vm_sigil', palette: { ...PAL, m: PAL[2] }, rows: SIGIL },
  { id: 'vm_sigil_lit', palette: { ...PAL, m: PAL[2], x: '#ffe8a0fa' }, rows: SIGIL_LIT },
  { id: 'vm_fist', palette: PAL, rows: FIST },
  { id: 'vm_shield', palette: PAL, rows: SHIELD },
  { id: 'vm_kite_shield', palette: PAL, rows: KITE_SHIELD },
  { id: 'vm_tower_shield', palette: PAL, rows: TOWER_SHIELD },
  { id: 'vm_hand', palette: PAL, rows: OPEN_HAND },
];
