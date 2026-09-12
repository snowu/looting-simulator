import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import {
  identify,
  itemName,
  itemStats,
  itemValue,
  makeEquipment,
  makeMaterial,
  maxDurability,
  rollEnemyLoot,
  rollEquipment,
  salvage,
} from '../systems/items';
import { addItem, canFit, countOf, createContainer, removeOf, takeQty } from '../state/inventory';
import { Rarity, RARITY_ORDER } from '../types';
import { enemyDef, BOSS_ID } from '../data/enemies';
import { itemBase } from '../data/items';
import { recipe } from '../data/recipes';
import { derivePlayer, emptyEquipment } from '../systems/player';

describe('items', () => {
  it('rolls equipment deterministically', () => {
    const a = rollEquipment(createRng(5), 3, 0);
    const b = rollEquipment(createRng(5), 3, 0);
    expect({ ...a, uid: '' }).toEqual({ ...b, uid: '' });
  });

  it('material tier scales stats', () => {
    const copper = makeEquipment({ baseId: 'long_sword', materialId: 'copper', rarity: Rarity.Common, ilvl: 1 });
    const star = makeEquipment({ baseId: 'long_sword', materialId: 'star_iron', rarity: Rarity.Common, ilvl: 1 });
    expect(itemStats(star).attack).toBeGreaterThan(itemStats(copper).attack * 2);
    expect(itemStats(star).shadow).toBeGreaterThan(0);
    expect(itemValue(star)).toBeGreaterThan(itemValue(copper));
  });

  it('the mining pick is a craftable piercing weapon', () => {
    const base = itemBase('mining_pick');
    const pick = makeEquipment({ baseId: base.id, materialId: 'iron', rarity: Rarity.Common, ilvl: 1 });
    expect(base.weaponClass).toBe('pick');
    expect(base.damageType).toBe('pierce');
    expect(itemStats(pick).attack).toBeGreaterThan(0);
    expect(maxDurability(pick)).toBeGreaterThan(0);
    expect(recipe('r_mining_pick').baseId).toBe(base.id);
  });

  it('hides affixes until identified', () => {
    const it = rollEquipment(createRng(11), 4, 0, { rarity: Rarity.Rare });
    expect(it.identified).toBe(false);
    expect(itemName(it)).toMatch(/^Unidentified /);
    const before = itemStats(it);
    identify(it);
    const after = itemStats(it);
    expect(itemName(it)).not.toMatch(/^Unidentified /);
    const sum = (s: typeof before) => Object.values(s).reduce((a, b) => a + Math.abs(b), 0);
    expect(sum(after)).toBeGreaterThan(sum(before));
  });

  it('rarity controls affix count', () => {
    const r = createRng(3);
    for (const rarity of [Rarity.Common, Rarity.Uncommon, Rarity.Rare, Rarity.Epic, Rarity.Legendary]) {
      const it = rollEquipment(r, 6, 0, { rarity, baseId: 'long_sword' });
      expect(it.affixes!.length).toBe(RARITY_ORDER[rarity]);
    }
  });

  it('the boss always drops a legendary', () => {
    const loot = rollEnemyLoot(createRng(1), enemyDef(BOSS_ID), 6, 0);
    expect(loot.items.some((i) => i.rarity === Rarity.Legendary)).toBe(true);
    expect(loot.gold).toBeGreaterThan(100);
  });

  it('salvage gives back the primary material', () => {
    const sword = makeEquipment({ baseId: 'short_sword', materialId: 'iron', rarity: Rarity.Common, ilvl: 2 });
    const out = salvage(sword, createRng(2));
    expect(out.some((m) => m.ref === 'iron')).toBe(true);
  });

  it('derived player stats sum equipment', () => {
    const eq = emptyEquipment();
    const bare = derivePlayer(eq, {});
    eq.weapon = makeEquipment({ baseId: 'mace', materialId: 'iron', rarity: Rarity.Common, ilvl: 2 });
    eq.body = makeEquipment({ baseId: 'hauberk', materialId: 'iron', rarity: Rarity.Common, ilvl: 2 });
    const armed = derivePlayer(eq, { toughness: 2 });
    expect(armed.attack).toBeGreaterThan(bare.attack);
    expect(armed.stats.defense).toBeGreaterThan(0);
    expect(armed.damageType).toBe('blunt');
    expect(armed.maxHp).toBe(bare.maxHp + 24);
    expect(armed.swing.recovery).toBeGreaterThan(0);
  });
});

describe('inventory', () => {
  it('respects capacity', () => {
    const c = createContainer(2);
    const mk = () => makeEquipment({ baseId: 'dagger', materialId: 'copper', rarity: Rarity.Common, ilvl: 1 });
    expect(addItem(c, mk())).toBe(0);
    expect(addItem(c, mk())).toBe(0);
    const third = mk();
    expect(canFit(c, third)).toBe(false);
    expect(addItem(c, third)).toBe(1);
  });

  it('stacks materials to 20 per slot', () => {
    const c = createContainer(3);
    expect(addItem(c, makeMaterial('iron', 45))).toBe(0);
    expect(c.items.map((i) => i.qty)).toEqual([20, 20, 5]);
    expect(addItem(c, makeMaterial('iron', 20))).toBe(5);
    expect(countOf(c, 'material', 'iron')).toBe(60);
  });

  it('unlimited stash merges into one stack', () => {
    const s = createContainer(0);
    addItem(s, makeMaterial('bone', 50));
    addItem(s, makeMaterial('bone', 70));
    expect(s.items).toHaveLength(1);
    expect(s.items[0].qty).toBe(120);
  });

  it('removeOf is all-or-nothing', () => {
    const c = createContainer(0);
    addItem(c, makeMaterial('linen', 3));
    expect(removeOf(c, 'material', 'linen', 5)).toBe(false);
    expect(countOf(c, 'material', 'linen')).toBe(3);
    expect(removeOf(c, 'material', 'linen', 3)).toBe(true);
    expect(c.items).toHaveLength(0);
  });

  it('takeQty splits a stack', () => {
    const c = createContainer(4);
    addItem(c, makeMaterial('copper', 10));
    const part = takeQty(c, c.items[0].uid, 4)!;
    expect(part.qty).toBe(4);
    expect(c.items[0].qty).toBe(6);
    expect(part.uid).not.toBe(c.items[0].uid);
  });
});
