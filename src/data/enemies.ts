import { Enemy } from '../types';

export const ENEMIES: Enemy[] = [
  {
    id: 'goblin',
    name: 'Goblin Scavenger',
    stats: {
      health: 10,
      attack: 2,
      defense: 1,
    },
    lootTable: [
      { materialId: 'stone', chance: 0.8, minQty: 1, maxQty: 3 },
      { materialId: 'copper', chance: 0.5, minQty: 1, maxQty: 2 },
      { materialId: 'cloth', chance: 0.3, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: 'skeleton_warrior',
    name: 'Skeleton Warrior',
    stats: {
      health: 20,
      attack: 4,
      defense: 2,
    },
    lootTable: [
      { materialId: 'iron', chance: 0.7, minQty: 1, maxQty: 2 },
      { materialId: 'stone', chance: 0.6, minQty: 1, maxQty: 2 },
      { materialId: 'copper', chance: 0.4, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: 'forest_spider',
    name: 'Forest Spider',
    stats: {
      health: 15,
      attack: 3,
      defense: 2,
    },
    lootTable: [
      { materialId: 'cloth', chance: 0.9, minQty: 1, maxQty: 3 },
      { materialId: 'copper', chance: 0.5, minQty: 1, maxQty: 2 },
      { materialId: 'leather', chance: 0.3, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: 'orc_brute',
    name: 'Orc Brute',
    stats: {
      health: 35,
      attack: 6,
      defense: 3,
    },
    lootTable: [
      { materialId: 'iron', chance: 0.8, minQty: 2, maxQty: 4 },
      { materialId: 'leather', chance: 0.6, minQty: 1, maxQty: 2 },
      { materialId: 'silver', chance: 0.2, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: 'ice_elemental',
    name: 'Ice Elemental',
    stats: {
      health: 25,
      attack: 5,
      defense: 4,
    },
    lootTable: [
      { materialId: 'crystal', chance: 0.7, minQty: 1, maxQty: 2 },
      { materialId: 'jade', chance: 0.4, minQty: 1, maxQty: 1 },
      { materialId: 'silver', chance: 0.3, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: 'corrupted_knight',
    name: 'Corrupted Knight',
    stats: {
      health: 50,
      attack: 8,
      defense: 6,
    },
    lootTable: [
      { materialId: 'iron', chance: 0.9, minQty: 2, maxQty: 3 },
      { materialId: 'gold', chance: 0.5, minQty: 1, maxQty: 1 },
      { materialId: 'leather', chance: 0.4, minQty: 1, maxQty: 2 },
      { materialId: 'crystal', chance: 0.2, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: 'flame_wraith',
    name: 'Flame Wraith',
    stats: {
      health: 40,
      attack: 9,
      defense: 3,
    },
    lootTable: [
      { materialId: 'flame_shard', chance: 0.6, minQty: 1, maxQty: 2 },
      { materialId: 'gold', chance: 0.4, minQty: 1, maxQty: 1 },
      { materialId: 'crystal', chance: 0.5, minQty: 1, maxQty: 2 },
      { materialId: 'emerald', chance: 0.1, minQty: 1, maxQty: 1 },
    ],
  },
  {
    id: 'shadow_dragon',
    name: 'Shadow Dragon',
    stats: {
      health: 100,
      attack: 15,
      defense: 8,
    },
    lootTable: [
      { materialId: 'dragon_scale', chance: 0.8, minQty: 1, maxQty: 2 },
      { materialId: 'shadow_essence', chance: 0.7, minQty: 1, maxQty: 2 },
      { materialId: 'gold', chance: 0.6, minQty: 2, maxQty: 3 },
      { materialId: 'moonstone', chance: 0.4, minQty: 1, maxQty: 1 },
      { materialId: 'emerald', chance: 0.3, minQty: 1, maxQty: 1 },
    ],
  },
];
