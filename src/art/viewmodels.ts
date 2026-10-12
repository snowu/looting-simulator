import { ArtDef } from './raster';
import { fill, mirror, rows, sym } from './helpers';

// See docs/design/viewmodel-style.md. All held art uses the same pixel density,
// upper-left light, short brown creases, and shared hand/cuff motifs.
const PAL = {
  k: '#171318', a: '#51372c', b: '#80553c', c: '#ad7952', d: '#d1a477',
  e: '#e6bd8c', g: '#705333', h: '#b18b4b', i: '#d9b875',
  j: '#332622', w: '#88613d', v: '#55402d',
  1: '#30303c', 2: '#555968', 3: '#929eac', 4: '#dce4e7',
};

const canvas = (h = 80): string[] => fill(48, h);

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
const HAND = mirror(rows(`
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
`).map(row => row.padEnd(39, '.')));

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
ink(SIGIL, mirror(CUP_HAND.map(row => row.padEnd(25, '.'))), 9, 52);
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

// Conduits, held in the left hand: the sword's side grip mirrored, fingers
// curled across a real shaft that runs on through the fist to a butt below
// it. The shaft takes the material ramp (1-4); the stone, the brass and the
// leather wrap do not, so a conduit reads as a conduit whatever it is cut
// from. `_lit` is the cast pose's back half: a halo, a white-hot core and
// sparks, at alpha 250 like the lit sigil.
const STONE = {
  o: '#3a1a6e', p: '#7a44d8', q: '#b98cff', r: '#efe2ff',
  x: '#fff4fffa', z: '#c8a4ffa0', y: '#dcc4ff60',
};

/** The left hand's grip: the sword hand, mirrored, so the forearm exits lower left. */
const LEFT_HAND = mirror(HAND);
/** Shaft column for LEFT_HAND at x=4: the mirror of the sword's haft at x=22. */
const LEFT_SHAFT = 21;

// Wand head: a long faceted crystal, lit from the upper left, seated in three
// brass prongs that bite into its base.
const WAND_HEAD = rows(`
  .......k.......
  ......krk......
  ......krrk.....
  .....krrqk.....
  .....krqqpk....
  ....krrqqpk....
  ....krqqppok...
  ...krrqqppok...
  ...krqqpppok...
  ...krqqpppok...
  ...kqqqpppok...
  ..hkqqppppokh..
  ..hikqqpppokgh.
  .khikqqppookghk
  .khiikqpppokghk
  ..khikkqpookgk.
  ...khhikkkkghk.
  ....khhiihhgk..
  ....kghhhhggk..
  .....kgggggk...
  ......kkkkk....
`);

// Rod head: four forged flanges caging a round stone, a collar under it, and
// a finial on top. The flanges take the metal ramp like the shaft.
const ROD_HEAD = rows(`
  ........kk........
  .......k43k.......
  .......k32k.......
  ......kk43kk......
  ....kkk4kk2kkk....
  ...k44kk..kk21k...
  ..k43k.rrqq.k21k..
  ..k4k.rrqqqp.k1k..
  .k43krrqqqppok11k.
  .k4krrqqqpppok1k..
  .k4krqqqppppok1k..
  .k3kqqqpppppok1k..
  .k3kqqppppppok1k..
  .k3kkqppppoook1k..
  ..k3kkpppoookk1k..
  ..k33kkooookk11k..
  ...k3kkkkkkkk1k...
  ...kkhhhhhhhhgkk..
  ...khiiiiiiihhgk..
  ....kgggggggggk...
  .....k4433221k....
  ......kkkkkkk.....
`);

/**
 * A conduit's stone lit for the cast: a halo behind it, a white-hot core over
 * it, and sparks thrown off at the rim, at alpha 250 like the lit sigil.
 */
function kindle(art: string[], cx: number, cy: number, r: number, core: number[][]): void {
  // Halo first so the stone and the sparks sit over it.
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.hypot(x, y * 1.15);
    if (d > r || cy + y < 0 || cx + x < 0 || cx + x >= 48) continue;
    const line = [...art[cy + y]];
    if (line[cx + x] !== '.') continue;
    line[cx + x] = d > r - 2.5 ? 'y' : 'z';
    art[cy + y] = line.join('');
  }
  for (const [dx, dy] of core) {
    const line = [...art[cy + dy]];
    line[cx + dx] = 'x';
    art[cy + dy] = line.join('');
  }
  for (const [dx, dy] of [[-r - 2, -3], [r + 1, -5], [-4, -r - 2], [5, -r - 1], [-r - 1, 4], [r + 2, 2], [1, -r - 4]]) {
    const yy = cy + dy, xx = cx + dx;
    if (yy < 0 || xx < 0 || xx >= 48) continue;
    const line = [...art[yy]];
    line[xx] = 'x';
    art[yy] = line.join('');
  }
}

function conduitArt(heavy: boolean, lit: boolean): string[] {
  const art = canvas(80);
  const head = heavy ? ROD_HEAD : WAND_HEAD;
  const headX = LEFT_SHAFT + 2 - Math.floor(head[0].length / 2);
  const headY = heavy ? 4 : 14;
  const shaftTop = headY + head.length - 1;
  // The shaft, light on the left. A wand tapers and carries two growth knots;
  // a rod is straight and banded with brass every so often.
  for (let y = shaftTop; y <= 78; y++) {
    let row = heavy ? 'k4321k' : (y < shaftTop + 14 ? '.k43k' : 'k4321k'.slice(0, 5));
    if (!heavy && (y === shaftTop + 9 || y === shaftTop + 22)) row = 'kk42kk'.slice(0, 5);
    if (heavy && (y - shaftTop) % 11 === 5) row = 'khiihk';
    ink(art, [heavy ? row : row.padEnd(5, '.')], LEFT_SHAFT - (heavy ? 0 : 0), y);
  }
  // Leather wrap above the fist.
  for (let y = 46; y < 53; y++) ink(art, [y % 2 ? 'kwvvjk' : 'kwccjk'], LEFT_SHAFT, y);
  ink(art, head, headX, headY);
  if (lit) {
    const core = heavy ? [[0, 0], [-1, 0], [0, -1], [-1, -1], [0, 1]] : [[0, -1], [0, 0], [-1, 0], [0, 1], [0, 2]];
    kindle(art, LEFT_SHAFT + 2, headY + (heavy ? 10 : 8), heavy ? 12 : 11, core);
  }
  ink(art, LEFT_HAND, 4, 52);
  return art;
}

// The Stave: a quarterstaff held across the body in both hands, the sword's
// two-handed grip, with its crown forked round a stone bigger than a rod's.
// The wood takes the material ramp (1-4); the stone and the brass collar do
// not. The crown is plotted rather than drawn by hand so the two prongs stay
// true arcs round the stone.
const STAVE_X = 23.5;
const STAVE_STONE_Y = 14;

function staveArt(lit: boolean): string[] {
  const art = canvas(88);
  const put = (x: number, y: number, ch: string) => {
    if (y < 0 || y >= art.length || x < 0 || x >= 48) return;
    const line = [...art[y]];
    line[x] = ch;
    art[y] = line.join('');
  };
  const at = (x: number, y: number) => (y < 0 || y >= art.length || x < 0 || x >= 48 ? '.' : art[y][x]);
  const cx = STAVE_X, cy = STAVE_STONE_Y, r = 6.5;
  // The shaft, lit on the left, with a knot every so often.
  for (let y = cy + 8; y <= 87; y++) ink(art, [(y - cy) % 13 === 0 ? 'k4kk1k' : 'k4321k'], 21, y);
  // Two prongs of the wood fork off the top of the shaft and curl up round
  // the stone, their tips turned in over it.
  const R = r + 2.5;
  for (let i = 0; i <= 60; i++) {
    const phi = Math.PI * (0.92 - 0.8 * (i / 60));
    for (const side of [-1, 1]) {
      const px = cx + side * R * Math.sin(phi), py = cy - R * Math.cos(phi);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > 1) continue;
        const x = Math.floor(px + dx), y = Math.floor(py + dy);
        put(x, y, side < 0 ? (dx < 0 ? '4' : '3') : (dx > 0 ? '1' : '2'));
      }
    }
  }
  // The stone, lit from the upper left.
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const ox = x + 0.5 - cx, oy = y + 0.5 - cy;
      const d = Math.hypot(ox, oy * 1.1);
      if (d > r) continue;
      const shade = (ox + oy) / (2 * r);
      put(x, y, d > r - 1 ? 'k' : shade < -0.35 ? 'r' : shade < -0.05 ? 'q' : shade < 0.3 ? 'p' : 'o');
    }
  }
  // A brass collar where the prongs leave the shaft.
  ink(art, ['khiihk', 'kghhgk'], 21, cy + 7);
  // Outline everything the crown added.
  const filled = (x: number, y: number) => at(x, y) !== '.' && at(x, y) !== 'k';
  for (let y = 0; y < cy + 12; y++) for (let x = 0; x < 48; x++) {
    if (at(x, y) !== '.') continue;
    if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) put(x, y, 'k');
  }
  if (lit) kindle(art, 23, cy, 15, [[0, 0], [-1, 0], [0, -1], [-1, -1], [0, 1]]);
  return grip(art, true);
}

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
const shieldTop = sym(SHIELD_HALF.map(row => row.padEnd(24, '3')));
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


// ---------------------------------------------------------------------------
// Oddities
// ---------------------------------------------------------------------------

/**
 * The Big Toe. A preserved toe the size of a forearm, held by the stump.
 *
 * It gets its own palette rather than the shared metal ramp for the obvious
 * reason: it is not metal, and a toe drawn in steel greys reads as a badly
 * drawn club. The nail is the one hard, bright thing on it, so that is what
 * the light catches — which is also the end that does the damage.
 */
const TOE_PAL = {
  ...PAL,
  1: '#3a2428', 2: '#6d4a44', 3: '#a87a68', 4: '#d8a88c',
  n: '#f0e4cc', m: '#c8b08c', p: '#8a6a58', q: '#5a3c38', r: '#9a3a3a', o: '#e8dcc0',
};

// Squat and bulbous, the nail set into the front below a cap of skin, two
// knuckle creases, and the severed end: a raw ring, a knob of bone, and cloth
// bound round it down into the fist, so the hand is holding something.
const BIG_TOE = canvas();
ink(BIG_TOE, rows(`
  ................................................
  ................................................
  ................................................
  ................................................
  ................................................
  ................................................
  ................................................
  ................................................
  ................................................
  ........................kk......................
  ....................kkkk41kkk...................
  ...................k444333322kk.................
  .................kk444333332221k................
  ................k444443333322221k...............
  ................k4444333333322211k..............
  ...............k44444pppppp3222211k.............
  ..............k44444pppppppp222211k.............
  ..............k4444pponnnnmpp22211k.............
  .............k4444ppoonnnnmmp222211k............
  .............k4444pooonnnnmmm222211k............
  .............k4444pnnnnnnnmmm222211k............
  ..............k4444nnnnnnnmmm2221kk.............
  ..............k44444mmmmmmmm22211k..............
  ..............k444443mmmmmm222211k..............
  ..............k444443333333222211k..............
  ..............k444443333333222211k..............
  ..............k444443333333222211k..............
  ...............k4p4433333332p221k...............
  ...............k44pppppppppp2211k...............
  ...............k4444333333322211k...............
  ...............k4444333333322211k...............
  ...............k4444333333222211k...............
  ...............k444433333322221k................
  ...............k44p43333332p221k................
  ...............k444pppppppp2211k................
  ...............k444433333322211k................
  ...............k444433333322211k................
  ...............k44443333332221k.................
  ...............k44443333332221k.................
  ...............k44443333332221k.................
  ...............k44443333322221k.................
  ...............k44443333322211k.................
  ...............k44443333322211k.................
  ................kkrrrrrrrrrrrk..................
  ..................kkkkooooook...................
  .....................kooooook...................
  .....................kwwwwwvk...................
  .....................kwwwwwvk...................
  .....................kjvvvvvk...................
  .....................kwwwwwvk...................
  .....................kwwwwwvk...................
  .....................kjvvvvvk...................
  .....................kwwwwwvk...................
  .....................kwwwwwvk...................
  .....................kjvvvvvk...................
  .....................kwwwwwvk...................
  .....................kwwwwwvk...................
  .....................kjvvvvvk...................
  ......................kkkkkk....................
`), 0, 0);
grip(BIG_TOE);

/**
 * The Prize Bull's Horn, socketed onto a short shaft. Bone-yellow, ridged
 * across the growth rings, and coming to a point that is entirely serious.
 */
const HORN_PAL = {
  ...PAL,
  1: '#4a3a1c', 2: '#8a7038', 3: '#c8ab63', 4: '#f0e0ac',
};

const PRIZE_HORN = canvas();
haft(PRIZE_HORN, 30, 54);
ink(PRIZE_HORN, rows(`
  .....k
  .....k4k
  ....k44k
  ....k443k
  ...k4433k
  ...k4433k
  ..k44332k
  ..k44332k
  ..k443321k
  .k443321k
  .k4433221k
  .k4433221k
  k44332221k
  k44332221k
  k443322211k
  k44332221k
  k4433221k
  k1111111k
  k4433221k
  k443221k
  kk3221kk
  .kkkkk.
`), 18, 8);
grip(PRIZE_HORN);

/**
 * The Impresario's Cane. Lacquer black, silver knob, and worth almost nothing
 * as a thing to hit people with — which is the trade it asks you to make.
 */
const CANE_PAL = {
  ...PAL,
  1: '#0e0c12', 2: '#22202a', 3: '#6a6878', 4: '#c8c8d8',
};

const CANE = canvas();
ink(CANE, rows(`
  ..kkkkkk..
  .k444444k.
  k44444444k
  k44333334k
  k43333334k
  .k3333332k
  ..k33332k.
  ...kkkk...
`), 19, 8);
for (let y = 16; y <= 56; y++) ink(CANE, ['k2331k'], 21, y);
ink(CANE, ['k4444k'], 21, 16);
grip(CANE);

export const VIEWMODELS: ArtDef[] = [
  { id: 'vm_dagger', palette: PAL, rows: DAGGER },
  { id: 'vm_short_sword', palette: PAL, rows: SHORT_SWORD },
  { id: 'vm_blade', palette: PAL, rows: BLADE },
  { id: 'vm_axe', palette: PAL, rows: AXE },
  { id: 'vm_pick', palette: PAL, rows: PICK },
  { id: 'vm_blunt', palette: PAL, rows: MACE },
  { id: 'vm_big_toe', palette: TOE_PAL, rows: BIG_TOE },
  { id: 'vm_prize_horn', palette: HORN_PAL, rows: PRIZE_HORN },
  { id: 'vm_cane', palette: CANE_PAL, rows: CANE },
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
  { id: 'vm_wand', palette: { ...PAL, ...STONE }, rows: conduitArt(false, false) },
  { id: 'vm_wand_lit', palette: { ...PAL, ...STONE }, rows: conduitArt(false, true) },
  { id: 'vm_rod', palette: { ...PAL, ...STONE }, rows: conduitArt(true, false) },
  { id: 'vm_rod_lit', palette: { ...PAL, ...STONE }, rows: conduitArt(true, true) },
  { id: 'vm_stave', palette: { ...PAL, ...STONE }, rows: staveArt(false) },
  { id: 'vm_stave_lit', palette: { ...PAL, ...STONE }, rows: staveArt(true) },
];
