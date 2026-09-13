import { ArtDef } from './raster';
import { rows, stamp, sym } from './helpers';

// A hooded archer drawn independently of the goblin archer. The bow and
// nocked arrow are always visible; the four schools share a silhouette so the
// tip colour, not an unrelated body shape, teaches the damage type.
const ARCHER_HALF = rows(`
  ................
  ................
  ............kkkk
  ..........kkbbbb
  .........kbbcccc
  ........kbbccccc
  .......kbbccckkk
  .......kbccckmmm
  .......kbcckmmvm
  ........kcckmmmm
  ........kcckmmmm
  .........kkkmfff
  .........kkdkkkk
  .......kkdddeeed
  .....kkdddeeeeed
  ....kddddddeeeed
  ...kddddddeeeeed
  ...kdddgdeeeeeed
  ....kddgdeeeeeed
  .....kgkdeeeeeed
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
const ARCHER_PAL = {
  k: '#0b1019', b: '#273445', c: '#506476', d: '#283342', e: '#647a8a',
  m: '#111722', f: '#b69470', g: '#ac8d69', v: '#ffe6abfa',
  a: '#8b6844', s: '#d8c6a3', t: '#d5d7c9',
};
// Slack on the left in idle; raised in front of the chest when drawing. The
// bow itself changes position and curve, rather than just the glowing arrow.
const BOW_IDLE = rows(`
  ..kaa..
  .ka..s.
  ka...s.
  ka...s.
  ka...s.
  ka...s.
  .ka..s.
  ..ka.s.
  ...kas.
  ...kas.
  ..ka.s.
  .ka..s.
  ka...s.
  ka...s.
  ka...s.
  .ka..s.
  ..kaa..
`);
const BOW_DRAWN = rows(`
  ....aaa....
  ...aa.s....
  ..aa..s....
  .aa...s....
  aa....s....
  a.....s....
  a.....s....
  a.....s....
  a.....s....
  a.....s....
  aa....s....
  .aa...s....
  ..aa..s....
  ...aa.s....
  ....aaa....
`);
const QUIVER = rows(`
  t.t.t
  ststs
  aaaaa
  akkka
  akkka
  akkka
`);
const HELD_ARROW = rows(`
  .......tt
  ......tGt
  .....aas.
  ....aas..
  ...aas...
  ..aas....
  .aas.....
  aag......
`);
const DRAWN_ARROW = rows(`
  ....ttttt....
  ...ttttttt...
  sssstttttssss
  aaaasttttaaaa
  sssstttttssss
  ...ttttttt...
  ....ttttt....
`);
const TIP_IDLE = rows(`
  .GG.
  GHHG
  .GG.
`);
const TIP_DRAWN = rows(`
  ..GGG..
  .GHHHG.
  GHHHHHG
  GHHHHHG
  GHHHHHG
  .GHHHG.
  ..GGG..
`);
const bodyArcher = sym(ARCHER_HALF);
const idleArcher = stamp(stamp(stamp(bodyArcher, QUIVER, 25, 13), BOW_IDLE, 0, 9), HELD_ARROW, 21, 15);
const attackArcher = stamp(stamp(bodyArcher, BOW_DRAWN, 7, 8), DRAWN_ARROW, 10, 14);

const ELEMENTS = [
  { sprite: 'cinder', tip: '#ff9a28fa', core: '#fff0a8fa', trim: '#83452f' },
  { sprite: 'rime', tip: '#65bffffa', core: '#e4f9fffa', trim: '#416d91' },
  { sprite: 'gloom', tip: '#a267eefa', core: '#e3c7fffa', trim: '#654380' },
  { sprite: 'dawn', tip: '#ffd85afa', core: '#fff9c8fa', trim: '#907842' },
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
  c: '#e6d1a3', o: '#30231d', p: '#e57a83', q: '#ae455f',
};
const TONGUE_IDLE = rows(`
  .pp.
  pqqp
  pqqp
  pqqp
  pqqp
  pqqp
  .pp.
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
const SPORE_MOUTH = [
  `k${'m'.repeat(24)}k`,
  `k${'tm'.repeat(12)}k`,
  `k${'m'.repeat(24)}k`,
  `k${'mt'.repeat(12)}k`,
  `k${'m'.repeat(24)}k`,
];
const SPORE_WITH_MOUTH = stamp(SPORE_BASE, SPORE_MOUTH, 3, 16);

export const ENEMY_ART_ELEMENTAL: ArtDef[] = [
  ...ELEMENTS.flatMap(({ sprite, tip, core, trim }): ArtDef[] => {
    const palette = { ...ARCHER_PAL, c: trim, G: tip, H: core };
    return [
      { id: `${sprite}_0`, palette, rows: stamp(idleArcher, TIP_IDLE, 26, 18) },
      { id: `${sprite}_atk`, palette, rows: stamp(attackArcher, TIP_DRAWN, 13, 14) },
    ];
  }),
  { id: 'spore_0', palette: SPORE_PAL, rows: stamp(SPORE_WITH_MOUTH, TONGUE_IDLE, 8, 18) },
  { id: 'spore_atk', palette: SPORE_PAL, rows: stamp(SPORE_WITH_MOUTH, TONGUE_ATTACK, 7, 16) },
];
