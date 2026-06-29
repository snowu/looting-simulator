import { Recipe, BaseType } from '../types';

export const RECIPES: Recipe[] = [
  {
    id: 'iron_sword',
    name: 'Iron Sword',
    ingredients: [
      { materialId: 'iron', quantity: 3 },
      { materialId: 'wood', quantity: 1 },
    ],
    baseType: BaseType.Blade,
    resultStats: {
      attack: 5,
      defense: 0,
      health: 0,
      luck: 0,
    },
    discovered: true,
  },
  {
    id: 'stone_shield',
    name: 'Stone Shield',
    ingredients: [
      { materialId: 'stone', quantity: 5 },
      { materialId: 'iron', quantity: 1 },
    ],
    baseType: BaseType.Shield,
    resultStats: {
      attack: 0,
      defense: 8,
      health: 0,
      luck: 0,
    },
    discovered: true,
  },
  {
    id: 'copper_ring',
    name: 'Copper Ring',
    ingredients: [
      { materialId: 'copper', quantity: 2 },
    ],
    baseType: BaseType.Ring,
    resultStats: {
      attack: 1,
      defense: 1,
      health: 2,
      luck: 1,
    },
    discovered: true,
  },
  {
    id: 'leather_helm',
    name: 'Leather Helmet',
    ingredients: [
      { materialId: 'leather', quantity: 3 },
      { materialId: 'cloth', quantity: 2 },
    ],
    baseType: BaseType.Helmet,
    resultStats: {
      attack: 0,
      defense: 4,
      health: 3,
      luck: 0,
    },
    discovered: true,
  },
  {
    id: 'silver_blade',
    name: 'Silver Blade',
    ingredients: [
      { materialId: 'silver', quantity: 2 },
      { materialId: 'iron', quantity: 1 },
    ],
    baseType: BaseType.Blade,
    resultStats: {
      attack: 8,
      defense: 0,
      health: 0,
      luck: 2,
    },
    discovered: false,
  },
  {
    id: 'jade_ring',
    name: 'Jade Ring',
    ingredients: [
      { materialId: 'jade', quantity: 1 },
      { materialId: 'copper', quantity: 1 },
    ],
    baseType: BaseType.Ring,
    resultStats: {
      attack: 0,
      defense: 2,
      health: 5,
      luck: 3,
    },
    discovered: false,
  },
  {
    id: 'crystal_staff',
    name: 'Crystal Staff',
    ingredients: [
      { materialId: 'crystal', quantity: 3 },
      { materialId: 'wood', quantity: 2 },
    ],
    baseType: BaseType.Blade,
    resultStats: {
      attack: 6,
      defense: 2,
      health: 1,
      luck: 4,
    },
    discovered: false,
  },
  {
    id: 'gold_helm',
    name: 'Golden Helmet',
    ingredients: [
      { materialId: 'gold', quantity: 2 },
      { materialId: 'leather', quantity: 1 },
    ],
    baseType: BaseType.Helmet,
    resultStats: {
      attack: 2,
      defense: 7,
      health: 8,
      luck: 5,
    },
    discovered: false,
  },
  {
    id: 'moonstone_blade',
    name: 'Moonstone Blade',
    ingredients: [
      { materialId: 'moonstone', quantity: 1 },
      { materialId: 'silver', quantity: 2 },
    ],
    baseType: BaseType.Blade,
    resultStats: {
      attack: 10,
      defense: 3,
      health: 2,
      luck: 6,
    },
    discovered: false,
  },
  {
    id: 'emerald_armor',
    name: 'Emerald Plate',
    ingredients: [
      { materialId: 'emerald', quantity: 1 },
      { materialId: 'gold', quantity: 1 },
      { materialId: 'leather', quantity: 2 },
    ],
    baseType: BaseType.Armor,
    resultStats: {
      attack: 3,
      defense: 10,
      health: 12,
      luck: 4,
    },
    discovered: false,
  },
  {
    id: 'flame_sword',
    name: 'Flame Sword',
    ingredients: [
      { materialId: 'flame_shard', quantity: 1 },
      { materialId: 'gold', quantity: 1 },
      { materialId: 'crystal', quantity: 1 },
    ],
    baseType: BaseType.Blade,
    resultStats: {
      attack: 15,
      defense: 1,
      health: 0,
      luck: 3,
    },
    discovered: false,
  },
  {
    id: 'shadow_cloak',
    name: 'Shadow Cloak',
    ingredients: [
      { materialId: 'shadow_essence', quantity: 1 },
      { materialId: 'leather', quantity: 3 },
      { materialId: 'cloth', quantity: 2 },
    ],
    baseType: BaseType.Armor,
    resultStats: {
      attack: 2,
      defense: 12,
      health: 8,
      luck: 8,
    },
    discovered: false,
  },
];
