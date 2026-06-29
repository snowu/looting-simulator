import { Inventory } from '../state/inventory';
import { Recipe, Item, Material, Rarity, BaseType, RARITY_ORDER } from '../types';
import { MATERIALS } from '../data/materials';

let itemCounter = 0;

export function craft(inventory: Inventory, recipe: Recipe): Item | null {
  if (!inventory.hasMaterials(recipe.ingredients)) return null;

  for (const ing of recipe.ingredients) {
    inventory.removeMaterial(ing.materialId, ing.quantity);
  }

  const materials = recipe.ingredients
    .map(ing => MATERIALS.find(m => m.id === ing.materialId)!)
    .filter(Boolean);

  const rarity = computeItemRarity(materials);
  const id = `item-${++itemCounter}-${Date.now()}`;

  return {
    id,
    name: recipe.name,
    baseType: recipe.baseType,
    materials,
    rarity,
    stats: { ...recipe.resultStats },
  };
}

export function computeItemRarity(materials: Material[]): Rarity {
  let highest = Rarity.Common;
  for (const mat of materials) {
    if (RARITY_ORDER[mat.rarity] > RARITY_ORDER[highest]) {
      highest = mat.rarity;
    }
  }
  return highest;
}
