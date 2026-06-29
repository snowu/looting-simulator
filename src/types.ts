export enum Rarity {
  Common = 'Common',
  Uncommon = 'Uncommon',
  Rare = 'Rare',
  Epic = 'Epic',
  Legendary = 'Legendary',
}

export const RARITY_ORDER: Record<Rarity, number> = {
  [Rarity.Common]: 0,
  [Rarity.Uncommon]: 1,
  [Rarity.Rare]: 2,
  [Rarity.Epic]: 3,
  [Rarity.Legendary]: 4,
};

export const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.Common]: '#9d9d9d',
  [Rarity.Uncommon]: '#1eff00',
  [Rarity.Rare]: '#0070dd',
  [Rarity.Epic]: '#a335ee',
  [Rarity.Legendary]: '#ff8000',
};

export enum BaseType {
  Blade = 'Blade',
  Shield = 'Shield',
  Ring = 'Ring',
  Helmet = 'Helmet',
  Armor = 'Armor',
}

export interface ItemStats {
  attack: number;
  defense: number;
  health: number;
  luck: number;
}

export interface Material {
  id: string;
  name: string;
  rarity: Rarity;
  description: string;
}

export interface Item {
  id: string;
  name: string;
  baseType: BaseType;
  materials: Material[];
  rarity: Rarity;
  stats: ItemStats;
}

export interface RecipeIngredient {
  materialId: string;
  quantity: number;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  baseType: BaseType;
  resultStats: ItemStats;
  discovered: boolean;
}

export interface LootDrop {
  materialId: string;
  chance: number;
  minQty: number;
  maxQty: number;
}

export interface EnemyStats {
  health: number;
  attack: number;
  defense: number;
}

export interface Enemy {
  id: string;
  name: string;
  stats: EnemyStats;
  lootTable: LootDrop[];
}
