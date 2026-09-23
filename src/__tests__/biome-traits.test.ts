import { describe, expect, it } from 'vitest';
import { BIOMES, biomeForFloor } from '../data/biomes';
import { LAWS, lawFor } from '../data/laws';

const having = (pick: (b: (typeof BIOMES)[number]) => unknown) => BIOMES.filter(pick).map((b) => b.id).sort();

describe('biome traits', () => {
  // Each trait replaced a hand-written list of biome ids. These are those lists.
  it('keep the biomes they were written for', () => {
    expect(having((b) => b.earth)).toEqual(['burrows', 'mines']);
    expect(having((b) => b.graves)).toEqual(['catacombs', 'crypt']);
    expect(having((b) => b.frozen)).toEqual(['frostvault']);
    expect(having((b) => b.molten)).toEqual(['emberworks']);
    expect(having((b) => b.flooded)).toEqual(['catacombs']);
    expect(having((b) => b.ceilingFromAbove)).toEqual(['burrows']);
    expect(having((b) => b.vessel === 'barrel')).toEqual(['mines', 'sporegrove']);
    expect(having((b) => b.vessel === 'root_cache')).toEqual(['burrows']);
    // The retired Glowing Warrens still furnish old floors with barrels.
    expect(biomeForFloor({ biome: 'caverns', depth: 5 }).vessel).toBe('barrel');
  });

  it('give each law to exactly one biome', () => {
    expect(Object.fromEntries(BIOMES.filter((b) => b.law).map((b) => [b.law, b.id]))).toEqual({
      restless: 'crypt', collapse: 'mines', noise: 'burrows',
    });
    for (const b of BIOMES) expect(lawFor(b)).toBe(b.law ? LAWS[b.law] : undefined);
  });
});
