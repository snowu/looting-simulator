import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { newGame } from '../state/game-state';
import { generateFloor, stairsAt } from '../systems/dungeon';
import { FORK_DEPTH, ROAD_BIOMES, roadsForDay } from '../data/routes';
import { startRun } from '../systems/run';
import { World, WorldEvent } from '../world/world';

interface Private {
  changeFloor(dir: 'down' | 'up'): void;
  arrive(): void;
  events: WorldEvent[];
}
const priv = (w: World) => w as unknown as Private;

/** A world standing on depth 2's down stair, with the fork still open. */
function atFork(seed = 401): World {
  const state = newGame(createRng(seed));
  startRun(state, seed);
  const w = new World(state);
  priv(w).changeFloor('down');
  const down = w.floor.stairs.find((s) => s.down)!;
  Object.assign(w.player, { x: down.x, y: down.y });
  return w;
}

describe('the day\'s roads', () => {
  it('are two different road biomes, the same all day', () => {
    for (let day = 1; day < 40; day++) {
      const roads = roadsForDay('save-a', day, []);
      expect(roads).toHaveLength(2);
      expect(roads[0]).not.toBe(roads[1]);
      for (const r of roads) expect(ROAD_BIOMES).toContain(r);
      expect(roadsForDay('save-a', day, [])).toEqual(roads);
    }
  });

  it('lean towards the road a market event favours', () => {
    let plain = 0, shortage = 0;
    for (let day = 1; day <= 400; day++) {
      if (roadsForDay('save-b', day, []).includes('mines')) plain++;
      if (roadsForDay('save-b', day, [{ id: 'iron_shortage' }]).includes('mines')) shortage++;
    }
    expect(shortage).toBeGreaterThan(plain + 60);
  });

  it('are what a new delve is given', () => {
    const state = newGame(createRng(402));
    startRun(state, 402);
    expect(state.run!.roads).toEqual(roadsForDay(state.saveId ?? '', state.market.day, state.market.events));
    expect(state.run!.road).toBeUndefined();
  });
});

describe('the fork', () => {
  it('stops you at depth 2\'s down stair and asks, instead of descending', () => {
    const w = atFork();
    expect(w.run.depth).toBe(FORK_DEPTH);
    expect(w.forkPending()).toBe(true);
    priv(w).events.length = 0;
    priv(w).arrive();
    expect(priv(w).events.some((e) => e.type === 'fork')).toBe(true);
    expect(w.anim.transition).toBeNull();
  });

  it('taking a road sets depths 3 and 4 to it, and only those', () => {
    const w = atFork(403);
    const road = w.run.roads![1];
    expect(w.chooseRoad('not-a-road')).toBe(false);
    expect(w.chooseRoad(road)).toBe(true);
    expect(w.run.road).toBe(road);
    expect(w.forkPending()).toBe(false);
    priv(w).changeFloor('down');
    expect(w.floor.biome).toBe(road);
    priv(w).changeFloor('down');
    expect(w.floor.biome).toBe(road);
  });

  it('asks only once: back up and down again goes straight through', () => {
    const w = atFork(404);
    w.chooseRoad(w.run.roads![0]);
    priv(w).changeFloor('down');
    priv(w).changeFloor('up');
    expect(w.forkPending()).toBe(false);
  });

  it('a delve from before the fork existed has none', () => {
    const w = atFork(405);
    delete w.run.roads;
    expect(w.forkPending()).toBe(false);
    expect(stairsAt(w.floor, w.player.x, w.player.y)?.down).toBe(true);
  });
});

describe('generation', () => {
  it('honours the road only where the biome can be', () => {
    expect(generateFloor(7, 3, 'hard', false, 'frostvault').biome).toBe('frostvault');
    expect(generateFloor(7, 4, 'hard', false, 'sporegrove').biome).toBe('sporegrove');
    // The Mines do not reach depth 5: the road is ignored there.
    expect(generateFloor(7, 5, 'hard', false, 'mines').biome).not.toBe('mines');
    expect(generateFloor(7, 3, 'hard').biome).toBe(generateFloor(7, 3, 'hard', false, undefined).biome);
  });
});
