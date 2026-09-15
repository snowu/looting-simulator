import { ArtDef } from './raster';
import { rows, stamp } from './helpers';

const blank = () => Array.from({ length: 32 }, () => '.'.repeat(32));
const ICE = { h: '#eefaff', b: '#83bad780', d: '#32608098', c: '#b9e6f470', q: '#bdeafffa', r: '#578aaa' };
const glaze = rows(`
  ..hhhhhhhh.....
  .hccccccccbh...
  hccbbbbbbbbbh..
  hcbbbbbbbbbbbd.
  hcbbbbbbbbbbbd.
  .cbbbbbbbbbbbd.
  .cbbbbbbbbbbd..
  ..cbbbbbbbbbd..
  ...bbbbbbbbd...
  ....bbbbbbd....
  .....dddddd....
`);
const fall = rows(`
  hhhhhhhhhhhhhhh
  hcccbbccbbbccbd
  hcbbbbbbbbbbbd.
  hcbbbbbbbbbbbd.
  .hcbbbbbbbbbd..
  .hcbbbbbbbbbd..
  ..hcbbbbbbbd...
  ..hcbbbbbbbd...
  ...hcbbbbbd....
  ...hcbbbbbd....
  ....hcbbbd.....
  ....hcbbbd.....
  .....hbbd......
  .....hbbd......
  ......hd.......
  ......hd.......
`);
const split = rows(`
  ....hrd...
  ....hqd...
  ...hhqrd..
  ...hbqrd..
  ..hhbqqrd.
  ..hbqqrd..
  .hhbqrd...
  .hbqrd....
  ..hqrd....
  ..hrd.....
`);
const grate = rows(`
  .hhhhhhhhhhhhhh.
  hccbbbbbbbbbbbbd
  hckbkckbkckbkckd
  hckbkhkbkckbkckd
  hckbkckbkckbkckd
  hckbkckbhckbkckd
  hckbkckbkckbkckd
  hccbbbbbbbbbbbbd
  .dddddddddddddd.
`);
// Irregular rock cells. Their centres and facets are fixed art coordinates,
// unrelated to generation RNG. Two substrates avoid a repeating flagstone grid.
function rock(offset: number): string[] {
  const centres = [[2, 3], [13, 1], [26, 5], [5, 15], [18, 13], [29, 20], [12, 27], [24, 30]];
  return Array.from({ length: 32 }, (_, y) => Array.from({ length: 32 }, (_, x) => {
    const ds = centres.map(([cx, cy], i) => ({ i, d: Math.abs(x - ((cx + offset) % 32)) + Math.abs(y - cy) * 0.8 })).sort((a, b) => a.d - b.d);
    if (ds[1].d - ds[0].d < 1.2) return 'k';
    const n = (x * 7 + y * 13 + ds[0].i * 3) % 29;
    return n === 0 ? 'h' : n < 4 ? 'd' : ds[0].i % 2 ? 'b' : 'a';
  }).join(''));
}
const ROCK = { k: '#182733', a: '#354954', b: '#405461', d: '#263a48', h: '#6c8590' };
const roof = stamp(stamp(blank(), fall.slice(0, 5), 2, 3), fall.slice(0, 4), 18, 21);
export const FROST_TEXTURES: ArtDef[] = [
  { id: 'wall_frostvault_glaze', base: 'wall_frostvault', palette: ICE, rows: stamp(stamp(blank(), glaze, 2, 7), glaze, 15, 17) },
  { id: 'wall_frostvault_fall', base: 'wall_frostvault', palette: ICE, rows: stamp(blank(), fall, 9, 1) },
  { id: 'wall_frostvault_split', base: 'wall_frostvault', palette: ICE, rows: stamp(blank(), split, 11, 9) },
  { id: 'wall_frostvault_grate', base: 'wall_frostvault', palette: { ...ICE, k: '#233641' }, rows: stamp(blank(), grate, 8, 12) },
  { id: 'floor_frostvault_rock', palette: ROCK, rows: rock(0) },
  { id: 'floor_frostvault_rock_b', palette: ROCK, rows: rock(7) },
  { id: 'floor_frostvault', base: 'floor_frostvault_rock', palette: ICE, rows: stamp(stamp(blank(), glaze, 2, 3), split, 21, 20) },
  { id: 'floor_frostvault_ice', base: 'floor_frostvault_rock_b', palette: ICE, rows: stamp(stamp(stamp(blank(), glaze, 1, 1), glaze, 17, 7), glaze, 5, 19) },
  { id: 'ceil_frostvault', base: 'floor_frostvault_rock_b', palette: ICE, rows: roof },
];
