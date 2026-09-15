import { ArtDef } from './raster';

// One thick iron leaf: bowed braces, rivets and a sagging, orange-hot lower
// edge. The upper half remains cold enough to read as metal rather than lava.
const pixels = Array.from({ length: 32 }, () => Array(32).fill('k'));
for (let y = 2; y < 31; y++) for (let x = 2; x < 30; x++) {
  const bottom = 27 + Math.round(1.7 * Math.sin(x * 0.27) ** 2);
  const grain = (x * 13 + y * 7) % 23;
  const seam = 15 + Math.round(Math.sin(y * 0.24));
  const brace = [8, 19].some(row => y === row + Math.round(Math.sin(x * 0.13) * 2));
  if (y > bottom) pixels[y][x] = y === bottom + 1 && x % 7 < 2 ? 'o' : 'k';
  else if (y === bottom) pixels[y][x] = x % 5 === 0 ? 'h' : 'o';
  else if (y > bottom - 2) pixels[y][x] = 'r';
  else if (x === seam) pixels[y][x] = y > 21 ? 'o' : 'k';
  else if (x === seam - 1) pixels[y][x] = y > 18 ? 'r' : 's';
  else if (brace) pixels[y][x] = 's';
  else if (x === 2 || x === 29) pixels[y][x] = 's';
  else pixels[y][x] = grain === 0 ? 's' : grain < 5 ? 'd' : 'i';
}
for (const y of [4, 13, 23]) for (const x of [4, 27]) {
  pixels[y][x] = 'n'; pixels[y + 1][x] = 's';
}
// Heat-distorted hinge straps and an offset iron pull ring.
for (const y of [7, 20]) for (let x = 1; x < 8; x++) pixels[y][x] = x === 4 ? 'n' : 's';
for (const [x, y] of [[23,15],[24,15],[22,16],[25,16],[22,17],[25,17],[23,18],[24,18]]) pixels[y][x] = 'n';
export const EMBER_DOOR: ArtDef = {
  id: 'door_emberworks', rows: pixels.map(row => row.join('')),
  palette: { k: '#100e10', i: '#393033', d: '#282327', s: '#655051', n: '#a38272', r: '#9b391afa', o: '#e86b20fa', h: '#ffb549fa' },
};
