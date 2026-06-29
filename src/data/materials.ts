import { Material, Rarity } from '../types';

export const MATERIALS: Material[] = [
  // Common (5)
  {
    id: 'iron',
    name: 'Iron Ore',
    rarity: Rarity.Common,
    description: 'Basic metallic ore, found in abundance',
  },
  {
    id: 'stone',
    name: 'Stone Fragment',
    rarity: Rarity.Common,
    description: 'Common stone, useful for basic crafting',
  },
  {
    id: 'copper',
    name: 'Copper Dust',
    rarity: Rarity.Common,
    description: 'Fine copper powder, versatile in recipes',
  },
  {
    id: 'cloth',
    name: 'Woven Cloth',
    rarity: Rarity.Common,
    description: 'Simple fabric for armor padding',
  },
  {
    id: 'wood',
    name: 'Timber Plank',
    rarity: Rarity.Common,
    description: 'Rough-cut wood for crafting',
  },

  // Uncommon (4)
  {
    id: 'silver',
    name: 'Silver Ingot',
    rarity: Rarity.Uncommon,
    description: 'Refined silver with enhanced properties',
  },
  {
    id: 'leather',
    name: 'Leather Hide',
    rarity: Rarity.Uncommon,
    description: 'Quality leather suitable for armor',
  },
  {
    id: 'jade',
    name: 'Jade Stone',
    rarity: Rarity.Uncommon,
    description: 'Precious green stone with magical properties',
  },
  {
    id: 'crystal',
    name: 'Crystal Shard',
    rarity: Rarity.Uncommon,
    description: 'Clear crystal that resonates with magic',
  },

  // Rare (3)
  {
    id: 'gold',
    name: 'Gold Nugget',
    rarity: Rarity.Rare,
    description: 'Precious gold with powerful alchemical potential',
  },
  {
    id: 'moonstone',
    name: 'Moonstone Fragment',
    rarity: Rarity.Rare,
    description: 'Ethereal stone touched by lunar magic',
  },
  {
    id: 'emerald',
    name: 'Emerald Gem',
    rarity: Rarity.Rare,
    description: 'Radiant green gem imbued with nature magic',
  },

  // Epic (2)
  {
    id: 'flame_shard',
    name: 'Flame Shard',
    rarity: Rarity.Epic,
    description: 'Burning fragment containing pure fire essence',
  },
  {
    id: 'shadow_essence',
    name: 'Shadow Essence',
    rarity: Rarity.Epic,
    description: 'Dark matter infused with shadow magic',
  },

  // Legendary (1)
  {
    id: 'dragon_scale',
    name: 'Dragon Scale',
    rarity: Rarity.Legendary,
    description: 'Impenetrable scale from an ancient dragon',
  },
];
