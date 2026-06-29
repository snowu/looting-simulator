import { MATERIALS } from '../data/materials';
import { RECIPES } from '../data/recipes';
import { ENEMIES } from '../data/enemies';
import { Material, Recipe, Enemy, Rarity } from '../types';

test('materials are properly typed', () => {
  expect(MATERIALS.length).toBeGreaterThan(0);
  MATERIALS.forEach((m: Material) => {
    expect(m.id).toBeDefined();
    expect(m.name).toBeDefined();
    expect(m.rarity).toBeDefined();
    expect(m.description).toBeDefined();
    // Verify IDs are lowercase_snake_case
    expect(m.id).toMatch(/^[a-z_]+$/);
  });
});

test('recipes are properly typed', () => {
  expect(RECIPES.length).toBeGreaterThan(0);
  RECIPES.forEach((r: Recipe) => {
    expect(r.id).toBeDefined();
    expect(r.name).toBeDefined();
    expect(r.ingredients).toBeDefined();
    expect(r.baseType).toBeDefined();
    expect(r.resultStats).toBeDefined();
    expect(typeof r.discovered).toBe('boolean');
  });
});

test('enemies are properly typed', () => {
  expect(ENEMIES.length).toBeGreaterThan(0);
  ENEMIES.forEach((e: Enemy) => {
    expect(e.id).toBeDefined();
    expect(e.name).toBeDefined();
    expect(e.stats).toBeDefined();
    expect(e.lootTable).toBeDefined();
    expect(e.lootTable.length).toBeGreaterThan(0);
  });
});

test('material rarities are valid', () => {
  const validRarities = Object.values(Rarity);
  MATERIALS.forEach((m: Material) => {
    expect(validRarities).toContain(m.rarity);
  });
});

test('recipes reference existing materials', () => {
  const materialIds = new Set(MATERIALS.map(m => m.id));
  RECIPES.forEach((r: Recipe) => {
    r.ingredients.forEach(ing => {
      expect(materialIds.has(ing.materialId)).toBe(true);
    });
  });
});

test('enemies reference existing materials in loot tables', () => {
  const materialIds = new Set(MATERIALS.map(m => m.id));
  ENEMIES.forEach((e: Enemy) => {
    e.lootTable.forEach(drop => {
      expect(materialIds.has(drop.materialId)).toBe(true);
    });
  });
});
