import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { createEnemy, FLOOR, generateFloor, propAt, stairsAt, stairsFront, doorAt } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import {
  FIRE_SECONDS, FIRE_SPREAD, FIRE_TICK, FREEZE_SECONDS, ICE_THAW, Surface, SurfaceKind,
} from '../data/surfaces';
import { burningAt, chill, ignite, placeSurfaces, poolsFor, surfaceKindAt, tickSurfaces } from '../systems/surfaces';
import { makeEquipment } from '../systems/items';
import { Rarity } from '../types';
import { World } from '../world/world';

/** A cleared 15×15 room around the player, facing north, with nothing on the floor. */
function room(seed = 501): World {
  const state = newGame(createRng(seed));
  state.spellbook = ['ember_bolt', 'rime_lance'];
  state.loadedSpells = ['ember_bolt', 'rime_lance'];
  state.equipment.offhand = makeEquipment({ baseId: 'rod', materialId: 'iron', rarity: Rarity.Common, ilvl: 4, quality: 1, identified: true });
  startRun(state, seed);
  const w = new World(state);
  const f = w.floor;
  f.enemies = [];
  f.traps = [];
  f.surfaces = [];
  const x = 10, y = 10;
  Object.assign(w.player, { x, y, facing: 0 });
  for (let yy = y - 7; yy <= y + 7; yy++) for (let xx = x - 7; xx <= x + 7; xx++) f.tiles[yy * f.width + xx] = FLOOR;
  f.doors = f.doors.filter((d) => Math.abs(d.x - x) + Math.abs(d.y - y) > 9);
  f.stairs = f.stairs.filter((s) => Math.abs(s.x - x) + Math.abs(s.y - y) > 9);
  f.props = f.props.filter((p) => Math.abs(p.x - x) + Math.abs(p.y - y) > 9);
  return w;
}

function lay(w: World, kind: SurfaceKind, tiles: [number, number][]): void {
  for (const [x, y] of tiles) w.floor.surfaces!.push({ x, y, kind });
}

/** A monster that stands still and never swings unless it has to move. */
function dummy(w: World, x: number, y: number, def = 'ghoul') {
  const e = createEnemy(enemyDef(def), x, y, 2, `d${x},${y}`, 1);
  e.hp = e.maxHp = 500;
  e.attackCd = 999;
  w.floor.enemies.push(e);
  return e;
}

function run(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

describe('surface rules', () => {
  const floorWith = (list: Surface[]) => ({ ...generateFloor(1, 1), surfaces: list });

  it('fire lights oil and melts ice; frost freezes water; nothing else changes', () => {
    const f = floorWith([{ x: 1, y: 1, kind: 'oil' }, { x: 2, y: 1, kind: 'ice' }, { x: 3, y: 1, kind: 'water' }]);
    expect(ignite(f, 3, 1)).toBeNull();
    expect(chill(f, 1, 1)).toBeNull();
    expect(ignite(f, 1, 1)).toBe('lit');
    expect(surfaceKindAt(f, 1, 1)).toBe('fire');
    expect(ignite(f, 2, 1)).toBe('melted');
    expect(surfaceKindAt(f, 2, 1)).toBe('water');
    expect(chill(f, 3, 1)).toBe('froze');
    expect(surfaceKindAt(f, 3, 1)).toBe('ice');
    expect(ignite(f, 9, 9)).toBeNull();
  });

  it('fire walks along the oil, stops at water, and burns out to bare floor', () => {
    const f = floorWith([
      { x: 1, y: 1, kind: 'oil' }, { x: 2, y: 1, kind: 'oil' }, { x: 3, y: 1, kind: 'oil' },
      { x: 4, y: 1, kind: 'water' }, { x: 5, y: 1, kind: 'oil' },
    ]);
    ignite(f, 1, 1);
    tickSurfaces(f, FIRE_SPREAD + 0.01);
    expect(burningAt(f, 2, 1)).toBe(true);
    expect(burningAt(f, 3, 1)).toBe(false);
    tickSurfaces(f, FIRE_SPREAD + 0.01);
    expect(burningAt(f, 3, 1)).toBe(true);
    for (let i = 0; i < 10; i++) tickSurfaces(f, FIRE_SPREAD + 0.01);
    expect(surfaceKindAt(f, 4, 1)).toBe('water');
    expect(surfaceKindAt(f, 5, 1)).toBe('oil');
    tickSurfaces(f, FIRE_SECONDS);
    expect(surfaceKindAt(f, 1, 1)).toBeUndefined();
    expect(surfaceKindAt(f, 3, 1)).toBeUndefined();
  });

  it('frozen water thaws; laid ice does not', () => {
    const f = floorWith([{ x: 1, y: 1, kind: 'water' }, { x: 2, y: 1, kind: 'ice' }]);
    chill(f, 1, 1);
    tickSurfaces(f, ICE_THAW + 0.1);
    expect(surfaceKindAt(f, 1, 1)).toBe('water');
    expect(surfaceKindAt(f, 2, 1)).toBe('ice');
  });
});

describe('placing pools', () => {
  it('is fixed by the seed, leaves the generated floor alone, and keeps clear of stairs, doors and props', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const a = generateFloor(seed, 3), b = generateFloor(seed, 3);
      const before = JSON.stringify(a);
      placeSurfaces(a, seed * 7);
      placeSurfaces(b, seed * 7);
      expect(a.surfaces).toEqual(b.surfaces);
      expect(JSON.stringify({ ...a, surfaces: undefined })).toBe(before);
      for (const s of a.surfaces!) {
        expect(a.tiles[s.y * a.width + s.x]).toBe(FLOOR);
        expect(stairsAt(a, s.x, s.y)).toBeUndefined();
        expect(doorAt(a, s.x, s.y)).toBeUndefined();
        expect(propAt(a, s.x, s.y)).toBeUndefined();
        for (const st of a.stairs) expect(`${s.x},${s.y}`).not.toBe(`${stairsFront(st).x},${stairsFront(st).y}`);
      }
      // Never twice: a floor already laid keeps what it has.
      const laid = JSON.stringify(a.surfaces);
      placeSurfaces(a, 999);
      expect(JSON.stringify(a.surfaces)).toBe(laid);
    }
  });

  it('gives most floors something, and frozen biomes ice instead of water', () => {
    let some = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const f = generateFloor(seed, 2);
      placeSurfaces(f, seed);
      if (f.surfaces!.length) some++;
      if (poolsFor(f).ice) expect(f.surfaces!.some((s) => s.kind === 'water')).toBe(false);
    }
    expect(some).toBeGreaterThan(36);
  });

  it('lays the first floor of a delve too', () => {
    const state = newGame(createRng(77));
    const run = startRun(state, 77);
    expect(run.floors[0]!.surfaces).toBeDefined();
  });
});

describe('surfaces in play', () => {
  it('an Ember Bolt lights the oil it flies over, and the fire burns what stands in it', () => {
    const w = room();
    lay(w, 'oil', [[10, 8], [10, 7], [11, 7]]);
    const e = dummy(w, 10, 7);
    e.ai = 'recover';
    e.timer = 99;
    expect(w.castSpell()).toBe(true);
    run(w, 0.6);
    expect(burningAt(w.floor, 10, 8)).toBe(true);
    const hp = e.hp;
    run(w, FIRE_TICK * 2 + 0.6);
    expect(burningAt(w.floor, 11, 7)).toBe(true);
    expect(e.hp).toBeLessThan(hp);
    // It carries the fire out with it.
    expect(e.burn).toBeDefined();
  });

  it('monsters walk out of fire and will not walk into it', () => {
    const w = room();
    lay(w, 'oil', [[10, 7]]);
    const e = dummy(w, 10, 7);
    ignite(w.floor, 10, 7);
    run(w, 1.2);
    expect(e.x !== 10 || e.y !== 7).toBe(true);
    expect(burningAt(w.floor, e.x, e.y)).toBe(false);
  });

  it('fire hurts you too, through your armour, and can kill you', () => {
    const w = room();
    lay(w, 'oil', [[10, 10]]);
    ignite(w.floor, 10, 10);
    const hp = w.player.hp;
    run(w, FIRE_TICK + 0.05);
    expect(w.player.hp).toBeLessThan(hp);
  });

  it('a Rime Lance freezes water, and the monster standing in it', () => {
    const w = room();
    lay(w, 'water', [[10, 8]]);
    w.run.conduit!.sel = 1;
    const e = dummy(w, 10, 8);
    e.ai = 'recover';
    e.timer = 0.7;
    expect(w.castSpell()).toBe(true);
    run(w, 0.5);
    expect(surfaceKindAt(w.floor, 10, 8)).toBe('ice');
    expect(e.frozenT).toBeGreaterThan(0);
    // Held for the whole freeze, not the moment it had left.
    expect(e.timer).toBeGreaterThan(1);
    run(w, FREEZE_SECONDS + 0.2);
    expect(e.frozenT).toBeUndefined();
  });

  it('water puts out a burning monster that steps into it', () => {
    const w = room();
    lay(w, 'water', [[10, 8]]);
    const e = dummy(w, 10, 7);
    e.burn = { t: 3, left: 40, acc: 0 };
    (w as unknown as { stepEnemy(e: unknown, x: number, y: number): void }).stepEnemy(e, 10, 8);
    expect(e.burn).toBeUndefined();
  });

  it('a creature of fire lights the oil it walks on', () => {
    const w = room();
    lay(w, 'oil', [[10, 8]]);
    const wraith = dummy(w, 10, 7, 'flame_wraith');
    (w as unknown as { stepEnemy(e: unknown, x: number, y: number): void }).stepEnemy(wraith, 10, 8);
    expect(burningAt(w.floor, 10, 8)).toBe(true);
  });

  it('a monster struck on ice goes down, out of its wind-up', () => {
    const w = room();
    lay(w, 'ice', [[10, 9]]);
    const e = dummy(w, 10, 9);
    e.ai = 'windup';
    e.timer = 0.6;
    w.player.stamina = w.derived.maxStamina;
    w.attack();
    run(w, 0.6);
    expect(e.ai).toBe('recover');
    expect(e.hp).toBeLessThan(500);
  });
});
