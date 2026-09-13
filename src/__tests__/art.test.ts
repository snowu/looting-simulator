import { describe, it, expect } from 'vitest';
import { ALL_ART, getArt } from '../art/registry';
import { rasterize, validateArt } from '../art/raster';
import { MATERIALS } from '../data/materials';
import { CONSUMABLES, ITEM_BASES } from '../data/items';
import { BIOMES } from '../data/biomes';
import { ENEMIES, KING_PHASES } from '../data/enemies';

describe('pixel art', () => {
  it('every art def is well-formed and rasterises', () => {
    for (const d of ALL_ART) {
      expect(validateArt(d), d.id).toBeNull();
      const r = rasterize(d, undefined, getArt);
      expect(r.w * r.h).toBeGreaterThan(0);
    }
  });

  it('art ids are unique', () => {
    const ids = ALL_ART.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('everything the data references exists', () => {
    const needed = new Set<string>(['ic_blueprint', 'ic_key', 'ic_gold', 'door_locked', 'ui_frame']);
    for (const m of MATERIALS) needed.add(m.icon);
    for (const b of ITEM_BASES) needed.add(b.icon);
    for (const c of CONSUMABLES) needed.add(c.icon);
    for (const b of BIOMES) for (const id of [b.wall, b.wallAlt, b.wallSecret, b.floor, b.ceiling, b.door]) needed.add(id);
    for (const e of ENEMIES) {
      needed.add(`${e.sprite}_0`);
      needed.add(`${e.sprite}_atk`);
      if (e.shield) needed.add(`${e.sprite}_block`);
      if (e.projectile) needed.add(e.projectile.sprite);
    }
    // The King's phases draw from their own sprite families, and the loop above
    // only sees the stat block. A missing frame here is not a blank sprite, it
    // is `artCanvas` throwing at thirty percent health on the final boss.
    for (const p of KING_PHASES) {
      needed.add(`${p.sprite}_0`);
      needed.add(`${p.sprite}_atk`);
      if (p.shield) needed.add(`${p.sprite}_block`);
    }
    for (const id of ['vm_blade', 'vm_axe', 'vm_pick', 'vm_blunt', 'vm_spear', 'vm_fist', 'vm_shield']) needed.add(id);
    for (const id of ['trap_dart_spent', 'trap_spikes_spent', 'trap_alarm_spent']) needed.add(id);
    for (const id of needed) expect(getArt(id), id).toBeDefined();
  });

  it('gives every enemy a visibly different attack pose', () => {
    const sprites = new Set([...ENEMIES.map((e) => e.sprite), ...KING_PHASES.map((p) => p.sprite)]);
    for (const sprite of sprites) {
      const idle = rasterize(getArt(`${sprite}_0`)!, undefined, getArt);
      const attack = rasterize(getArt(`${sprite}_atk`)!, undefined, getArt);
      expect(attack.data, sprite).not.toEqual(idle.data);
    }
  });
});
