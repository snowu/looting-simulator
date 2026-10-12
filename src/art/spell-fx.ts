import { ArtDef } from './raster';
import { rows, stamp, sym } from './helpers';

/**
 * What the hitscan spells leave on screen, and the penguin Hex leaves behind.
 *
 * Smite and Hex never fly, so they have no bolt: Smite is a streak of light
 * standing over the thing it struck, Hex a puff of violet smoke. Both are
 * emissive (alpha 250), so they burn through the fog like a bolt does.
 */

/**
 * The penguin. Drawn head-on like everything else in the dungeon: a black
 * hood and back, a white front from the chin down, an orange beak and feet,
 * and flippers held out from the body so it never reads as a bottle. Small,
 * round and entirely harmless, whatever it was a moment ago.
 */
const PENGUIN_PAL: Record<string, string> = {
  k: '#101216', // outline
  b: '#262a34', // black plumage
  c: '#4a5266', // sheen on the crown
  w: '#f0f0ec', // the white front
  g: '#bcc0c8', // front in shadow
  e: '#ffffff', // eye ring
  o: '#f4a02c', // beak and feet
  p: '#b8661a', // beak and feet in shadow
};

const PENGUIN_HALF = rows(`
  ................
  ................
  ................
  ................
  ..........kkkkkk
  ........kkbbbbbb
  .......kbccbbbbb
  ......kbcbbbbbbb
  ......kbbbbbbbbb
  .....kbbbeeebbbb
  .....kbbeekebbbb
  .....kbbbeeebbko
  .....kbbbbbbbkoo
  .....kbbbbbbbbkp
  .....kbbbbbwwwww
  ....kbbbbbwwwwww
  ...kbbbbbwwwwwww
  ..kbkbbbbwwwwwww
  .kbbkbbbwwwwwwww
  .kbbkbbbwwwwwwww
  kbbkkbbbwwwwwwww
  kbbk.kbbwwwwwwww
  kbk..kbbgwwwwwww
  kbk..kbbgwwwwwww
  .k...kbbggwwwwww
  .....kbbggwwwwww
  .....kbbbggwwwww
  ......kbbbgggggg
  .......kkbbbbbbb
  .......kooookkkk
  ......kopppopk..
  ......kkkkkkk...
`);

const PENGUIN = sym(PENGUIN_HALF);

/**
 * Mid-waddle: the whole bird rocks a pixel to one side and the foot on the
 * other side comes off the floor. The renderer alternates the two frames
 * while it steps, which is the whole of the joke.
 */
function waddle(base: string[]): string[] {
  const blank = '.'.repeat(32);
  const shift = (r: string) => '.' + r.slice(0, -1);
  const body = [...base.slice(0, 29).map(shift), blank, blank, blank];
  const half = (r: string, left: boolean) => (left ? r.slice(0, 16) + '.'.repeat(16) : '.'.repeat(16) + r.slice(16));
  const near = base.slice(29).map((r) => shift(half(r, true)));
  const far = base.slice(29).map((r) => shift(half(r, false)));
  // The near foot lifted a row, over the bottom of the body; the far one planted.
  return stamp(stamp(body, near, 0, 28), far, 0, 29);
}

/**
 * Smite's streak: a column of light straight down onto the tile, white at the
 * core, gold at the edges, with a splash where it meets the floor. Drawn the
 * height of a wall; the renderer narrows it to a thread as it goes.
 */
const SMITE_PAL: Record<string, string> = {
  w: '#fffff4fa',
  y: '#fff0a0fa',
  o: '#f0c050fa',
  d: '#c08a20fa',
};

function streak(jag: number): string[] {
  const h = 48;
  const out: string[] = [];
  for (let y = 0; y < h; y++) {
    // The column wobbles a pixel either way, a different wobble each frame.
    const wob = Math.round(Math.sin(y * 0.9 + jag) * 0.8);
    const half = y > h - 9 ? 3 + (y - (h - 9)) : 3;
    const row = Array.from({ length: 16 }, (_, x) => {
      const d = Math.abs(x - 7.5 - wob);
      if (d < 1) return 'w';
      if (d < 2) return 'y';
      if (d < half - 0.5) return 'o';
      if (d < half + 0.5 && (x + y + jag) % 3 !== 0) return 'd';
      return '.';
    });
    out.push(row.join(''));
  }
  return out;
}

const SMITE_SPLASH = rows(`
  .d..............
  ..d....yy....d..
  ...o..ywwy..o...
  .d..oywwwwyo..d.
  ..ooywwwwwwyoo..
  oooyywwwwwwyyooo
`);

/** Hex's puff: a ball of violet smoke with a few sparks thrown off it. */
const POOF_PAL: Record<string, string> = {
  1: '#3a1a6efa',
  2: '#6a3cb8fa',
  3: '#9a70e8fa',
  4: '#d8c0fffa',
  x: '#fff4fffa',
};

const POOF = rows(`
  ..........x.............
  ...x....................
  ........2222....x.......
  ......22333322..........
  .....2334443322.222.....
  ....2344444333223332....
  ...2334444433333334432..
  ..x233444333333334443x..
  ...2333333332233333432..
  ..22333333221122333322..
  .2333223332111123332....
  .2344322332211223332....
  .23443222333333333322...
  .2333322233333332222....
  ..22222122333222111.....
  ....2111122222211.......
  ......11111111.....x....
  ..x.....................
`);

const POOF_B = rows(`
  .....x............x.....
  ........................
  ...22.....222...........
  ..2332...23332....22....
  ..2342..2344432..2332...
  ...22...2333332..2432...
  ..........222.....22....
  .x..222...........222...
  ...23332...22....23332..
  ...23442..2332...23442..
  ...23332..2342...23332..
  ....222....22.....222...
  ......222.....22........
  .....23332...2332...x...
  .....23432...2332.......
  ......222.....22........
  ..x.....................
  ..............x.........
`);

/** Hex's penguin, a creature like any other: exported with the enemies. */
export const PENGUIN_ART: ArtDef[] = [
  { id: 'penguin_0', palette: PENGUIN_PAL, rows: PENGUIN },
  { id: 'penguin_1', palette: PENGUIN_PAL, rows: waddle(PENGUIN) },
];

/** The hitscan spells' marks: exported with the props, like the bolts. */
export const SPELL_MARK_ART: ArtDef[] = [
  { id: 'fx_smite', palette: SMITE_PAL, rows: stamp(streak(0), SMITE_SPLASH, 0, 42) },
  { id: 'fx_smite_b', palette: SMITE_PAL, rows: stamp(streak(2.1), SMITE_SPLASH, 0, 42) },
  { id: 'fx_poof', palette: POOF_PAL, rows: POOF },
  { id: 'fx_poof_b', palette: POOF_PAL, rows: POOF_B },
];

export const SPELL_FX_ART: ArtDef[] = [...PENGUIN_ART, ...SPELL_MARK_ART];
