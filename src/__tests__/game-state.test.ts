import { Inventory } from '../state/inventory';
import { Rarity, BaseType } from '../types';

test('add and remove materials', () => {
  const inv = new Inventory();
  inv.addMaterial('iron', 5);
  expect(inv.getMaterialCount('iron')).toBe(5);
  expect(inv.removeMaterial('iron', 3)).toBe(true);
  expect(inv.getMaterialCount('iron')).toBe(2);
  expect(inv.removeMaterial('iron', 5)).toBe(false);
});

test('hasMaterials checks all ingredients', () => {
  const inv = new Inventory();
  inv.addMaterial('iron', 3);
  inv.addMaterial('flame_shard', 1);
  expect(inv.hasMaterials([
    { materialId: 'iron', quantity: 2 },
    { materialId: 'flame_shard', quantity: 1 },
  ])).toBe(true);
  expect(inv.hasMaterials([
    { materialId: 'iron', quantity: 5 },
  ])).toBe(false);
});

test('add and remove items', () => {
  const inv = new Inventory();
  const item = {
    id: 'sword-1', name: 'Iron Sword', baseType: BaseType.Blade,
    materials: [], rarity: Rarity.Common,
    stats: { attack: 10, defense: 0, health: 0, luck: 0 },
  };
  inv.addItem(item);
  expect(inv.items).toHaveLength(1);
  inv.removeItem('sword-1');
  expect(inv.items).toHaveLength(0);
});
