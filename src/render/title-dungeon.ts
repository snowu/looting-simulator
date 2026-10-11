import { createRng, randomSeed } from '../core/rng';
import { Dir, DIRS, DX, DY } from '../core/dir';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { BIOMES, FINAL_DEPTH } from '../data/biomes';
import { blocksMove, blocksSight, enemyAt, inBounds, generateFloor, WALL } from '../systems/dungeon';

/** A private diorama. Never tick this World: creatures remain unaware of the viewer. */
export function createTitleDungeon(seed = randomSeed()): World {
  const state = newGame(createRng(seed));
  const run = startRun(state, seed);
  // Sample regular environments uniformly, independently of a live run's
  // depth or roads. Secret quirks are never applied to this generated floor.
  const biome = createRng(seed).fork('title-biome').pick(BIOMES.filter(b => b.depths.some(d => d < FINAL_DEPTH)));
  const depth = biome.depths.find(d => d < FINAL_DEPTH)!;
  const floor = generateFloor(seed, depth, 'hard', false, biome.id);
  run.depth = depth;
  run.floors = Array.from({ length: depth }, () => null);
  run.floors[depth - 1] = floor;
  // A roomy chamber, viewed diagonally from its corner, gives the backdrop
  // depth and a visible wall of torchlight rather than a close-up of stairs.
  const rooms = floor.rooms.filter(r => r.role !== 'secret' && r.role !== 'vault');
  const room = rooms.reduce((best, r) => r.w * r.h > best.w * best.h ? r : best);
  const candidates: { x: number; y: number; score: number }[] = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (!blocksMove(floor, x, y) && !enemyAt(floor, x, y)) {
        let clearance = 8;
        for (const offset of [-0.35, 0, 0.35]) {
          const yaw = Math.PI / 5 + offset;
          for (let distance = 0.5; distance <= 8; distance += 0.5) {
            const sx = Math.floor(x + 0.5 + Math.sin(yaw) * distance);
            const sy = Math.floor(y + 0.5 - Math.cos(yaw) * distance);
            if (blocksSight(floor, sx, sy)) { clearance = Math.min(clearance, distance); break; }
          }
        }
        const cornerDistance = Math.abs(x - room.x - 1) + Math.abs(y - room.y - room.h + 2);
        candidates.push({ x, y, score: clearance * 10 - cornerDistance });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const camera = candidates[0];
  if (camera) { run.player.x = camera.x; run.player.y = camera.y; }
  run.player.facing = Dir.N;
  // Dress this isolated chamber with a few wall sconces so even a sparse
  // torch roll has a readable silhouette. The generated playable floor is untouched.
  for (const point of candidates.slice().reverse()) {
    if (floor.torches.filter(t => t.x >= room.x && t.x < room.x + room.w && t.y >= room.y && t.y < room.y + room.h).length >= 3) break;
    if (floor.torches.some(t => Math.abs(t.x - point.x) + Math.abs(t.y - point.y) < 4)) continue;
    const side = DIRS.find(d => inBounds(floor, point.x + DX[d], point.y + DY[d]) && floor.tiles[(point.y + DY[d]) * floor.width + point.x + DX[d]] === WALL);
    if (side !== undefined) floor.torches.push({ x: point.x, y: point.y, side });
  }
  const world = new World(state);
  world.anim.fromX = run.player.x;
  world.anim.fromY = run.player.y;
  world.anim.yaw = Math.PI / 5;
  return world;
}
