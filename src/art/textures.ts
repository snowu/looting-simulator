import { ArtDef } from './raster';
import { rows } from './helpers';

// Palette values with alpha 'fa' (250) are EMISSIVE: the renderer draws them
// at full brightness regardless of lighting (glowing mortar, crystals...).

// ---------------------------------------------------------------------------
// Shared layouts (re-coloured per biome)
// ---------------------------------------------------------------------------

/** Staggered ashlar bricks: 15×7 blocks, 1px mortar. */
const BRICK_ROWS = rows(`
  ddddddddddddddcmddddddddddddddcm
  cbbbbbbbbbcbbbamcbbbbbbbbbbbbbam
  cbbcbbbbbbbbbbamcbbbbeebbbbcbbam
  cbbbbbbbabbbbbamcbbbbbeebbbbbbam
  cbbbbbbbbbbbcbamcbcbbbbbebbbbbam
  cbabbbbbbbbbbbamcbbbbbbbbbbbbbam
  baaaaaaaaaaaaaambaaaaaaaaaaaaaam
  mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm
  ddddddcmddddddddddddddcmdddddddd
  cbbbbbamcbbbbbbbbbbbbbamcbbbbbbb
  bbbbbbamcbbcbbbbbbabbbamcbbbbbbb
  bbbbcbamcbbbbbbbbbbbbbamcbbabbbb
  bbbbbbamcbbbbbbabbbbcbamcbbbbbbb
  bbbbbbamcbcbbbbbbbbbbbamcbbbbbcb
  aaaaaaambaaaaaaaaaaaaaambaaaaaaa
  mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm
  eeddddddddddddcmddddddddddddddcm
  ebbbbbbbbbbbbbamcbbbbbbcbbbbbbam
  cbbbbbabbbbbbbamcbbbbbbbbbbbbbam
  cbbbbbbbbbcbbbamcbbabbbbbbbbbbam
  cbcbbbbbbbbbbbamcbbbbbbbbbbcbbam
  cbbbbbbbbbbbbbamcbbbbbabbbbbbbam
  baaaaaaaaaaaaaambaaaaaaaaaaaaaam
  mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm
  ddddddcmddddddddddddddcmdddddddd
  bbbbbbamcbbbbbbbbcbbbbamcbbbbbbb
  bbbbbbamcbbbbbbbbbbbbbamcbbbcbbb
  bbabbbamcbabbbbbbbbbbbamcbbbbbbb
  bbbbbbamcbbbbbbcbbbbbbamcbbbbbbb
  bcbbbbamcbbbbbbbbbbbbbamcbbabbbb
  aaaaaaambaaaaaaaaaaaaaambaaaaaaa
  mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm
`);

/** Rubble masonry: rounded stones of uneven width in three courses. */
const RUBBLE_ROWS = rows(`
  mdddddddddmmmddddddddmmmddddddmm
  cdbbbbbbbbamcdbbbbbbbamcdbbbbbam
  cbbbbbbcbbamcbbbbbbbbamcbbbbbbam
  cbbbbbbbbbamcbbbcbbbbamcbbbbbbam
  cbebbbbbbbamcbbbbbbbbamcbbbcbbam
  cbbbbbbbbbamcbbbbbbebamcbbbbbbam
  cbbbbbbbebamcbbbbbbbbamcbebbbbam
  cbbbbbbbbbamcbbbbbbbbamcbbbbbbam
  baaaaaaaaaambaaaaaaaaambaaaaaaam
  maaaaaaaaammmaaaaaaaammmaaaaaamm
  mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm
  mddddmmmddddddddddmmmdddddddddmm
  cdbbbamcdbbbbbbbbbamcdbbbbbbbbam
  cbbbbamcbbbbbbbbbbamcbbbbbbbbbam
  cbbebamcbbbbbcbbbbamcbbbbbbbbbam
  cbbbbamcbbbbbbbbbbamcbbcbbbbbbam
  cbbbbamcbebbbbbbbbamcbbbbbbbbbam
  cbcbbamcbbbbbbbbebamcbbbbbbebbam
  cbbbbamcbbbbbbbbbbamcbbbbbbbbbam
  baaaaambaaaaaaaaaaambaaaaaaaaaam
  maaaammmaaaaaaaaaammmaaaaaaaaamm
  mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm
  mdddddddmmmdddddddddddddmmmdddmm
  cdbbbbbbamcdbbbbbbbbbbbbamcdbbam
  cbbbbbbbamcbbbbbbbbbbbbbamcbbbam
  cbbcbbbbamcbbbbbbbcbbbbbamcbbbam
  cbbbbbbbamcbebbbbbbbbbbbamcbcbam
  cbbbbbebamcbbbbbbbbbbbebamcbbbam
  cbbbbbbbamcbbbbbbbbbbbbbamcbbbam
  baaaaaaaambaaaaaaaaaaaaaambaaaam
  maaaaaaammmaaaaaaaaaaaaammmaaamm
  mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm
`);

/** Worn flagstones. */
const FLAG_ROWS = rows(`
  ccccccccccccccccccbmccccccccccbm
  cbbbbbbbbbbbbbbbbbamcbbbbbbbbbam
  cbbbcbbbbbbbbbbbbbamcbbbbbbebbam
  cbbbbbbbbbbbebbbbbamcbbbbbbbbbam
  cbbbbbbbbbbeebbbbbamcbbcbbbbbbam
  cbbbbbbcbbbbbbbbbbamcbbbbbbbbbam
  cbbbbbbbbbbbbbbbcbamcbbbbbbbbbam
  cbebbbbbbbbbbbbbbbamcbbbbbbbcbam
  cbbbbbbbbbbbbbbbbbamcbbbbbbbbbam
  cbbbbbbbbcbbbbbbbbamcbebbbbbbbam
  cbbbbbbbbbbbbbbebbamcbbbbbbbbbam
  cbbbbbbbbbbbbbbbbbamcbbbbbbbbbam
  baaaaaaaaaaaaaaaaaambaaaaaaaaaam
  mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm
  ccccccccbmccccccccccccccccccccbm
  cbbbbbbbamcbbbbbbbbbbbbbbbbbbbam
  cbbbbbbbamcbbbbbcbbbbbbbbbbbbbam
  cbbebbbbamcbbbbbbbbbbbbbbbbbbbam
  cbbbbbbbamcbbbbbbbbbbbbebbbbbbam
  cbbbbbbbamcbbbbbbbbbbbeebbbbbbam
  cbbbbbcbamcbbbbbbbbbbbbbbbbbbbam
  cbbbbbbbamcbbcbbbbbbbbbbbbbcbbam
  cbbbbbbbamcbbbbbbbbbbbbbbbbbbbam
  cbebbbbbamcbbbbbbbbcbbbbbbbbbbam
  cbbbbbbbamcbbbbbbbbbbbbbbbbbbbam
  cbbbbbbbamcbbbbbbbbbbbbbbbebbbam
  cbbbcbbbamcbbbbbbbbbbbbbbbbbbbam
  cbbbbbbbamcbbbbbebbbbbbbbbbbbbam
  cbbbbbbbamcbbbbbbbbbbbbbbbbbcbam
  cbbbbbbbamcbbbbbbbbbbbbbbbbbbbam
  baaaaaaaambaaaaaaaaaaaaaaaaaaaam
  mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm
`);

/** Big slabs for ceilings. */
const SLAB_ROWS = rows(`
  ddddddddddddddddddddddddddddddcm
  cbbbbbbbbbbbbbbbbbbbbbbbbbbbbbam
  cbbbbcbbbbbbbbbbbbbbbbbebbbbbbam
  cbbbbbbbbbbbebbbbbbbbbbbbbbbbbam
  cbbbbbbbbbbbbbbbbbbbbbbbbbcbbbam
  cbbebbbbbbbbbbbbbbbbbbbbbbbbbbam
  cbbbbbbbbbbbbbbbcbbbbbbbbbbbbbam
  cbbbbbbbbbbbbbbbbbbbbbbbbbbbbbam
  cbbbbbbbebbbbbbbbbbbbbbbbbbebbam
  cbbbbbbbbbbbbbbbbbbbbcbbbbbbbbam
  cbbbbbcbbbbbbbbbbbbbbbbbbbbbbbam
  cbbbbbbbbbbbbbbbbebbbbbbbbbbbbam
  cbbbbbbbbbbbbbbbbbbbbbbbbbbbbbam
  cbbbbbbbbbbbbbbbbbbbbbbbbbbcbbam
  baaaaaaaaaaaaaaaaaaaaaaaaaaaaaam
  mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm
  ddddddddddddddcmdddddddddddddddd
  bbbbbbbbbbbbbbamcbbbbbbbbbbbbbbb
  bbbbbbbbbbbbbbamcbbbbbbbbbbbbbbb
  bbbbbbbbbbbbbbamcbbbbebbbbbbbbbb
  bbbbbbbbbbbbbbamcbbbbbbbbbbbbbbb
  bbbbbcbbbbbbbbamcbbbbbbbbbbbbbbb
  bbbbbbbbbbbbbbamcbbbbbbbbbbbbbbb
  bbbbbbbbbbbbbbamcbbbbbbbbbcbbbbb
  bbbbbbbbbbbbbbamcbbbbbbbbbbbbbbb
  bbbbbbbbbebbbbamcbbbbbbbbbbbbbbb
  bbbbbbbbbbbbbbamcbbbbbbbbbbbbbbb
  bbbbbbbbbbbbbbamcbbcbbbbbbbbbbbb
  bbbbbbbbbbbbbbamcbbbbbbbbbbbbbbb
  bbbbbbbbbbbbbbamcbbbbbbbbbbbbbbb
  aaaaaaaaaaaaaaambaaaaaaaaaaaaaaa
  mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm
`);

/** Packed dirt with pebbles. */
const DIRT_ROWS = rows(`
  bbbbcbbbbbabbbbbbbbbbbcbbbbbabbb
  bbabbbbbbbbbbbcbbbbabbbbbcbbbbbb
  bbbbbdpbbbbbbbbbabbbbbbbbbbbbbab
  bcbbeadbbbcbbbbbbbbbbcbbbbabbbbb
  bbbbbeebbbbbbbabbbbbbbbbbbbbbcbb
  babbbbbbbbbbbbbbbbdpbbbbbbbbbbbb
  bbbbbbcbbbabbbbbbeadbbbbabbbbbbb
  bbbbbbbbbbbbbbbbbbeebbcbbbbbbbbb
  bbcbbbbbbbbbbcbbbbbbbbbbbbbbdpbb
  bbbbbabbbbbbbbbbbabbbbbbbbbeadbb
  bbbbbbbbbdpbbbbbbbbbbbbbbbbbeebb
  abbbbbbbeadbbbabbbbbcbbbbbbbbbbb
  bbbbcbbbbeebbbbbbbbbbbbbbbcbbbba
  bbbbbbbbbbbbbbbbbbbabbbbbbbbbbbb
  bbabbbbbbbbbcbbbbbbbbbbbbabbbbbb
  bbbbbbbbbbbbbbbbbbbbbdpbbbbbbbbb
  bbbbbbcbbabbbbbbbcbbeadbbbbbcbbb
  bdpbbbbbbbbbbbbbbbbbbeebbbbbbbbb
  eadbbbbbbbbbbcbbbbbbbbbbbbabbbbb
  beebbabbbbbbbbbbbabbbbbbbbbbbbbb
  bbbbbbbbbbbbbbbbbbbbbbbbbcbbbbab
  bbbcbbbbbbbdpbbbbbbbcbbbbbbbbbbb
  bbbbbbbbbbeadbbbbbbbbbbbbbbbbbbb
  babbbbbbbbbeebbbbbabbbbbbbbbcbbb
  bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
  bbbbbbcbbbbbbbbbbbbbbbbdpbbbbbbb
  bbabbbbbbbcbbbbbbbbbbbeadbbabbbb
  bbbbbbbbbbbbbbbabbbbbbbeebbbbbbb
  bbbbcbbbbbbbbbbbbcbbbbbbbbbbbbbb
  bbbbbbbbbabbbbbbbbbbbbbbbbbbbcbb
  bbbbbbabbbbbbbbbbbbbbabbbbbbbbbb
  bcbbbbbbbbbbbbcbbbbbbbbbbabbbbbb
`);

const DOTS_22 = '......................';

/** Timber supports: a lintel beam across the top and posts down both sides. */
const TIMBER_ROWS = rows(`
  xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  wwwwwwwwwxwwwwwwwwwwwwwwwxwwwwww
  wwnwwwwwwwwwwwwyywwwwwwwwwwwwnww
  wwwwwwwyyywwwwwwwwwwwwwyywwwwwww
  yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
  xwwyzzzzzzzzzzzzzzzzzzzzzzzzxwwy
`).concat(
  Array.from({ length: 26 }, (_, i) => {
    const knotL = i % 9 === 4 ? 'xwyyz' : i % 7 === 2 ? 'xywyz' : 'xwwyz';
    const knotR = i % 8 === 5 ? 'zxwyy' : i % 11 === 1 ? 'zxnwy' : 'zxwwy';
    return knotL + DOTS_22 + knotR;
  }),
);

/** A faint chalk X left by some earlier adventurer: the tell for a secret wall. */
const CHALK_ROWS = rows(`
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ..............q...q.............
  ...............q.q..............
  ................q...............
  ...............q.q..............
  ..............q...q.............
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
`);
const CHALK_PAL = { q: '#e4dccaa8' };

// Ossuary niches: a skull cell and a bone-stack cell.
const NICHE_SKULL = rows(`
  dddddddddddddddc
  cbbbbbbbbbbbbbba
  cbaaaaaaaaaaaaba
  cbammmmmmmmmmaba
  cbammmvwwvmmmaba
  cbammvwwwwvmmaba
  cbamvwwwwwwvmaba
  cbamvmmwwmmvmaba
  cbamvmmwwmmvmaba
  cbamvwwmmwwvmaba
  cbammuwwwwummaba
  cbammuwmwmummaba
  cbamwwwvvwwwmaba
  cbavvuwwwwuvvaba
  cbaaaaaaaaaaaaba
  baaaaaaaaaaaaaaa
`);
const NICHE_BONES = rows(`
  dddddddddddddddc
  cbbbbbbbbbbbbbba
  cbaaaaaaaaaaaaba
  cbammmmmmmmmmaba
  cbammmmmmmmmmaba
  cbammmmmmmmmmaba
  cbawwvvvvvvwwaba
  cbawuuuuuuuuwaba
  cbamwwvvvvwwmaba
  cbamuuuuuuuumaba
  cbawwvvvvvvwwaba
  cbawuuuuuuuuwaba
  cbamwvwwvwvwmaba
  cbavuuvuuvuuvaba
  cbaaaaaaaaaaaaba
  baaaaaaaaaaaaaaa
`);
const OSSUARY_ROWS = [
  ...NICHE_SKULL.map((r, i) => r + NICHE_BONES[i]),
  ...NICHE_BONES.map((r, i) => r + NICHE_SKULL[i]),
];

// Glowing crystal clusters and moss for the cave accent wall.
const CRYSTAL_ROWS = rows(`
  gghhggg...ggghgg......gghhhgg...
  .gghg......ghg.........ghhg.....
  ..gg.......g............hg......
  ..g....................g........
  ................................
  ......................r.........
  ......................qr........
  .....................sqq........
  .....................sqqr.......
  .....................sqqq.......
  ......................ss........
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  .......r........................
  .......qr.......................
  ......sqq.......................
  ......sqqr......................
  ......sqqq......................
  .......ss.......................
  ................................
  ................................
  ................r...............
  ................qr..............
  ...............sqq..............
  ...............sqqr.............
  ...............sqqq.............
  ................ss..............
  ................................
`);

const PUDDLE_ROWS = rows(`
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  .....pppp.......................
  ....pppqpp......................
  ....ppqqppp.....................
  .....ppppp......................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ....................ppppp.......
  ..................ppppqqppp.....
  .................pppqqqpppp.....
  ..................pppppppp......
  ....................pppp........
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
  ................................
`);

// Throne-room banner with the Ashen King's sigil.
const pad10 = (seg: string) => '..........' + seg + '..........';
const SIGIL = ['rgrggrgr', 'rggggggr', 'rrggggrr', 'rgkggkgr', 'rggggggr', 'rrgkkgrr', 'rrggggrr', 'rrrggrrr'];
const BANNER_ROWS = [
  '........kggggggggggggggk........',
  ...Array.from({ length: 5 }, () => pad10('gsrrrrrrrrtg')),
  ...SIGIL.map((s) => pad10('gs' + s + 'tg')),
  ...Array.from({ length: 8 }, () => pad10('gsrrrrrrrrtg')),
  pad10('.gsrrrrrrtg.'),
  pad10('..gsrrrrtg..'),
  pad10('...gsrrtg...'),
  pad10('....gstg....'),
  pad10('.....gg.....'),
  ...Array.from({ length: 5 }, () => '.'.repeat(32)),
];

// Obsidian checker for the throne floor.
const TILE_A = ['rddddddd', 'dbbbbbba', 'dbbbbbba', 'dbbbcbba', 'dbbbbbba', 'dbbbbbba', 'dbbbbbba', 'daaaaaaa'];
const TILE_B = ['rddddddd', 'dffffffa', 'dffffffa', 'dfffgffa', 'dffffffa', 'dffffffa', 'dffffffa', 'daaaaaaa'];
const CHECKER_ROWS = [0, 1, 2, 3].flatMap((band) =>
  TILE_A.map((_, i) => (band % 2 === 0 ? TILE_A[i] + TILE_B[i] : TILE_B[i] + TILE_A[i]).repeat(2)),
);

// Doors -------------------------------------------------------------------------
const DOOR_WOOD_ROWS = rows(`
  zxwwwwwyzxwwwwwyzxwwwwwyzxwwwwwy
  zxwwwwwyzxwwywwyzxwwwwwyzxwwwwwy
  zxwwywwyzxwwwwwyzxwwwwwyzxwywwwy
  zxwwwwwyzxwwwwwyzxwwwywyzxwwwwwy
  zxwwwwwyzxwywwwyzxwwwwwyzxwwwwwy
  jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj
  iiiniiiiiiiniiiiiiiniiiiiiiniiii
  kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk
  zxwwwwwyzxwwwwwyzxwwwwwyzxwwwwwy
  zxwywwwyzxwwwwwyzxwwwwwyzxwwwwwy
  zxwwwwwyzxwwwwwyzxwywwwyzxwwwwwy
  zxwwwwwyzxwwwywyzxwwwwwyzxwwwwwy
  zxwwwwwyzxwwwwwyzxwwwwkkkkwwwwwy
  zxwwwwwyzxwwwwwyzxwwwwkjjkwwwwwy
  zxwwwwwyzxwwwwwyzxwwwwiiiiwwwwwy
  zxwwwwwyzxwwwwwyzxwwwiwyzxiwwwwy
  zxwwwwwyzxwwwwwyzxwwwjwyzxiwwwwy
  zxwwwwwyzxwwwwwyzxwwwjwyzxiwwwwy
  zxwwwwwyzxwwwwwyzxwwwiwyzxkwwwwy
  zxwwwwwyzxwwwwwyzxwwwwkkkkwwwwwy
  zxwwwwwyzxwwywwyzxwwwwwyzxwwwwwy
  zxwwywwyzxwwwwwyzxwwwwwyzxwwywwy
  zxwwwwwyzxwwwwwyzxwwwwwyzxwwwwwy
  zxwwwwwyzxwwwwwyzxwywwwyzxwwwwwy
  jjjjjjjjjjjjjjjjjjjjjjjjjjjjjjjj
  iiiniiiiiiiniiiiiiiniiiiiiiniiii
  kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk
  zxwwwwwyzxwwwwwyzxwwwwwyzxwwwwwy
  zxwwwywyzxwwwwwyzxwwwwwyzxwywwwy
  zxwwwwwyzxwwwwwyzxwwywwyzxwwwwwy
  zxwwwwwyzxwwwywyzxwwwwwyzxwwwwwy
  yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
`);

const plate = (l: string, r: string) => 'k' + l + 'kk' + r + 'k';
const P_TOP = 'jjjjjjjjjjjjjj';
const P_RIV = 'jniiiiiiiiiinj';
const P_MID = 'jiiiiiiiiiiiik';
const K32 = 'k'.repeat(32);
const DOOR_IRON_ROWS = [
  K32,
  plate(P_TOP, P_TOP),
  plate(P_RIV, P_RIV),
  plate(P_MID, P_MID),
  plate('jiiiiiriiiiiik', P_MID),
  plate('jiiiiirsiiiiik', 'jiiiiiiiiriiik'),
  plate('jiiiiiirsiiiik', 'jiiiiiiiirsiik'),
  plate('jiiiiiiirsiiik', 'jiiiiiiiiirsik'),
  plate(P_MID, P_MID),
  plate(P_RIV, P_RIV),
  K32,
  plate(P_TOP, P_TOP),
  plate(P_RIV, P_RIV),
  plate(P_MID, P_MID),
  plate('jiiiiiiiiiriik', P_MID),
  plate('jiiiiiiiiirsik', 'jiiiriiiiiiiik'),
  plate('jiiiiiiiiiirsk', 'jiiirsiiiiiiik'),
  plate(P_MID, 'jiiiirsiiiiiik'),
  plate(P_MID, P_MID),
  plate(P_RIV, P_RIV),
  K32,
  plate(P_TOP, P_TOP),
  plate(P_RIV, P_RIV),
  plate(P_MID, P_MID),
  plate('jiiriiiiiiiiik', P_MID),
  plate('jiirsiiiiiiiik', 'jiiiiiiiiiriik'),
  plate('jiiirsiiiiiiik', 'jiiiiiiiiirsik'),
  plate(P_MID, P_MID),
  plate(P_MID, P_MID),
  plate(P_MID, P_MID),
  plate(P_RIV, P_RIV),
  K32,
];

const d12 = '............';
const LOCK_ROWS = [
  ...Array.from({ length: 12 }, () => '.'.repeat(32)),
  d12 + 'oggggggo' + d12,
  d12 + 'ghhhhhho' + d12,
  d12 + 'ghhkkhho' + d12,
  d12 + 'ghkkkkho' + d12,
  d12 + 'ghhkkhho' + d12,
  d12 + 'ghhkkhho' + d12,
  d12 + 'ghhkkhho' + d12,
  d12 + 'ghhhhhho' + d12,
  d12 + 'oooooooo' + d12,
  ...Array.from({ length: 11 }, () => '.'.repeat(32)),
];

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

const CRYPT = { m: '#16141b', e: '#221f28', a: '#33303b', b: '#45424e', c: '#595663', d: '#6f6c79' };
const CRYPT_FLOOR = { m: '#121015', e: '#1e1c22', a: '#28262d', b: '#35333b', c: '#423f48' };
const CRYPT_CEIL = { m: '#0c0b0f', e: '#141318', a: '#1a191f', b: '#222128', c: '#2b2a32', d: '#35343d' };
const BONE = { w: '#d6c9a8', v: '#a3957a', u: '#5e5544' };

const MINE = { m: '#0e0a07', e: '#1c140d', a: '#2e2116', b: '#3e2d1e', c: '#523d28', d: '#6a5034' };
const MINE_FLOOR = { e: '#1c140b', a: '#281d12', b: '#33261a', c: '#403022', d: '#54422f', p: '#76644f' };
const MINE_CEIL = { m: '#08060400', e: '#120c07', a: '#1a120c', b: '#22180f', c: '#2c2014', d: '#36281a' };
const TIMBER = { x: '#7a5230', w: '#5e3e22', y: '#3c2614', z: '#1e1209', n: '#9a9aa2' };

const CAVE = { m: '#050a09', e: '#0c1614', a: '#152420', b: '#1e302b', c: '#294038', d: '#365248' };
const CAVE_FLOOR = { e: '#0a1210', a: '#101c18', b: '#16241f', c: '#1e2e28', d: '#2a3c34', p: '#44605a' };
const CAVE_CEIL = { m: '#030605', e: '#070d0b', a: '#0b1411', b: '#101a17', c: '#15221e', d: '#1b2a25' };

const THRONE = { m: '#7a2410fa', e: '#1a1218', a: '#241a22', b: '#30232c', c: '#3e2e38', d: '#4e3a46' };
const THRONE_FLOOR = { r: '#b03c18fa', d: '#3a2c34', b: '#1e161c', f: '#2a2026', g: '#3a2e36', a: '#100a0e', c: '#2a2028' };
const THRONE_CEIL = { m: '#4a160afa', e: '#0e0a0c', a: '#140e12', b: '#1a1318', c: '#20181e', d: '#281e26' };

const WOOD_DOOR = { w: '#5a3a1c', x: '#6e4824', y: '#3a240e', z: '#24160a', i: '#2a2a30', j: '#4a4a54', k: '#15151a', n: '#8a8a94' };
const IRON_DOOR = { i: '#34343c', j: '#50505a', k: '#1c1c22', n: '#7a7a86', r: '#5a2a1a', s: '#40201a' };
const BRASS = { o: '#503810', g: '#a07a2a', h: '#d0a848', k: '#08080a' };

// MINE_CEIL 'm' should be opaque.
MINE_CEIL.m = '#080604';

export const TEXTURES: ArtDef[] = [
  // Crypt
  { id: 'wall_crypt', palette: CRYPT, rows: BRICK_ROWS },
  { id: 'wall_crypt_b', palette: { ...CRYPT, m: '#050407', ...BONE }, rows: OSSUARY_ROWS },
  { id: 'wall_crypt_s', base: 'wall_crypt', palette: CHALK_PAL, rows: CHALK_ROWS },
  { id: 'floor_crypt', palette: CRYPT_FLOOR, rows: FLAG_ROWS },
  { id: 'ceil_crypt', palette: CRYPT_CEIL, rows: SLAB_ROWS },

  // Mines
  { id: 'wall_mine', palette: MINE, rows: RUBBLE_ROWS },
  { id: 'wall_mine_b', base: 'wall_mine', palette: TIMBER, rows: TIMBER_ROWS },
  { id: 'wall_mine_s', base: 'wall_mine', palette: CHALK_PAL, rows: CHALK_ROWS },
  { id: 'floor_mine', palette: MINE_FLOOR, rows: DIRT_ROWS },
  { id: 'ceil_mine', base: 'ceil_mine_rock', palette: TIMBER, rows: TIMBER_ROWS.slice(0, 6).concat(Array.from({ length: 26 }, () => '.'.repeat(32))) },
  { id: 'ceil_mine_rock', palette: MINE_CEIL, rows: RUBBLE_ROWS },

  // Caverns
  { id: 'wall_cave', palette: CAVE, rows: RUBBLE_ROWS },
  { id: 'wall_cave_b', base: 'wall_cave', palette: { g: '#1e3a22', h: '#2e5a30', q: '#3ad8c8fa', r: '#b0fff4fa', s: '#1a6a6a' }, rows: CRYSTAL_ROWS },
  { id: 'wall_cave_s', base: 'wall_cave', palette: CHALK_PAL, rows: CHALK_ROWS },
  { id: 'floor_cave_dirt', palette: CAVE_FLOOR, rows: DIRT_ROWS },
  { id: 'floor_cave', base: 'floor_cave_dirt', palette: { p: '#223e4a', q: '#4a7a8a' }, rows: PUDDLE_ROWS },
  { id: 'ceil_cave', palette: CAVE_CEIL, rows: SLAB_ROWS },

  // Throne
  { id: 'wall_throne', palette: THRONE, rows: BRICK_ROWS },
  { id: 'wall_throne_b', base: 'wall_throne', palette: { r: '#5a0e0e', s: '#7a1a16', t: '#2e0606', g: '#a8842c', k: '#0a0406' }, rows: BANNER_ROWS },
  { id: 'wall_throne_s', base: 'wall_throne', palette: CHALK_PAL, rows: CHALK_ROWS },
  { id: 'floor_throne', palette: THRONE_FLOOR, rows: CHECKER_ROWS },
  { id: 'ceil_throne', palette: THRONE_CEIL, rows: SLAB_ROWS },

  // Doors
  { id: 'door_wood', palette: WOOD_DOOR, rows: DOOR_WOOD_ROWS },
  { id: 'door_iron', palette: IRON_DOOR, rows: DOOR_IRON_ROWS },
  { id: 'door_locked', base: 'door_iron', palette: BRASS, rows: LOCK_ROWS },
];
