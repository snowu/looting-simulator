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

// The Spore Hunter, after the little spores of the old MMOs: a big domed red
// cap with fat cream spots over a band of gills, a pear-shaped cream stalk
// with a face on it (round black eyes, a glint, rosy cheeks, a small smile),
// stubby arms and two little feet. Cute until it isn't: on the lunge it
// hops, the brows come down, the mouth gapes with the tongue out, the arms
// go up and glowing spores puff from under the rim.
const SPORE = rows(`
  ................................
  ................................
  ..........kkkkkkkkkkkk..........
  ........kkstttwwwwtttskk........
  ......kksssttwwwwwwttssskk......
  .....kssssssswwwwwwsssssssk.....
  ....kssssssssswwwwsssssssssk....
  ...kssswwwsssssssssssswwwsssk...
  ..kssswwwwwsssssssssswwwwwsssk..
  ..krrrwwwvssssssssssssvwwwrrrk..
  .krrrrrwwvssssssssssssvwwrrrrrk.
  .krrwwrrssswwsssssswwsssrrwwrrk.
  .krwwvrrrrrwwvrrrrvwwrrrrrvwwrk.
  .krrrrrrrrrrrrrrrrrrrrrrrrrrrrk.
  .kRRRrrrrrrrrrrrrrrrrrrrrrrRRRk.
  ..kkkmnmnmnmnmnmmnmnmnmnmnmkkk..
  .....kkkkkmmmmmmmmmmmmkkkkk.....
  ..........kcccccccccck..........
  .........kcccccccccccck.........
  ........kcccccccccccccck........
  .......kkccekccccccekcckk.......
  .....kkckcckkcccccckkcckckk.....
  ....kcccccckkcccccckkcccccck....
  ....kCCCCppccccccccccppCCCCk....
  .....kkCkcccccmccmccccckCkk.....
  .......kkccccccmmcccccckk.......
  .........kCCCCCCCCCCCCk.........
  ..........kCCCCCCCCCCk..........
  ..........kccCCCCCCcck..........
  .........kDDDDDkkDDDDDk.........
  ..........kkDkk..kkDkk..........
  ............k......k............
`);
const SPORE_ATK = rows(`
  ................................
  ................................
  ..........kkkkkkkkkkkk..........
  ........kkstttwwwwtttskk........
  ......kksssttwwwwwwttssskk......
  .....kssssssswwwwwwsssssssk.....
  ....kssssssssswwwwsssssssssk....
  ...kssswwwsssssssssssswwwsssk...
  ..kssswwwwwsssssssssswwwwwsssk..
  ..krrrwwwvssssssssssssvwwwrrrk..
  .krrrrrwwvssssssssssssvwwrrrrrk.
  ykrrwwrrssswwsssssswwsssrrwwrrky
  .krwwvrrrrrwwvrrrrvwwrrrrrvwwrk.
  .krrrrrrrrrrrrrrrrrrrrrrrrrrrrk.
  .kRRRrrrrrrrrrrrrrrrrrrrrrrRRRk.
  YykkkmnmnmnmnmnmmnmnmnmnmnmkkkyY
  .Y...kkkkkmmmmmmmmmmmmkkkkk...Y.
  ......kkkkkcccccccccckkkkk......
  .....kccccckkcccccckkccccck.....
  ..y.kccccccekccccccekcccccck.y..
  .....kCCCcckkcccccckkccCCCk.....
  ....Y.kkccckkcccccckkccckk.Y....
  ...YyY..kppccmmmmmcccppk..YyY...
  ....Y...kccccemmmmecccck...Y....
  ........kccccmqqqqccccck........
  .........kCCCmqQQqCCCCk.........
  ..........kCCCqQQqCCCk..........
  ..........kccCqQQqCcck..........
  .........kDDDDDqqDDDDDk.........
  ..........kkDkkkkkkDkk..........
  ............k......k............
  ................................
`);
const SPORE_PAL = {
  k: '#221710', R: '#7a1c14', r: '#bf3a28', s: '#e2603a', t: '#ff9a6a', w: '#f6ecd0', v: '#d0bc94',
  m: '#3d1d17', n: '#5a2c22', c: '#f0dcb0', C: '#d0b484', D: '#a8845a', e: '#ffffff', p: '#ec8a88',
  q: '#e57a83', Q: '#ae455f', y: '#e4f08cfa', Y: '#9cc454fa',
};

export const ENEMY_ART_ELEMENTAL: ArtDef[] = [
  ...ELEMENTS.flatMap(({ sprite, tip, core, hood, robe, cloth }): ArtDef[] => {
    const palette = { ...ARCHER_PAL, c: hood, d: robe, e: cloth, G: tip, H: core, P: tip };
    return [
      { id: `${sprite}_0`, palette, rows: idleArcher },
      { id: `${sprite}_atk`, palette, rows: drawnArcher },
    ];
  }),
  { id: 'spore_0', palette: SPORE_PAL, rows: SPORE },
  { id: 'spore_atk', palette: SPORE_PAL, rows: SPORE_ATK },
];
