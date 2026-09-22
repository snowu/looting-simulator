import { createRng, hashString } from '../core/rng';
import type { Prop } from './dungeon';
import { manhattan } from '../core/math';

export function iciclesFor(seed: number, depth: number, tiles: number[], width: number, exclude: { x: number; y: number }[]): Prop[] {
  const rng = createRng(hashString(`icicles:${seed}:${depth}`));
  const blocked = new Set(exclude.map(({ x, y }) => y * width + x));
  const candidates = rng.shuffle(tiles.flatMap((t, i) => t === 1 && !blocked.has(i) ? [i] : []));
  const centres: { x: number; y: number }[] = [];
  const out: Prop[] = [];
  const target = rng.int(8, 14);
  for (const i of candidates) {
    const x = i % width, y = Math.floor(i / width);
    if (centres.some((c) => manhattan(c.x, c.y, x, y) < 4)) continue;
    const neighbours = candidates.filter((n) => manhattan(n % width, Math.floor(n / width), x, y) <= 1);
    if (neighbours.length < 2) continue;
    centres.push({ x, y });
    for (const n of rng.shuffle(neighbours).slice(0, rng.int(2, 5))) {
      out.push({ id: `icicle:${out.length}`, kind: 'icicle', x: n % width, y: Math.floor(n / width),
        used: false, tier: 'none', blocking: false, mimic: false,
        ceiling: { height: rng.float(0.35, 0.9), dx: rng.float(-0.55, 0.55), dz: rng.float(-0.55, 0.55), sprite: rng.pick(['icicle_stub', 'icicle_spike', 'icicle_fang']) },
      });
    }
    if (centres.length >= target) break;
  }
  return out;
}
