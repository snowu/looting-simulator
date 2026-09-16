import { createRng, Rng } from '../core/rng';
import { Item, MaterialDef, RecipeDef, RecipeRanks, RecipeSlot, rarityFromOrder } from '../types';
import { MATERIALS, catalystAffixBonus, material } from '../data/materials';
import { itemBase } from '../data/items';
import { MAX_RECIPE_RANK, blueprintCostForNextRank, recipe, recipeForBase, recipeRank } from '../data/recipes';
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
  })).sort((a, b) => a.def.tier - b.def.tier || a.def.value - b.def.value || a.def.name.localeCompare(b.def.name));
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
export function buildCrafted(sel: CraftSelection, smithLevel: number, rng?: Rng, rank = 1): Item {
  const r = recipe(sel.recipeId);
  const base = itemBase(r.baseId);
  const primary = material(sel.materials[0]!);
  const secondaryId = r.slots.length > 1 && r.slots[1].categories[0] !== 'gem' ? sel.materials[1] ?? undefined : undefined;
  const catalyst = catalystOf(r, sel);

  // Rarity: primary tier sets the floor, a catalyst lifts it one step.
  const tierRarity = [0, 0, 0, 1, 2, 3][primary.tier] ?? 0;
  const rarityOrder = tierRarity + (catalyst ? 1 : 0);
  const ilvl = primary.tier * 2 + (catalyst ? catalyst.tier : 0);

  const affixes = [];
  if (catalyst?.catalystAffix) {
    const value = rng ? rollAffixValue(rng, catalyst.catalystAffix, ilvl) : medianAffix(catalyst.catalystAffix, ilvl);
    affixes.push({ id: catalyst.catalystAffix, value: value + catalystAffixBonus(catalyst) });
  }
  const affixCount = Math.min(4, rarityOrder + (smithLevel >= 3 ? 1 : 0));
  const affixRng = rng ?? createRng(0x534d4954);
  const rolled = rollAffixes(affixRng, base.slot, ilvl, affixCount - affixes.length, affixes.map((a) => a.id));
  affixes.push(...(rng ? rolled : rolled.map((a) => ({ id: a.id, value: medianAffix(a.id, ilvl) }))));

  const quality = rng ? rng.float(0.92, 1.12) + smithLevel * 0.06 : 1.02 + smithLevel * 0.06;
  return makeEquipment({
    baseId: base.id,
    materialId: primary.id,
    secondaryId,
    rarity: rarityFromOrder(Math.max(rarityOrder, affixes.length)),
    ilvl,
    affixes,
    identified: true,
    quality: Math.round(quality * 100) / 100,
    crafted: true,
    craftRank: Math.max(1, Math.min(MAX_RECIPE_RANK, Math.floor(rank))),
  });
}

function medianAffix(id: string, ilvl: number): number {
  // Deterministic stand-in for previews.
  const fake = { next: () => 0.5 } as unknown as Rng;
  fake.float = (a: number, b: number) => (a + b) / 2;
  return rollAffixValue(fake, id, ilvl);
}

/** Consume materials and create the item. Returns null if the selection is invalid. */
export function craft(sel: CraftSelection, stash: Container, rng: Rng, smithLevel: number, rank = 1): Item | null {
  if (rank < 1 || selectionError(sel, stash)) return null;
  const r = recipe(sel.recipeId);
  const item = buildCrafted(sel, smithLevel, rng, rank);
  for (let i = 0; i < r.slots.length; i++) {
    const id = sel.materials[i];
    if (id) removeOf(stash, 'material', id, r.slots[i].qty);
  }
  return item;
}

/** Consume the next rank’s blueprint cost to unlock or advance its recipe. */
export function studyBlueprint(blueprint: Item, stash: Container, ranks: RecipeRanks): number | null {
  if (blueprint.kind !== 'blueprint') return null;
  const current = recipeRank(ranks, blueprint.ref);
  const cost = blueprintCostForNextRank(current);
  if (cost === 0 || !removeOf(stash, 'blueprint', blueprint.ref, cost)) return null;
  const next = current + 1;
  ranks[blueprint.ref] = next;
  return next;
}

/** Integer salvage counts avoid floating-point thresholds at 1/6 and 1/7. */
export function salvageForNextRank(rank: number): number {
  return rank >= MAX_RECIPE_RANK ? 0 : 4 + Math.max(0, Math.floor(rank));
}

export function studySalvagedWeapon(item: Item, ranks: RecipeRanks, progress: Record<string, number>): string | null {
  if (item.kind !== 'equipment' || item.identified !== false || item.crafted) return null;
  const base = itemBase(item.ref);
  if (base.slot !== 'weapon' && base.slot !== 'thrown') return null;
  const r = recipeForBase(base.id);
  if (!r) return null;
  const rank = recipeRank(ranks, r.id);
  const needed = salvageForNextRank(rank);
  if (!needed) return null;
  const count = (progress[r.id] ?? 0) + 1;
  if (count >= needed) {
    ranks[r.id] = rank + 1;
    progress[r.id] = 0;
    return `${base.name} mastery reached Rank ${rank + 1}.`;
  }
  progress[r.id] = count;
  return `${base.name} mastery: ${count}/${needed} salvages toward Rank ${rank + 1}.`;
}
