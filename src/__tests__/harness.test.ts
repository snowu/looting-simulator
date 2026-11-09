import { describe, it, expect } from 'vitest';
import { Dir } from '../core/dir';
import { FLOOR, WALL, blocksMove } from '../systems/dungeon';
import { room, spawn, spawnAt, tick } from './harness';

describe('test harness', () => {
  it('builds the same room whatever floor the seed would have generated', () => {
    const a = room({ seed: 1 });
    const b = room({ seed: 977 });
    expect(a.floor.tiles).toEqual(b.floor.tiles);
    expect([a.player.x, a.player.y, a.player.facing]).toEqual([b.player.x, b.player.y, b.player.facing]);
  });

  it('is a walled, empty rectangle with the player in the middle', () => {
    const w = room({ width: 9, height: 7, facing: Dir.E });
    const f = w.floor;
    const open = f.tiles.filter((t) => t === FLOOR).length;
    expect(open).toBe(9 * 7);
    expect(f.tiles.filter((t) => t === WALL).length).toBe(f.tiles.length - open);
    for (const list of [f.enemies, f.props, f.traps, f.doors, f.stairs, f.pickups, f.surfaces ?? [], f.cracks ?? []]) expect(list).toHaveLength(0);
    expect(f.quirk).toBeUndefined();
    expect(w.player.facing).toBe(Dir.E);
    expect(blocksMove(f, w.player.x, w.player.y)).toBe(false);
    // Middle: four open tiles to the east wall, three to the north.
    expect(blocksMove(f, w.player.x + 4, w.player.y)).toBe(false);
    expect(blocksMove(f, w.player.x + 5, w.player.y)).toBe(true);
    expect(blocksMove(f, w.player.x, w.player.y - 3)).toBe(false);
    expect(blocksMove(f, w.player.x, w.player.y - 4)).toBe(true);
  });

  it('applies difficulty and prepare before the run starts', () => {
    const w = room({ difficulty: 'normal', prepare: (s) => { s.equipment.offhand = null; } });
    expect(w.diff.id).toBe('normal');
    expect(w.state.equipment.offhand).toBeNull();
  });

  it('spawns monsters ahead of the player, facing them, with distinct ids', () => {
    const w = room();
    const a = spawn(w, 'rat', 2);
    const b = spawnAt(w, 'rat', w.player.x + 1, w.player.y);
    expect([a.x, a.y]).toEqual([w.player.x, w.player.y - 2]);
    expect(a.facing).toBe(Dir.S);
    expect(a.id).not.toBe(b.id);
  });

  it('runs the clock at 60 fps', () => {
    const w = room();
    let ticks = 0;
    tick(w, 1, () => ticks++);
    expect(ticks).toBe(60);
  });
});
