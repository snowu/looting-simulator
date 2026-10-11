import { describe, expect, it } from 'vitest';
import { createTitleDungeon } from '../render/title-dungeon';
import { BOSS_ID } from '../data/enemies';
import { blocksMove, inBounds } from '../systems/dungeon';

describe('title dungeon', () => {
  it('places the camera on walkable tiles across generated layouts', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const world = createTitleDungeon(seed);
      expect(inBounds(world.floor, world.player.x, world.player.y)).toBe(true);
      expect(blocksMove(world.floor, world.player.x, world.player.y)).toBe(false);
      expect(world.anim.fromX).toBe(world.player.x);
      expect(world.anim.fromY).toBe(world.player.y);
    }
  });
  it('owns independent state and generates different layouts', () => {
    const a = createTitleDungeon(123);
    const b = createTitleDungeon(456);
    expect(a.state).not.toBe(b.state);
    expect(a.floor.seed).not.toBe(b.floor.seed);
    expect(a.floor.tiles).not.toEqual(b.floor.tiles);
    expect(a.run.stats.time).toBe(0);
    expect(a.floor.enemies.every(e => e.alert === 0)).toBe(true);
  });
  it('samples every regular biome while excluding boss and secret floors', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      const world = createTitleDungeon(seed);
      seen.add(world.floor.biome);
      expect(world.floor.depth).toBeLessThan(6);
      expect(world.floor.quirk).toBeUndefined();
      expect(world.floor.rooms.some(r => r.role === 'throne')).toBe(false);
      expect(world.floor.enemies.some(e => e.def === BOSS_ID)).toBe(false);
    }
    expect([...seen].sort()).toEqual(['burrows', 'catacombs', 'crypt', 'emberworks', 'frostvault', 'mines', 'sporegrove']);
  });

});
