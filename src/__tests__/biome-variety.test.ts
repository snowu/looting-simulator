import { describe, expect, it } from 'vitest';
import { BIOMES, biomeForDepth, biomeForFloor } from '../data/biomes';
import { getArt } from '../art/registry';
import { rasterize } from '../art/raster';
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

  it('gives the vault, forge and burrows visibly different floors', () => {
    const ids = ['frostvault', 'emberworks', 'burrows', 'mines'];
    const floors = ids.map((id) => BIOMES.find((b) => b.id === id)!.floor);
    expect(new Set(floors).size).toBe(ids.length);
    const pixels = floors.map((id) => Array.from(rasterize(getArt(id)!, undefined, getArt).data).join(','));
    expect(new Set(pixels).size).toBe(ids.length);
    expect(BIOMES.find((b) => b.id === 'burrows')!.wall).not.toBe(BIOMES.find((b) => b.id === 'emberworks')!.wall);
  });
});
