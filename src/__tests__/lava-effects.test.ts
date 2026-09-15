import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { EMBER_FLOORS, EMBER_VENTS, EMBER_CEILINGS, EMBER_CEILING_VENTS } from '../art/ember-floor';
import { LavaEffects, LavaSound } from '../render/lava-effects';
import { createShared } from '../render/ps1';
import { generateFloor, FLOOR, WALL } from '../systems/dungeon';

describe('cosmetic lava', () => {
  it('keeps dry crust over most of every layout and places vents inside molten pockets', () => {
    expect(new Set(EMBER_FLOORS.map(f => f.rows.join(''))).size).toBe(4);
    [...EMBER_FLOORS, ...EMBER_CEILINGS].forEach((f, i) => {
      const hot = [...f.rows.join('')].filter(c => 'hoy'.includes(c)).length;
      expect(hot).toBeGreaterThan(30);
      expect(hot).toBeLessThan(256);
      expect([...EMBER_VENTS, ...EMBER_CEILING_VENTS][i].length).toBeGreaterThan(0);
      for (const v of [...EMBER_VENTS, ...EMBER_CEILING_VENTS][i]) expect(f.rows[Math.floor((1-v.v)*32)][Math.floor(v.u*32)]).toBe('y');
    });
  });
  it('erupts on the visible floor, synchronizes sounds, and rejects sites behind walls', () => {
    const floor = generateFloor(2, 3);
    floor.tiles.fill(WALL);
    floor.props = []; floor.doors = []; floor.stairs = [];
    for (let y = 2; y <= 9; y++) for (let x = 2; x <= 9; x++) floor.tiles[y * floor.width + x] = FLOOR;
    const fx = new LavaEffects(createShared()), camera = new PerspectiveCamera(60, 1.4, 0.1, 30);
    camera.position.set(11, 1.32, 17);
    const sounds: LavaSound[] = [];
    fx.onSound = event => sounds.push(event);
    fx.reset(floor);
    for (let i = 0; i < 600; i++) fx.update(1 / 30, camera);
    expect(sounds.some(e => e.name === 'lava_drop')).toBe(true);
    expect(sounds.some(e => e.name === 'lava_land')).toBe(true);
    const bursts = sounds.filter(e => e.name === 'lava_burst');
    expect(bursts.length).toBeGreaterThanOrEqual(2);
    for (const e of bursts) {
      const point = camera.position.clone().set(e.x, 0.18, e.z).project(camera);
      expect(Math.abs(point.x)).toBeLessThan(0.8);
      expect(Math.abs(point.y)).toBeLessThan(0.78);
    }
    const count = sounds.length;
    for (let i = 0; i < 300; i++) fx.update(0, camera);
    expect(sounds).toHaveLength(count);
    // A wall immediately ahead must hide the sites on its far side.
    for (let x = 2; x <= 9; x++) floor.tiles[7 * floor.width + x] = WALL;
    fx.reset(floor); sounds.length = 0;
    for (let i = 0; i < 600; i++) fx.update(1 / 30, camera);
    expect(sounds.filter(e => e.name === 'lava_burst')).toHaveLength(0);
    fx.dispose();
  });
  it('animates with a bounded pool, freezes on pause, clears on floor change, and never edits the floor', () => {
    const f = generateFloor(2, 3), before = JSON.stringify(f);
    expect(f.biome).toBe('emberworks');
    const fx = new LavaEffects(createShared()), cam = new PerspectiveCamera();
    fx.reset(f);
    const room = f.rooms[0];
    cam.position.set((room.x+room.w/2)*2, 1.32, (room.y+room.h/2)*2);
    const meshes = fx.root.children.length;
    let visible = 0;
    for (let i=0;i<1800;i++) {
      fx.update(1/30,cam);
      visible = Math.max(visible,fx.root.children.filter(c=>c.visible).length);
      for (const c of fx.root.children.filter(c=>c.visible)) expect(c.position.y).toBeGreaterThan(0);
    }
    expect(visible).toBeGreaterThan(3);
    expect(fx.root.children.length).toBe(meshes);
    const pose = () => fx.root.children.map(c=>[c.visible,...c.position.toArray(),...c.scale.toArray()]);
    const paused = pose(); fx.update(0,cam); expect(pose()).toEqual(paused);
    expect(JSON.stringify(f)).toBe(before);
    fx.reset(generateFloor(1,6));
    fx.update(1/30,cam);
    expect(fx.root.children.every(c=>!c.visible)).toBe(true);
    expect(fx.lights()).toEqual([]);
    fx.dispose();
  });
});
