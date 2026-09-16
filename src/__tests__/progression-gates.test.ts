import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { enemyDef } from '../data/enemies';
import { material } from '../data/materials';
import { rollContainerLoot, rollEnemyLoot, rollEquipment, salvage, identify, materialAvailableAtDepth } from '../systems/items';
import { studySalvagedWeapon } from '../systems/crafting';
import { Rarity } from '../types';

describe('progression gates', () => {
  it('never widens container or salvage gem pools beyond their depth', () => {
    for (let depth = 1; depth <= 6; depth++) {
      const rng = createRng(depth);
      for (let n = 0; n < 400; n++) {
        const gear = rollEquipment(rng, depth, 0, { rarity: Rarity.Uncommon });
        gear.ilvl = depth * 2 + 2;
        const drops = [...salvage(gear, rng), ...(['chest', 'secret', 'vault'] as const).flatMap(t => rollContainerLoot(rng, depth, 0, t).items)];
        for (const drop of drops) if (drop.kind === 'material' && material(drop.ref).category === 'gem') {
          expect(materialAvailableAtDepth(material(drop.ref), depth)).toBe(true);
        }
      }
    }
  });

  it('substitutes premature authored catalysts and retains structural exceptions', () => {
    for (const [id, depth, expected] of [
      ['ember_wisp', 3, 'crystal'], ['elemental_frost', 3, 'crystal'],
      ['elemental_shadow', 4, 'crystal'], ['ember_wisp', 5, 'flame_shard'],
      ['skeleton', 1, 'iron'], ['bat', 1, 'leather'], ['tunnel_stalker', 2, 'spider_silk'],
    ] as const) {
      const def = enemyDef(id);
      const drops = rollEnemyLoot(createRng(12), { ...def, loot: def.loot.map(e => ({ ...e, chance: 1 })) }, depth, 0).items;
      expect(drops.some(d => d.ref === expected)).toBe(true);
      for (const drop of drops) if (drop.kind === 'material' && material(drop.ref).category === 'gem') {
        expect(materialAvailableAtDepth(material(drop.ref), depth)).toBe(true);
      }
    }
  });

  it('preserves Appraiser salvage eligibility through serialization without adding Common mastery', () => {
    for (const rarity of [Rarity.Common, Rarity.Uncommon, Rarity.Rare, Rarity.Epic]) {
      const gear = rollEquipment(createRng(45), 5, 0, { baseId: 'dagger', rarity, identifyBelow: Rarity.Epic });
      const saved = JSON.parse(JSON.stringify(gear));
      expect(saved.identified).toBe(rarity !== Rarity.Epic);
      expect(studySalvagedWeapon(saved, {}, {}) !== null).toBe(rarity !== Rarity.Common);
    }
    const manual = rollEquipment(createRng(45), 3, 0, { baseId: 'dagger', rarity: Rarity.Rare });
    identify(manual);
    expect(studySalvagedWeapon(manual, {}, {})).toBeNull();
  });

  it('keeps early Hard gear mixed and ramps Rare rewards across depths 3–5', () => {
    const rare: number[] = [];
    for (let depth = 1; depth <= 5; depth++) {
      const rng = createRng(772);
      const gear = Array.from({ length: 3000 }, () => rollContainerLoot(rng, depth, 0, 'secret').items.find(i => i.kind === 'equipment')!);
      const common = gear.filter(i => i.rarity === Rarity.Common).length / gear.length;
      rare.push(gear.filter(i => i.rarity === Rarity.Rare).length / gear.length);
      if (depth <= 2) expect(common).toBeGreaterThan(0.4);
    }
    expect(rare[2]).toBeGreaterThan(0.15);
    expect(rare[3]).toBeGreaterThan(rare[2]);
    expect(rare[3] - rare[2]).toBeLessThan(0.2);
    expect(rare[4]).toBeGreaterThan(rare[3]);
    const normal = rollContainerLoot(createRng(9), 4, 0, 'secret', undefined, {}, [], 'normal');
    expect(normal.items.find(i => i.kind === 'equipment')!.rarity).toBe(Rarity.Rare);
  });
});
