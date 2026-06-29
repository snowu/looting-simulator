import { describe, it, expect } from 'vitest';
import { craft, computeItemRarity } from '../systems/crafting';
import { Inventory } from '../state/inventory';
import { Rarity, BaseType } from '../types';
import { RECIPES } from '../data/recipes';
import { MATERIALS } from '../data/materials';

describe('Crafting System', () => {
  it('craft succeeds with enough materials', () => {
    const inv = new Inventory();
    const recipe = RECIPES[0];
    for (const ing of recipe.ingredients) {
      inv.addMaterial(ing.materialId, ing.quantity);
    }
    const item = craft(inv, recipe);
    expect(item).not.toBeNull();
    expect(item!.baseType).toBe(recipe.baseType);
    // Materials consumed
    for (const ing of recipe.ingredients) {
      expect(inv.getMaterialCount(ing.materialId)).toBe(0);
    }
  });

  it('craft fails without materials', () => {
    const inv = new Inventory();
    const item = craft(inv, RECIPES[0]);
    expect(item).toBeNull();
  });

  it('computeItemRarity returns highest material rarity', () => {
    const common = MATERIALS.find(m => m.rarity === Rarity.Common)!;
    const rare = MATERIALS.find(m => m.rarity === Rarity.Rare)!;
    expect(computeItemRarity([common, rare])).toBe(Rarity.Rare);
  });
});
