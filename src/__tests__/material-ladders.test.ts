import { expect, it } from 'vitest';
import { MATERIALS } from '../data/materials';
import { RECIPES } from '../data/recipes';
import { Rarity, RARITY_ORDER } from '../types';
import { itemStats, makeEquipment, materialAvailableAtDepth } from '../systems/items';
import { buildCrafted } from '../systems/crafting';
import { materialStockTarget } from '../systems/market';

it('gives every structural family five consistently colored, strictly stronger tiers', () => {
  for (const category of ['metal', 'wood', 'hide', 'cloth', 'bone']) {
    const family = MATERIALS.filter(m => m.category === category).sort((a, b) => a.tier - b.tier);
    expect(new Set(family.map(m => m.tier))).toEqual(new Set([1, 2, 3, 4, 5]));
    const stat = Object.keys(family[0].mods)[0] as keyof typeof family[0]['mods'];
    for (const mat of family) {
      expect(RARITY_ORDER[mat.rarity]).toBe(mat.tier - 1);
      expect(mat.mods[stat]).toBeGreaterThan(0);
      const previous = family.find(m => m.tier === mat.tier - 1);
      if (previous) expect(mat.mods[stat]!).toBeGreaterThan(previous.mods[stat]!);
      expect(materialAvailableAtDepth(mat, [0, 1, 2, 4, 5, 6][mat.tier])).toBe(true);
    }
  }
});

it('applies secondary family and elemental bonuses exactly once', () => {
  const base = { baseId: 'short_sword', materialId: 'iron', quality: 1, identified: true, rarity: Rarity.Common, ilvl: 4 };
  const plain = itemStats(makeEquipment(base));
  for (const mat of MATERIALS.filter(m => !['gem', 'valuable'].includes(m.category))) {
    const withSecondary = itemStats(makeEquipment({ ...base, secondaryId: mat.id }));
    for (const stat of Object.keys(plain) as (keyof typeof plain)[]) {
      expect(withSecondary[stat] - plain[stat], `${mat.id}: ${stat}`).toBe(mat.mods[stat] ?? 0);
    }
  }
});

it('keeps basic structural stock plentiful after the rarity color correction', () => {
  for (const mat of MATERIALS.filter(m => !['gem', 'valuable'].includes(m.category))) {
    expect(materialStockTarget(mat, 1)).toBe(mat.tier <= 2 ? 40 : mat.tier === 3 ? 14 : 0);
  }
});

it('keeps every structural recipe slot viable at every material tier', () => {
  for (const recipe of RECIPES) for (const slot of recipe.slots) {
    if (slot.categories.includes('gem')) continue;
    for (let tier = 1; tier <= 5; tier++) {
      expect(MATERIALS.some(m => m.tier === tier && slot.categories.includes(m.category)), `${recipe.id}: ${slot.label}, tier ${tier}`).toBe(true);
    }
  }
});

it('keeps special materials elemental in both recipe roles, alongside their family bonus', () => {
  const specials = [
    ['silver', 'defense', 4, 'holy', 3],
    ['moonsilver', 'defense', 7, 'frost', 6],
    ['star_iron', 'defense', 12, 'shadow', 10],
    ['dragon_scale', 'health', 40, 'fire', 10],
    ['shadow_silk', 'stamina', 18, 'shadow', 7],
  ] as const;
  for (const [id, family, amount, element, damage] of specials) {
    const mat = MATERIALS.find(m => m.id === id)!;
    expect(mat.mods).toEqual({ [family]: amount, [element]: damage });
    const base = { baseId: 'short_sword', rarity: Rarity.Common, ilvl: 4, quality: 1, identified: true };
    expect(itemStats(makeEquipment({ ...base, materialId: id }))[element]).toBe(damage);
    expect(itemStats(makeEquipment({ ...base, materialId: 'copper', secondaryId: id }))[element]).toBe(damage);
  }
});

it('stacks innate elemental damage with matching affixes', () => {
  const item = makeEquipment({ baseId: 'short_sword', materialId: 'moonsilver',
    rarity: Rarity.Uncommon, ilvl: 8, quality: 1, identified: true,
    affixes: [{ id: 'rimed', value: 5 }],
  });
  expect(itemStats(item).defense).toBe(7);
  expect(itemStats(item).frost).toBe(11);
});

it('makes legendary bone a substantial crafted weapon upgrade without requiring mastery', () => {
  const craft = (grip: string) => itemStats(buildCrafted({
    recipeId: 'r_dagger', materials: ['iron', grip, null, null],
  }, 0, undefined, 1));
  const plain = craft('timber');
  const epic = craft('wyrm_bone');
  const legendary = craft('titan_bone');
  expect(legendary.attack - plain.attack).toBe(20);
  expect(legendary.attack - epic.attack).toBe(8);
  expect(legendary.attack).toBeGreaterThan(plain.attack * 2);
});
