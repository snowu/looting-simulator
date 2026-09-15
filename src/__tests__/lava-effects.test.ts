import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { EMBER_FLOORS, EMBER_VENTS, EMBER_CEILINGS, EMBER_CEILING_VENTS } from '../art/ember-floor';
import { LavaEffects } from '../render/lava-effects';
import { createShared } from '../render/ps1';
import { generateFloor } from '../systems/dungeon';

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
