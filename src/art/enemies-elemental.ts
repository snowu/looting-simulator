import { ArtDef } from './raster';
import { rows, stamp, sym } from './helpers';
import { bowAtRest, bowDrawn } from './weapons';

// A hooded archer drawn independently of the goblin archer. The four schools
// share one silhouette and one bow — the robe's colour and the light on the
// arrowhead are what tell you which of them is about to shoot you.
//
// The bow is carried across the chest rather than hanging at the far edge of
// the canvas: at the far edge there was nothing holding it and it read as a
// loose rope, and there was no room to draw it without running off the sprite.
const ARCHER_HALF = rows(`
  ................
  ................
  ............kkkk
  ..........kkbbbb
  .........kbbcccc
  ........kbbccccc
  .......kbbccckkk
  .......kbccckmmm
  .......kbcckmmGm
  ........kcckmmmm
  ........kcckmmmm
  .........kkkmmmm
  .........kkdkkkk
  .......kkdddeeed
  .....kkdddeeeeed
  ....kddddddeeeed
  ...kddddddeeeeed
  ...kdddddeeeeeed
  ....kddddeeeeeed
  .....kdddeeeeeed
  .......kkdddeeed
  ........kdddeeed
  ........kddddddd
  ........kdddeeed
  ........kdddeeed
  ........kddddddd
  ........kddkdddd
  ........kddkdddd
  ........kddkdddd
  ........kddkdddd
  .......kkddkdddd
  .......kkkkkkkkk
`);

/**
 * Colours the four share. `c` (the hood and trim), `d`/`e` (the robe) and the
 * two glow characters are overridden per school, so the difference between an
 * Ember and a Gloom archer is a whole figure and not one pixel of arrowhead.
 */
const ARCHER_PAL = {
  k: '#0b1019', b: '#273445', c: '#506476', d: '#283342', e: '#647a8a', m: '#111722',
  Y: '#5c3f22', Z: '#c39257', X: '#9b927e',
  P: '#ffe6abfa', G: '#ffe6abfa', H: '#fffdf0fa', F: '#ac8d69',
};

const body = sym(ARCHER_HALF);
// Idle: the bow across the chest in one fist, a shaft held ready in the other,
// its lit head naming the school before a shot is drawn. Drawn: the same bow,
// the string pulled into a V, the arrowhead where the string meets the fist —
// pointed at you, which is all you would ever see of it.
const idleArcher = bowAtRest(body);
const drawnArcher = bowDrawn(body);

const ELEMENTS = [
  { sprite: 'cinder', tip: '#ff9a28fa', core: '#fff0a8fa', hood: '#8f4a2c', robe: '#2e1d1c', cloth: '#6b3b2c' },
  { sprite: 'rime', tip: '#65bffffa', core: '#e4f9fffa', hood: '#4d7ea4', robe: '#1d2b3c', cloth: '#4e6c86' },
  { sprite: 'gloom', tip: '#a267eefa', core: '#e3c7fffa', hood: '#61407f', robe: '#231a33', cloth: '#4c3a6a' },
  { sprite: 'dawn', tip: '#ffd85afa', core: '#fff9c8fa', hood: '#d0b25c', robe: '#3a3526', cloth: '#a2946a' },
] as const;

// The Spore Hunter is a mushroom, not a person in a hat: a huge spotted cap,
// jagged underside and cream stalk-body. The hanging tongue gives the attack
// frame a clear lunge, based on the user's mushroom-monster reference.
const SPORE_HALF = rows(`
  ................
  .............kkk
  ..........kkrrrr
  ........kkrrrrrr
  ......kkrrrrrrrr
  .....krrrrwwrrrr
  ....krrrrwwrrrrr
  ...krrrrrrrkkrrr
  ..krrrrrrrkkkkrr
  .krrrrrrrrrkkkrr
  krrrrrwwrrrrrrrr
  krrrrwwrrrrrrrrr
  krrrrrrrrrrrrrrr
  .krrrrrrrrrrrrrr
  ..krrrrrrrrrrrrr
  ...kkrrrrrrrrrrr
  ....kkkkkkkkkkkk
  .....ktktktktktk
  ......kmmmmmmmmk
  .......kccccccck
  .......kcccoccck
  .......kccccccck
  ......kcccccccck
  .....kccccccccck
  ....kcccccccccck
  ....kcccccccccck
  .....kccccccccck
  ......kcccccccck
  .......kccccccck
  ......kkccckkcck
  .....kcccck..kcc
  .....kkkkkk..kkk
`);
const SPORE_PAL = {
  k: '#221710', r: '#bf563e', w: '#efd49b', t: '#fff0cf', m: '#3d1d17',
  c: '#e6d1a3', o: '#30231d', p: '#e57a83', q: '#ae455f', y: '#e4f08cfa', Y: '#9cc454fa',
};
// At rest only the tip of the tongue shows under the gills; the whole length
// is saved for the lunge.
const TONGUE_IDLE = rows(`
  .pp.
  pqqp
  .pp.
`);
const TONGUE_ATTACK = rows(`
  ..pp..
  .pqqp.
  pqqqqp
  pqqqqp
  pqqqqp
  .pqqp.
  .pqqp.
  .pqqp.
  .pqqp.
  .pqqp.
  .pqqp.
  .pqqp.
  pqqp..
  .pp...
  ..pp..
`);
const SPORE_BASE = sym(SPORE_HALF);
// Shut, the gills under the cap are a dark seam with the teeth just showing.
// Open, they are a maw the width of the whole cap. The old pair of frames both
// used the open mouth and differed only in how far the tongue hung down, which
// is not something you can see from the other side of a room.
const SPORE_MOUTH_SHUT = [
  `k${'m'.repeat(24)}k`,
  `k${'tm'.repeat(12)}k`,
  `k${'m'.repeat(24)}k`,
];
const SPORE_MOUTH_OPEN = [
  `k${'m'.repeat(24)}k`,
  `k${'tmmt'.repeat(6)}k`,
  `k${'m'.repeat(24)}k`,
  `k${'m'.repeat(24)}k`,
  `k${'mmtt'.repeat(6)}k`,
  `k${'m'.repeat(24)}k`,
];
const SPORE_SHUT = stamp(SPORE_BASE, SPORE_MOUTH_SHUT, 3, 16);
const SPORE_OPEN = stamp(SPORE_BASE, SPORE_MOUTH_OPEN, 3, 16);
// The gills flare and blow glowing spores out under the rim: from across a
// dark room, the puff is what says it is about to strike.
const SPORE_PUFF_HALF = rows(`
  .Y..............
  YyY.............
  .Y..Y...........
  ...YyY..........
  .Y..Y...........
  YyY.............
  .Y..............
  ...Y............
  ..YyY...........
  ...Y............
`);
// Only on empty pixels: the spores hang in the air beside the body, not on it.
const SPORE_PUFF = sym(SPORE_PUFF_HALF).map((row, y) =>
  [...row].map((ch, x) => (SPORE_OPEN[y + 17]?.[x] === '.' ? ch : '.')).join(''));

export const ENEMY_ART_ELEMENTAL: ArtDef[] = [
  ...ELEMENTS.flatMap(({ sprite, tip, core, hood, robe, cloth }): ArtDef[] => {
    const palette = { ...ARCHER_PAL, c: hood, d: robe, e: cloth, G: tip, H: core, P: tip };
    return [
      { id: `${sprite}_0`, palette, rows: idleArcher },
      { id: `${sprite}_atk`, palette, rows: drawnArcher },
    ];
  }),
  { id: 'spore_0', palette: SPORE_PAL, rows: stamp(SPORE_SHUT, TONGUE_IDLE, 8, 19) },
  { id: 'spore_atk', palette: SPORE_PAL, rows: stamp(stamp(SPORE_OPEN, TONGUE_ATTACK, 7, 17), SPORE_PUFF, 0, 17) },
];
