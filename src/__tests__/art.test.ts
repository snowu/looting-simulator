import { describe, it, expect } from 'vitest';
import { ALL_ART, getArt } from '../art/registry';
import { rasterize, validateArt } from '../art/raster';
import { MATERIALS } from '../data/materials';
import { CONSUMABLES, ITEM_BASES } from '../data/items';
import { BIOMES } from '../data/biomes';
import { ENEMIES } from '../data/enemies';

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
      if (e.projectile) needed.add(e.projectile.sprite);
    }
    for (const id of ['vm_blade', 'vm_axe', 'vm_blunt', 'vm_spear', 'vm_fist', 'vm_shield']) needed.add(id);
    for (const id of needed) expect(getArt(id), id).toBeDefined();
  });
});
