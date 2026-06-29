export interface MetaUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  maxLevel: number;
}

export const META_UPGRADES: MetaUpgrade[] = [
  {
    id: 'starting_gold',
    name: 'Deeper Pockets',
    description: '+50 starting gold per level',
    cost: 5,
    maxLevel: 5,
  },
  {
    id: 'loot_luck',
    name: 'Fortune Favor',
    description: '+10% loot drop chance per level',
    cost: 10,
    maxLevel: 3,
  },
  {
    id: 'market_intel',
    name: 'Market Insider',
    description: 'See price trends',
    cost: 15,
    maxLevel: 1,
  },
  {
    id: 'recipe_slots',
    name: 'Expanded Mind',
    description: '+2 recipe slots per level',
    cost: 8,
    maxLevel: 3,
  },
  {
    id: 'starting_gear',
    name: 'Heirloom',
    description: 'Start runs with basic gear',
    cost: 20,
    maxLevel: 3,
  },
];
