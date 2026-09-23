import { MaterialCategory, RecipeDef, RecipeRanks } from '../types';
import { gearLadderIndex, gearTier } from './items';
import { clamp } from '../core/math';

export const SECONDARY_CATEGORIES: MaterialCategory[] = ['metal', 'wood', 'hide', 'cloth', 'bone'];
const EXTRA = { label: 'Extra material', categories: SECONDARY_CATEGORIES, qty: 1, optional: true };
const GEM = { label: 'Catalyst', categories: ['gem'] as MaterialCategory[], qty: 1, optional: true };

export const RECIPES: RecipeDef[] = [
  // Weapons
  { id: 'r_dagger', baseId: 'dagger', starter: true, value: 0,
    slots: [{ label: 'Blade', categories: ['metal'], qty: 2 }, { label: 'Grip', categories: SECONDARY_CATEGORIES, qty: 1 }, EXTRA, GEM] },
  { id: 'r_short_sword', baseId: 'short_sword', starter: true, value: 0,
    slots: [{ label: 'Blade', categories: ['metal'], qty: 3 }, { label: 'Grip', categories: SECONDARY_CATEGORIES, qty: 1 }, EXTRA, GEM] },
  { id: 'r_long_sword', baseId: 'long_sword', starter: false, value: 140,
    slots: [{ label: 'Blade', categories: ['metal'], qty: 5 }, { label: 'Grip', categories: SECONDARY_CATEGORIES, qty: 2 }, EXTRA, GEM] },
  { id: 'r_war_axe', baseId: 'war_axe', starter: false, value: 150,
    slots: [{ label: 'Head', categories: ['metal'], qty: 4 }, { label: 'Haft', categories: SECONDARY_CATEGORIES, qty: 2 }, EXTRA, GEM] },
  { id: 'r_mining_pick', baseId: 'mining_pick', starter: false, value: 128,
    slots: [{ label: 'Head', categories: ['metal'], qty: 3 }, { label: 'Haft', categories: SECONDARY_CATEGORIES, qty: 2 }, EXTRA, GEM] },
  { id: 'r_mace', baseId: 'mace', starter: false, value: 110,
    slots: [{ label: 'Head', categories: ['metal'], qty: 4 }, { label: 'Haft', categories: SECONDARY_CATEGORIES, qty: 1 }, EXTRA, GEM] },
  { id: 'r_spear', baseId: 'spear', starter: false, value: 105,
    slots: [{ label: 'Point', categories: ['metal'], qty: 2 }, { label: 'Shaft', categories: SECONDARY_CATEGORIES, qty: 3 }, EXTRA, GEM] },
  { id: 'r_club', baseId: 'club', starter: true, value: 0,
    slots: [{ label: 'Body', categories: ['wood', 'bone'], qty: 3 }, { label: 'Binding', categories: SECONDARY_CATEGORIES, qty: 1 }, EXTRA, GEM] },
  { id: 'r_halberd', baseId: 'halberd', starter: false, blueprintWeight: 0.16, value: 240,
    slots: [{ label: 'Head', categories: ['metal'], qty: 4 }, { label: 'Shaft', categories: SECONDARY_CATEGORIES, qty: 4 }, EXTRA, GEM] },
  { id: 'r_great_maul', baseId: 'great_maul', starter: false, blueprintWeight: 0.16, value: 250,
    slots: [{ label: 'Head', categories: ['metal', 'wood'], qty: 5 }, { label: 'Haft', categories: SECONDARY_CATEGORIES, qty: 4 }, EXTRA, GEM] },
  { id: 'r_greatsword', baseId: 'greatsword', starter: false, blueprintWeight: 0.16, value: 340,
    slots: [{ label: 'Blade', categories: ['metal'], qty: 7 }, { label: 'Grip', categories: SECONDARY_CATEGORIES, qty: 2 }, EXTRA, GEM] },
  { id: 'r_throwing_knives', baseId: 'throwing_knives', starter: true, value: 0,
    slots: [{ label: 'Blades', categories: ['metal'], qty: 2 }, { label: 'Bandolier', categories: SECONDARY_CATEGORIES, qty: 1 }, EXTRA, GEM] },
  { id: 'r_throwing_axes', baseId: 'throwing_axes', starter: false, value: 130,
    slots: [{ label: 'Heads', categories: ['metal', 'wood'], qty: 3 }, { label: 'Hafts', categories: SECONDARY_CATEGORIES, qty: 2 }, EXTRA, GEM] },
  { id: 'r_javelins', baseId: 'javelins', starter: false, value: 210,
    slots: [{ label: 'Heads', categories: ['metal'], qty: 3 }, { label: 'Shafts', categories: SECONDARY_CATEGORIES, qty: 4 }, EXTRA, GEM] },

  // Shields
  { id: 'r_buckler', baseId: 'buckler', starter: true, value: 0,
    slots: [{ label: 'Face', categories: ['metal', 'wood'], qty: 2 }, { label: 'Strap', categories: SECONDARY_CATEGORIES, qty: 1 }, EXTRA, GEM] },
  { id: 'r_kite_shield', baseId: 'kite_shield', starter: false, value: 120,
    slots: [{ label: 'Boards', categories: ['wood', 'metal'], qty: 4 }, { label: 'Rim', categories: SECONDARY_CATEGORIES, qty: 2 }, EXTRA, GEM] },
  { id: 'r_tower_shield', baseId: 'tower_shield', starter: false, value: 200,
    slots: [{ label: 'Plates', categories: ['metal'], qty: 6 }, { label: 'Backing', categories: SECONDARY_CATEGORIES, qty: 3 }, EXTRA, GEM] },

  // Head
  { id: 'r_cap', baseId: 'cap', starter: true, value: 0,
    slots: [{ label: 'Shell', categories: ['hide', 'cloth'], qty: 2 }, { label: 'Lining', categories: SECONDARY_CATEGORIES, qty: 1 }, EXTRA, GEM] },
  { id: 'r_helm', baseId: 'helm', starter: false, value: 100,
    slots: [{ label: 'Shell', categories: ['metal'], qty: 3 }, { label: 'Lining', categories: SECONDARY_CATEGORIES, qty: 1 }, EXTRA, GEM] },
  { id: 'r_great_helm', baseId: 'great_helm', starter: false, value: 190,
    slots: [{ label: 'Shell', categories: ['metal'], qty: 5 }, { label: 'Lining', categories: SECONDARY_CATEGORIES, qty: 2 }, EXTRA, GEM] },

  // Body
  { id: 'r_robe', baseId: 'robe', starter: false, value: 80,
    slots: [{ label: 'Cloth', categories: ['cloth'], qty: 5 }, { label: 'Trim', categories: SECONDARY_CATEGORIES, qty: 1 }, EXTRA, GEM] },
  { id: 'r_jerkin', baseId: 'jerkin', starter: true, value: 0,
    slots: [{ label: 'Hide', categories: ['hide'], qty: 4 }, { label: 'Lining', categories: SECONDARY_CATEGORIES, qty: 2 }, EXTRA, GEM] },
  { id: 'r_hauberk', baseId: 'hauberk', starter: false, value: 180,
    slots: [{ label: 'Rings', categories: ['metal'], qty: 6 }, { label: 'Padding', categories: SECONDARY_CATEGORIES, qty: 2 }, EXTRA, GEM] },
  { id: 'r_plate', baseId: 'plate', starter: false, value: 320,
    slots: [{ label: 'Plates', categories: ['metal'], qty: 9 }, { label: 'Straps', categories: SECONDARY_CATEGORIES, qty: 3 }, EXTRA, GEM] },

  // Hands
  { id: 'r_gloves', baseId: 'gloves', starter: true, value: 0,
    slots: [{ label: 'Hide', categories: ['hide', 'cloth'], qty: 2 }, { label: 'Lining', categories: SECONDARY_CATEGORIES, qty: 1 }, EXTRA, GEM] },
  { id: 'r_gauntlets', baseId: 'gauntlets', starter: false, value: 110,
    slots: [{ label: 'Plates', categories: ['metal'], qty: 3 }, { label: 'Glove', categories: SECONDARY_CATEGORIES, qty: 1 }, EXTRA, GEM] },

  // Jewelry
  { id: 'r_band', baseId: 'band', starter: true, value: 0,
    slots: [{ label: 'Band', categories: ['metal'], qty: 2 }, { label: 'Support', categories: SECONDARY_CATEGORIES, qty: 1 }, EXTRA, GEM] },
  { id: 'r_pendant', baseId: 'pendant', starter: false, value: 130,
    slots: [{ label: 'Setting', categories: ['metal'], qty: 2 }, { label: 'Support', categories: SECONDARY_CATEGORIES, qty: 1 }, EXTRA, { label: 'Stone', categories: ['gem'], qty: 1 }] },
];

const BY_ID = new Map(RECIPES.map((r) => [r.id, r]));
const BY_BASE = new Map(RECIPES.map((r) => [r.baseId, r]));

export function recipe(id: string): RecipeDef {
  const r = BY_ID.get(id);
  if (!r) throw new Error(`unknown recipe ${id}`);
  return r;
}

export const STARTER_RECIPES = RECIPES.filter((r) => r.starter).map((r) => r.id);

/** The recipe that forges a given item base. */
export function recipeForBase(baseId: string): RecipeDef | undefined {
  return BY_BASE.get(baseId);
}

export const MAX_RECIPE_RANK = 5;
const MASTERY_BONUSES = [0, 0, 0.08, 0.16, 0.26, 0.4];

export function recipeRank(ranks: RecipeRanks | undefined, id: string): number {
  return clamp(Math.floor(ranks?.[id] ?? 0), 0, MAX_RECIPE_RANK);
}

export function masteryBonus(rank: number): number {
  return MASTERY_BONUSES[clamp(Math.floor(rank), 0, MAX_RECIPE_RANK)] ?? 0;
}

/** Unlocking costs one blueprint; each later rank costs its target rank. */
export function blueprintCostForNextRank(rank: number): number {
  const current = clamp(Math.floor(rank), 0, MAX_RECIPE_RANK);
  return current >= MAX_RECIPE_RANK ? 0 : current + 1;
}

/** Recipes ordered along the gear ladder: line by line, weakest piece first. */
export const RECIPE_LADDER: readonly RecipeDef[] = [...RECIPES].sort(
  (a, b) => gearLadderIndex(a.baseId) - gearLadderIndex(b.baseId),
);

/** Relative drop frequency: each step up a line is markedly scarcer. */
export function blueprintDropWeight(r: RecipeDef): number {
  return r.blueprintWeight ?? 0.4 ** gearTier(r.baseId);
}

export function starterRecipeRanks(): RecipeRanks {
  return Object.fromEntries(STARTER_RECIPES.map((id) => [id, 1]));
}
