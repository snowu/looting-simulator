import { createTitleDungeon } from '../render/title-dungeon';
import { biomeForFloor } from '../data/biomes';

/** Fixed seeded chambers with dark stone and bright ice for grading review. */
export function visualWorld(scene: 'title' | 'dark' | 'bright') {
  const biome = scene === 'bright' ? 'frostvault' : 'crypt';
  for (let seed = 1; seed <= 1000; seed++) {
    const world = createTitleDungeon(seed);
    if (biomeForFloor(world.floor).id === biome) return world;
  }
  throw new Error(`No visual fixture found for ${biome}`);
}
