import { describe, expect, it } from 'vitest';
import { BIOMES, biomeForDepth, biomeForFloor, ceilingForFloor } from '../data/biomes';
import { enemyDef } from '../data/enemies';
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

  it('keeps the retired duplicate cavern biome out of the choices', () => {
    expect(BIOMES.some((b) => b.id === 'caverns')).toBe(false);
    for (let seed = 1; seed <= 12; seed++) expect(generateFloor(seed, 5).biome).not.toBe('caverns');
    expect(biomeForFloor({ biome: 'caverns', depth: 5 }).id).toBe('caverns');
  });

  it('gives the vault, forge and burrows visibly different floors', () => {
    const ids = ['frostvault', 'emberworks', 'burrows', 'mines'];
    const floors = ids.map((id) => BIOMES.find((b) => b.id === id)!.floor);
    expect(new Set(floors).size).toBe(ids.length);
    const pixels = floors.map((id) => Array.from(rasterize(getArt(id)!, undefined, getArt).data).join(','));
    expect(new Set(pixels).size).toBe(ids.length);
    expect(BIOMES.find((b) => b.id === 'burrows')!.wall).not.toBe(BIOMES.find((b) => b.id === 'emberworks')!.wall);
  });

  it('gives the Catacombs and Frost Vault their own detailed wall variants', () => {
    const base = rasterize(getArt('wall_crypt')!, undefined, getArt).data;
    const walls = ['wall_catacombs', 'wall_frostvault'].map((id) => getArt(id)!);
    expect(walls.map((wall) => wall.base)).toEqual(['wall_crypt', 'wall_frostvault_brick']);
    for (const wall of walls) {
      expect(Array.from(rasterize(wall, undefined, getArt).data)).not.toEqual(Array.from(base));
    }
  });

  it('mixes four distinct Emberworks walls with two unlit hash slots', () => {
    const biome = BIOMES.find((b) => b.id === 'emberworks')!;
    const variants = biome.wallVariants!;
    expect(variants).toHaveLength(5);
    expect(variants.filter((id) => id === biome.wall)).toHaveLength(2);
    const unique = [...new Set(variants)];
    expect(unique).toHaveLength(4);
    const pixels = unique.map((id) => rasterize(getArt(id)!, undefined, getArt).data);
    expect(new Set(pixels.map((data) => Array.from(data).join(','))).size).toBe(4);
    for (let i = 0; i < unique.length; i++) {
      const glow = pixels[i].filter((v, index) => index % 4 === 3 && v === 250).length;
      if (unique[i] === biome.wall) expect(glow).toBe(0);
      else expect(glow).toBeGreaterThan(0);
      // The translucent rim must blend into opaque masonry, not cut holes in it.
      expect(pixels[i].every((v, index) => index % 4 !== 3 || v >= 250)).toBe(true);
    }
  });

  it('gives Emberworks a hot ceiling instead of reusing the mine roof', () => {
    const ember = rasterize(getArt('ceil_emberworks')!, undefined, getArt);
    const mine = rasterize(getArt('ceil_mine')!, undefined, getArt);
    expect(Array.from(ember.data)).not.toEqual(Array.from(mine.data));
    expect(getArt('ceil_emberworks')!.base).toBeUndefined();
    expect(BIOMES.find(b => b.id === 'emberworks')!.ceilingVariants).toHaveLength(4);
  });

  it('carries whatever preceding floor texture exists into the burrows roof', () => {
    const burrows = BIOMES.find((b) => b.id === 'burrows')!;
    const crypt = BIOMES.find((b) => b.id === 'crypt')!;
    const catacombs = BIOMES.find((b) => b.id === 'catacombs')!;
    const current = { biome: burrows.id, depth: 2 };
    expect(ceilingForFloor(current, { biome: crypt.id, depth: 1 })).toBe(crypt.floor);
    expect(ceilingForFloor(current, { biome: catacombs.id, depth: 1 })).toBe(catacombs.floor);
    expect(ceilingForFloor(current, { biome: burrows.id, depth: 1 })).toBe(burrows.floor);
    // Depth-1 Burrows has no floor above: its own packed-earth roof.
    expect(burrows.ceiling).toBe('ceil_burrows');
    expect(ceilingForFloor(current)).toBe('ceil_burrows');
  });

  it('keeps elemental spawns aligned with elemental biomes', () => {
    const aligned = new Map<'fire' | 'frost', number>([['fire', 0], ['frost', 0]]);
    const neutral = new Map<'fire' | 'frost', number>([['fire', 0], ['frost', 0]]);
    for (let seed = 1; seed <= 48; seed++) {
      for (let depth = 3; depth <= 5; depth++) {
        const floor = generateFloor(seed, depth);
        const theme = BIOMES.find((b) => b.id === floor.biome)?.element;
        if (!theme) continue;
        for (const enemy of floor.enemies) {
          const def = enemyDef(enemy.def);
          if (def.element) {
            expect(def.element).toBe(theme);
            expect(def.damageType).toBe(theme);
            expect(def.resist[theme] ?? 1).toBeLessThan(1);
            aligned.set(theme, aligned.get(theme)! + 1);
          } else {
            neutral.set(theme, neutral.get(theme)! + 1);
          }
        }
      }
    }
    for (const theme of ['fire', 'frost'] as const) {
      expect(aligned.get(theme)).toBeGreaterThan(0);
      expect(aligned.get(theme)).toBeGreaterThan(neutral.get(theme)!);
    }
  });
});
