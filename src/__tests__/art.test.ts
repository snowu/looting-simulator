import { describe, it, expect } from 'vitest';
import { ALL_ART, getArt } from '../art/registry';
import { rasterize, validateArt } from '../art/raster';
import { MATERIALS } from '../data/materials';
import { CONSUMABLES, ITEM_BASES } from '../data/items';
import { BIOMES } from '../data/biomes';
import { ENEMIES, KING_PHASES } from '../data/enemies';
import { SHEETS } from '../dev/art-sheets';

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

  /**
   * Share of the creature that changes between two frames, counted over the
   * pixels either frame draws rather than over the canvas — otherwise a bat at
   * 0.45 scale, which is mostly empty air, scores as though it were a king.
   */
  function poseChange(a: string, b: string): number {
    const x = rasterize(getArt(a)!, undefined, getArt);
    const y = rasterize(getArt(b)!, undefined, getArt);
    let changed = 0;
    let ink = 0;
    for (let i = 0; i < x.data.length; i += 4) {
      if (x.data[i + 3] || y.data[i + 3]) ink++;
      if (
        x.data[i] !== y.data[i] || x.data[i + 1] !== y.data[i + 1] ||
        x.data[i + 2] !== y.data[i + 2] || x.data[i + 3] !== y.data[i + 3]
      ) changed++;
    }
    return changed / Math.max(1, ink);
  }

  /**
   * A tell you cannot see is not a tell. The renderer gives a creature two
   * frames and about a third of a second to say "this is the blow" — so the
   * frames have to differ by more than a few pixels of tongue or a mouth slot,
   * which is what the Giant Rat, the Cave Bat, the wisps and the Mimic all used
   * to differ by. The floor is deliberately low: it catches art that forgot to
   * move, not art that is merely restrained.
   */
  const TELL_FLOOR = 0.08;

  it('gives every enemy an attack pose that changes a readable share of it', () => {
    const sprites = new Set([...ENEMIES.map((e) => e.sprite), ...KING_PHASES.map((p) => p.sprite)]);
    for (const sprite of sprites) {
      expect(poseChange(`${sprite}_0`, `${sprite}_atk`), `${sprite} attack`).toBeGreaterThan(TELL_FLOOR);
    }
  });

  it('gives every shieldbearer a guard that reads apart from its idle', () => {
    const shields = [
      ...ENEMIES.filter((e) => e.shield).map((e) => e.sprite),
      ...KING_PHASES.filter((p) => p.shield).map((p) => p.sprite),
    ];
    expect(shields.length).toBeGreaterThan(0);
    for (const sprite of shields) {
      expect(poseChange(`${sprite}_0`, `${sprite}_block`), `${sprite} guard`).toBeGreaterThan(TELL_FLOOR);
    }
  });

  it('has art for every frame the dev art sheet lists', () => {
    for (const s of SHEETS) {
      for (const group of s.groups) {
        for (const cell of group.cells) expect(getArt(cell.id), `${s.id}/${cell.id}`).toBeDefined();
      }
    }
  });
});
