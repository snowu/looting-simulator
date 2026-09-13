import { describe, expect, it } from 'vitest';
import { biomeForDepth, biomeForFloor } from '../data/biomes';
import { generateFloor } from '../systems/dungeon';

describe('run biome variety', () => {
  it('chooses reproducible, different environments on depths 1–5', () => {
    for (let depth = 1; depth <= 5; depth++) {
      const ids = new Set<string>();
      for (let seed = 1; seed <= 12; seed++) {
        const floor = generateFloor(seed, depth);
        expect(floor.biome).toBe(biomeForDepth(depth, floor.seed).id);
        expect(biomeForFloor(floor).id).toBe(floor.biome);
        expect(generateFloor(seed, depth).biome).toBe(floor.biome);
        ids.add(floor.biome);
      }
      expect(ids.size).toBeGreaterThan(1);
    }
  });

  it('keeps the final floor as the throne', () => {
    for (let seed = 1; seed <= 12; seed++) expect(generateFloor(seed, 6).biome).toBe('throne');
  });
});
