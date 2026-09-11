import { Rng } from '../core/rng';
import { Item, MaterialDef, RARITY_ORDER, RecipeDef, RecipeSlot, rarityFromOrder } from '../types';
import { MATERIALS, material } from '../data/materials';
import { itemBase } from '../data/items';
import { recipe } from '../data/recipes';
import { Container, countOf, removeOf } from '../state/inventory';
import { makeEquipment, rollAffixValue, rollAffixes } from './items';

export interface CraftSelection {
  recipeId: string;
  /** Chosen material id per recipe slot (null = empty; only allowed for optional slots). */
  materials: (string | null)[];
}

export function materialsForSlot(slot: RecipeSlot, stash: Container): { def: MaterialDef; owned: number }[] {
  return MATERIALS.filter((m) => slot.categories.includes(m.category)).map((def) => ({
    def,
    owned: countOf(stash, 'material', def.id),
  }));
}

export function selectionError(sel: CraftSelection, stash: Container): string | null {
  const r = recipe(sel.recipeId);
  // Two slots may pick the same material, so tally totals first.
  const need = new Map<string, number>();
  for (let i = 0; i < r.slots.length; i++) {
    const slot = r.slots[i];
    const id = sel.materials[i];
    if (!id) {
      if (!slot.optional) return `Choose a material for ${slot.label}.`;
      continue;
    }
    if (!slot.categories.includes(material(id).category)) return `${material(id).name} can't be used as ${slot.label}.`;
    need.set(id, (need.get(id) ?? 0) + slot.qty);
  }
  for (const [id, qty] of need) {
    if (countOf(stash, 'material', id) < qty) return `Not enough ${material(id).name} (${countOf(stash, 'material', id)}/${qty}).`;
  }
  return null;
}

function catalystOf(r: RecipeDef, sel: CraftSelection): MaterialDef | null {
  for (let i = 0; i < r.slots.length; i++) {
    const id = sel.materials[i];
    if (id && r.slots[i].categories.length === 1 && r.slots[i].categories[0] === 'gem') return material(id);
  }
  return null;
}

/**
 * Build the crafted item. With `rng` omitted, returns a deterministic preview
 * (median quality, median affix values).
 */
export function buildCrafted(sel: CraftSelection, smithLevel: number, rng?: Rng): Item {
  const r = recipe(sel.recipeId);
  const base = itemBase(r.baseId);
  const primary = material(sel.materials[0]!);
  const secondaryId = r.slots.length > 1 && r.slots[1].categories[0] !== 'gem' ? sel.materials[1] ?? undefined : undefined;
  const catalyst = catalystOf(r, sel);

  // Rarity: primary tier sets the floor, a catalyst lifts it one step.
  const tierRarity = [0, 0, 0, 1, 2, 3][primary.tier] ?? 0;
  const rarity = rarityFromOrder(tierRarity + (catalyst ? 1 : 0));
  const ilvl = primary.tier * 2 + (catalyst ? catalyst.tier : 0);

  const affixes = [];
  if (catalyst?.catalystAffix) {
    affixes.push({ id: catalyst.catalystAffix, value: rng ? rollAffixValue(rng, catalyst.catalystAffix, ilvl) : medianAffix(catalyst.catalystAffix, ilvl) });
  }
  if (rng && smithLevel >= 3) affixes.push(...rollAffixes(rng, base.slot, ilvl, 1, affixes.map((a) => a.id)));

  const quality = rng ? rng.float(0.92, 1.12) + smithLevel * 0.06 : 1.02 + smithLevel * 0.06;
  return makeEquipment({
    baseId: base.id,
    materialId: primary.id,
    secondaryId,
    rarity: RARITY_ORDER[rarity] >= affixes.length ? rarity : rarityFromOrder(affixes.length),
    ilvl,
    affixes,
    identified: true,
    quality: Math.round(quality * 100) / 100,
    crafted: true,
  });
}

function medianAffix(id: string, ilvl: number): number {
  // Deterministic stand-in for previews.
  const fake = { next: () => 0.5 } as unknown as Rng;
  fake.float = (a: number, b: number) => (a + b) / 2;
  return rollAffixValue(fake, id, ilvl);
}

/** Consume materials and create the item. Returns null if the selection is invalid. */
export function craft(sel: CraftSelection, stash: Container, rng: Rng, smithLevel: number): Item | null {
  if (selectionError(sel, stash)) return null;
  const r = recipe(sel.recipeId);
  const item = buildCrafted(sel, smithLevel, rng);
  for (let i = 0; i < r.slots.length; i++) {
    const id = sel.materials[i];
    if (id) removeOf(stash, 'material', id, r.slots[i].qty);
  }
  return item;
}
