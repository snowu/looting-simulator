import { Rng, hashString } from '../core/rng';
import {
  AffixRoll,
  EnemyDef,
  Item,
  ItemBaseDef,
  MaterialCategory,
  MaterialDef,
  RecipeRanks,
  Rarity,
  RARITIES,
  RARITY_ORDER,
  Slot,
  Stats,
  addStats,
  emptyStats,
  rarityFromOrder,
  STAT_KEYS,
} from '../types';
import { ITEM_BASES, CONSUMABLES, itemBase, consumable } from '../data/items';
import { MATERIALS, findMaterial, material, secondaryMaterialMods } from '../data/materials';
import { AFFIXES, affix } from '../data/affixes';
import { GEAR_UNIQUES, UniqueDef, UniqueEffectId, findUnique, tonicUnique } from '../data/uniques';
import { MAX_RECIPE_RANK, RECIPES, blueprintDropWeight, masteryBonus, recipe, recipeRank } from '../data/recipes';
import { BestiaryState, isKnown, loreName } from './bestiary';

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

let uidCounter = 0;
export function newUid(): string {
  uidCounter = (uidCounter + 1) % 1_000_000;
  return Date.now().toString(36) + uidCounter.toString(36) + Math.floor(Math.random() * 46656).toString(36);
}

export function makeMaterial(id: string, qty = 1): Item {
  material(id); // validate
  return { uid: newUid(), kind: 'material', ref: id, qty };
}

export function makeConsumable(id: string, qty = 1): Item {
  consumable(id);
  return { uid: newUid(), kind: 'consumable', ref: id, qty };
}

export function makeBlueprint(recipeId: string): Item {
  recipe(recipeId);
  return { uid: newUid(), kind: 'blueprint', ref: recipeId, qty: 1 };
}

/** A page of field notes on one creature; reading it opens its codex entry. */
export function makeLore(enemyId: string): Item {
  return { uid: newUid(), kind: 'lore', ref: enemyId, qty: 1 };
}

export interface EquipmentSpec {
  baseId: string;
  materialId: string;
  secondaryId?: string;
  rarity: Rarity;
  ilvl: number;
  affixes?: AffixRoll[];
  identified?: boolean;
  quality?: number;
  crafted?: boolean;
  craftRank?: number;
  uniqueId?: string;
}

export function makeEquipment(spec: EquipmentSpec): Item {
  itemBase(spec.baseId);
  return {
    uid: newUid(),
    kind: 'equipment',
    ref: spec.baseId,
    qty: 1,
    materialId: spec.materialId,
    secondaryId: spec.secondaryId,
    rarity: spec.rarity,
    ilvl: spec.ilvl,
    affixes: spec.affixes ?? [],
    identified: spec.identified ?? true,
    quality: spec.quality ?? 1,
    crafted: spec.crafted,
    craftRank: spec.craftRank,
    uniqueId: spec.uniqueId,
  };
}

// ---------------------------------------------------------------------------
// Uniques
// ---------------------------------------------------------------------------

/** The bespoke legendary this item is, or null for everything else. */
export function uniqueOf(item: Item | null | undefined): UniqueDef | null {
  if (!item) return null;
  // A tonic is a relic you drink: it is identified by which consumable it is,
  // not by a uniqueId, since every bottle of Fight Milk is the same bottle.
  if (item.kind === 'consumable') return tonicUnique(item.ref) ?? null;
  if (item.kind !== 'equipment') return null;
  return findUnique(item.uniqueId) ?? null;
}

/** Whether this item carries a given bespoke effect. */
export function hasUniqueEffect(item: Item | null | undefined, effect: UniqueEffectId): boolean {
  return uniqueOf(item)?.effect === effect;
}

/** Build one, at the quality and item level the depth it dropped at implies. */
export function makeUnique(def: UniqueDef, rng: Rng, depth: number, identified = false): Item {
  if (def.kind !== 'gear' || !def.materialId) throw new Error(`${def.id} is a tonic, not gear`);
  const ilvl = Math.max(def.minDepth, depth) * 2 + rng.int(0, 2);
  const base = itemBase(def.baseId);
  return makeEquipment({
    baseId: def.baseId,
    materialId: def.materialId!,
    uniqueId: def.id,
    rarity: Rarity.Legendary,
    ilvl,
    // Two ordinary affixes rather than a Legendary's four: the effect is the
    // point, and the rolls are only there so two of the same one still differ.
    // Nothing is allowed to roll on a stat the relic deliberately spends — a
    // Fight Milk that rolled +Stamina would have no downside left at all.
    affixes: rollAffixes(rng, base.slot, ilvl, UNIQUE_AFFIXES, [], spentStats(def)),
    identified,
    quality: Math.round(rng.float(1.08, 1.26) * 100) / 100,
  });
}

/** The stats a relic pays with, which its affixes may not then refund. */
function spentStats(def: UniqueDef): string[] {
  return STAT_KEYS.filter((k) => (def.stats?.[k] ?? 0) < 0);
}

/** How many ordinary affixes a unique carries on top of its effect. */
const UNIQUE_AFFIXES = 2;

/** How much more likely a unique you have never held is than one you have. */
const UNSEEN_UNIQUE_BONUS = 6;

/**
 * Choose which unique a Legendary roll becomes. One you have never seen is
 * heavily favoured, so the set reveals itself over a few deep runs instead of
 * handing you the same blade three times; `onlyUnseen` is the boss's promise
 * that his drop is always new until there is nothing new left.
 */
export function pickUnique(rng: Rng, depth: number, seen: string[] = [], onlyUnseen = false): UniqueDef | null {
  const atDepth = GEAR_UNIQUES.filter((u) => u.minDepth <= depth);
  // An ordinary roll respects depth and simply stays a plain Legendary when
  // nothing is deep enough yet. A guaranteed drop does not get to lapse: the
  // King owes you a relic wherever he is standing when he falls.
  const eligible = atDepth.length ? atDepth : onlyUnseen ? GEAR_UNIQUES : [];
  if (!eligible.length) return null;
  const unseen = eligible.filter((u) => !seen.includes(u.id));
  if (onlyUnseen) return unseen.length ? rng.pick(unseen) : rng.pick(eligible);
  return rng.weighted(eligible.map((u) => [u, seen.includes(u.id) ? 1 : UNSEEN_UNIQUE_BONUS] as const));
}

// ---------------------------------------------------------------------------
// Derived properties
// ---------------------------------------------------------------------------

const MATERIAL_ADJ: Record<string, string> = {
  copper: 'Copper', iron: 'Iron', silver: 'Silver', gold: 'Golden', moonsilver: 'Moonsilver',
  star_iron: 'Star-Iron', timber: 'Pine', yew: 'Yew', ironwood: 'Ironwood', rat_hide: 'Ratskin',
  leather: 'Leather', wyrm_leather: 'Wyrmhide', dragon_scale: 'Dragonscale', linen: 'Linen',
  spider_silk: 'Silken', shadow_silk: 'Shadow-Silk', bone: 'Bone',
};

const LEGEND_A = ['Grim', 'Dusk', 'Hollow', 'Ash', 'Bone', 'Night', 'Storm', 'Grave', 'Oath', 'Wyrm', 'Iron', 'Blood', 'Frost', 'Ember'];
const LEGEND_B = ['bane', 'fang', 'song', 'ward', 'reaver', 'brand', 'keeper', 'bite', 'call', 'shroud', 'mourn', 'heart', 'thorn', 'crown'];

export function legendName(uid: string): string {
  const h = hashString(uid);
  return LEGEND_A[h % LEGEND_A.length] + LEGEND_B[(h >>> 8) % LEGEND_B.length];
}

export function itemRarity(item: Item): Rarity {
  switch (item.kind) {
    case 'equipment':
      return item.rarity ?? Rarity.Common;
    case 'material':
      return material(item.ref).rarity;
    case 'consumable':
      return consumable(item.ref).rarity;
    case 'blueprint':
      return Rarity.Uncommon;
    case 'lore':
      return Rarity.Rare;
  }
}

export function isIdentified(item: Item): boolean {
  return item.kind !== 'equipment' || item.identified !== false;
}

export function itemName(item: Item): string {
  switch (item.kind) {
    case 'material':
      return material(item.ref).name;
    case 'consumable':
      return consumable(item.ref).name;
    case 'blueprint':
      return `Blueprint: ${itemBase(recipe(item.ref).baseId).name}`;
    case 'lore':
      return loreName(item.ref);
    case 'equipment': {
      const base = itemBase(item.ref);
      const adj = item.materialId ? MATERIAL_ADJ[item.materialId] ?? findMaterial(item.materialId)?.name ?? '' : '';
      const core = `${adj} ${base.name}`.trim();
      if (!isIdentified(item)) return `Unidentified ${core}`;
      const unique = uniqueOf(item);
      if (unique) return unique.name;
      if (item.rarity === Rarity.Legendary) return `${legendName(item.uid)}, ${core}`;
      const affs = (item.affixes ?? []).map((a) => affix(a.id));
      const pre = affs.find((a) => a.kind === 'prefix');
      const suf = affs.find((a) => a.kind === 'suffix');
      return [pre?.name, core, suf?.name].filter(Boolean).join(' ');
    }
  }
}

export function itemIcon(item: Item): { icon: string; ramp?: [string, string, string, string] } {
  switch (item.kind) {
    case 'material': {
      const m = material(item.ref);
      return { icon: m.icon, ramp: m.ramp };
    }
    case 'consumable': {
      const c = consumable(item.ref);
      return { icon: c.icon, ramp: c.ramp };
    }
    case 'blueprint':
      return { icon: 'ic_blueprint' };
    case 'lore':
      return { icon: 'ic_lore' };
    case 'equipment': {
      const m = item.materialId ? findMaterial(item.materialId) : undefined;
      return { icon: itemBase(item.ref).icon, ramp: m?.ramp };
    }
  }
}

/** Stats an equipment item grants. Affixes only count once identified. */
/**
 * Durability.
 *
 * Only the gear that actually takes the blows wears out — the weapon you swing,
 * the shield you raise and the armour you are hit in. Rings and amulets never
 * degrade, because a ring that needs repairing is book-keeping, not a decision.
 */
const DURABILITY_BY_SLOT: Partial<Record<Slot, number>> = {
  weapon: 110,
  offhand: 130,
  body: 150,
  head: 120,
  hands: 110,
};

/** What a piece of gear that is worn out is still worth to you. */
export const BROKEN_STAT_FRACTION = 0.25;

export function itemCraftRank(item: Item): number {
  if (item.kind !== 'equipment' || !item.crafted) return 1;
  return Math.max(1, Math.min(MAX_RECIPE_RANK, Math.floor(item.craftRank ?? 1)));
}

/** Zero for gear that never wears, so callers can test with one check. */
export function maxDurability(item: Item): number {
  if (item.kind !== 'equipment') return 0;
  // The one item in the game that is simply not part of this system.
  if (hasUniqueEffect(item, 'never_dulls')) return 0;
  const slotMax = DURABILITY_BY_SLOT[itemBase(item.ref).slot];
  if (!slotMax) return 0;
  const tier = item.materialId ? findMaterial(item.materialId)?.tier ?? 1 : 1;
  const mastery = masteryBonus(itemCraftRank(item));
  return Math.round(slotMax * (0.8 + 0.2 * tier) * (1 + mastery));
}

export interface Durability {
  cur: number;
  max: number;
  /** 0..1, or 1 for gear that does not wear. */
  frac: number;
  broken: boolean;
  /** Whether this item wears at all. */
  wears: boolean;
}

export function durability(item: Item): Durability {
  const max = maxDurability(item);
  if (max <= 0) return { cur: 0, max: 0, frac: 1, broken: false, wears: false };
  const cur = Math.max(0, Math.min(max, item.dur ?? max));
  return { cur, max, frac: cur / max, broken: cur <= 0, wears: true };
}

/**
 * Wear an item by `amount`. Returns what crossing happened, so the world can
 * say something the one time it matters rather than every swing.
 */
export function wearItem(item: Item | null, amount = 1): 'none' | 'warn' | 'broke' {
  if (!item) return 'none';
  const d = durability(item);
  if (!d.wears || d.broken) return 'none';
  const before = d.cur;
  const after = Math.max(0, before - amount);
  item.dur = after;
  if (after <= 0) return 'broke';
  const warnAt = Math.ceil(d.max * 0.25);
  return before > warnAt && after <= warnAt ? 'warn' : 'none';
}

/** Gold to make it whole again. Free for gear that is already fine. */
export function repairCost(item: Item): number {
  const d = durability(item);
  if (!d.wears || d.frac >= 1) return 0;
  return Math.max(1, Math.ceil(itemValue(item) * 0.3 * (1 - d.frac)));
}

export function repairItem(item: Item): void {
  const max = maxDurability(item);
  if (max > 0) item.dur = max;
}

export function itemStats(item: Item): Stats {
  const s = emptyStats();
  if (item.kind !== 'equipment') return s;
  // Diablo rule: an unidentified item is unusable — it grants nothing at all,
  // not even its base and material numbers, until it is identified. This also
  // covers gear that was equipped before this rule existed.
  if (!isIdentified(item)) return s;
  const base = itemBase(item.ref);
  const mat = item.materialId ? findMaterial(item.materialId) : undefined;
  const tier = mat?.tier ?? 1;
  const q = item.quality ?? 1;
  const core = emptyStats();
  addStats(core, base.base, q);
  addStats(core, base.perTier, (tier - 1) * q);
  const mastery = masteryBonus(itemCraftRank(item));
  for (const k of STAT_KEYS) if (core[k] > 0) core[k] *= 1 + mastery;
  addStats(s, core);
  if (mat) addStats(s, mat.mods);
  if (item.secondaryId) {
    const m2 = findMaterial(item.secondaryId);
    if (m2) {
      addStats(s, secondaryMaterialMods(m2));
      addStats(s, m2.mods);
    }
  }
  // A unique's own numbers are part of what it is, so they land with the
  // material rather than with the affixes — but only once you know what you
  // are holding, like everything else on an unidentified drop.
  if (isIdentified(item)) {
    const unique = uniqueOf(item);
    if (unique?.stats) addStats(s, unique.stats);
    for (const a of item.affixes ?? []) s[affix(a.id).stat] += a.value;
  }
  // Broken gear still hangs on you, but it is barely doing its job.
  if (durability(item).broken) for (const k of STAT_KEYS) s[k] *= BROKEN_STAT_FRACTION;
  for (const k of STAT_KEYS) s[k] = Math.round(s[k]);
  return s;
}

const RARITY_VALUE_MULT = [1, 1.35, 1.9, 2.8, 4.5];

/**
 * A named blade is worth more than the star iron in it. Deliberately steep: a
 * unique you do not want is a real payday, which is what stops a duplicate
 * from feeling like the boss gave you nothing.
 */
const UNIQUE_VALUE_MULT = 2.2;

/** Fair value of ONE unit, before market modifiers. */
export function itemValue(item: Item): number {
  switch (item.kind) {
    case 'material':
      return material(item.ref).value;
    case 'consumable':
      return consumable(item.ref).value;
    case 'blueprint':
      return recipe(item.ref).value || 60;
    // Never sold — it is read where it is found — but it still needs a number
    // for the loot summaries that price a whole pile.
    case 'lore':
      return 40;
    case 'equipment': {
      const base = itemBase(item.ref);
      const mat = item.materialId ? findMaterial(item.materialId) : undefined;
      const tier = mat?.tier ?? 1;
      const affixValue = (item.affixes ?? []).reduce((sum, a) => sum + a.value * 4, 0);
      const raw = base.value * (1 + (tier - 1) * 0.9) + (mat?.value ?? 0) * 1.5 + affixValue;
      const unique = uniqueOf(item) ? UNIQUE_VALUE_MULT : 1;
      return Math.max(1, Math.round(raw * unique * (item.quality ?? 1) * RARITY_VALUE_MULT[RARITY_ORDER[item.rarity ?? Rarity.Common]]));
    }
  }
}

export type ItemCategory = 'weapon' | 'armor' | 'jewelry';

export function itemCategory(item: Item): ItemCategory | null {
  if (item.kind !== 'equipment') return null;
  const slot = itemBase(item.ref).slot;
  if (slot === 'weapon') return 'weapon';
  if (slot === 'ring' || slot === 'amulet') return 'jewelry';
  return 'armor';
}

export function identify(item: Item): void {
  if (item.kind === 'equipment') item.identified = true;
}

export function identifyCost(item: Item, appraiserLevel: number): number {
  return Math.max(5, Math.round((10 + itemValue(item) * 0.12) * (1 - 0.4 * Math.min(1, appraiserLevel))));
}

// ---------------------------------------------------------------------------
// Rolling loot
// ---------------------------------------------------------------------------

export function rollRarity(rng: Rng, depth: number, find: number): Rarity {
  // Floored above zero: find is a stat, a relic is allowed to spend it, and
  // Common's weight is now a division rather than a constant.
  const f = Math.max(0.1, 1 + find / 100);
  // Loot find pushes the whole distribution up, rather than only scaling the
  // good bands. Common sat at a flat 100 and anchored the roll, so a maxed
  // Treasure Sense bought about 15% more drops of which almost all were still
  // Common — more junk, not better junk, which is not what "loot find" means
  // to anyone reading it. Dividing the Common weight makes the same number
  // move quality as well as quantity. At find 0 this is exactly 100, so it
  // changes nothing for a player who has not bought any.
  const bands: [Rarity, number][] = [
    [Rarity.Common, 100 / f],
    [Rarity.Uncommon, (18 + depth * 4) * f],
    [Rarity.Rare, (4 + depth * 1.8) * f],
    [Rarity.Epic, (0.5 + depth * 0.6) * f],
    [Rarity.Legendary, (0.06 + depth * 0.16) * f],
  ];
  return rng.weighted<Rarity>(bands.filter(([rarity]) => rarityAvailableAtDepth(rarity, depth)));
}

/**
 * Natural drops unlock one rarity band as you go. Later than it used to be: a
 * Rare on the second floor made the first two floors' worth of Commons
 * pointless the moment you saw one.
 */
export function rarityAvailableAtDepth(rarity: Rarity, depth: number): boolean {
  return depth >= [1, 1, 3, 5, 6][RARITY_ORDER[rarity]];
}

export function rollAffixes(
  rng: Rng,
  slot: Slot,
  ilvl: number,
  count: number,
  exclude: string[] = [],
  excludeStats: string[] = [],
): AffixRoll[] {
  const out: AffixRoll[] = [];
  const usedStats = new Set<string>(excludeStats);
  let prefixes = 0;
  let suffixes = 0;
  for (const id of exclude) {
    const a = affix(id);
    usedStats.add(a.stat);
    if (a.kind === 'prefix') prefixes++;
    else suffixes++;
  }
  for (let i = 0; i < count; i++) {
    const pool = AFFIXES.filter(
      (a) =>
        a.slots.includes(slot) &&
        a.minIlvl <= ilvl &&
        !usedStats.has(a.stat) &&
        (a.kind === 'prefix' ? prefixes < 2 : suffixes < 2),
    );
    if (pool.length === 0) break;
    const a = rng.weighted(pool.map((p) => [p, p.weight] as const));
    usedStats.add(a.stat);
    if (a.kind === 'prefix') prefixes++;
    else suffixes++;
    out.push({ id: a.id, value: rollAffixValue(rng, a.id, ilvl) });
  }
  return out;
}

export function rollAffixValue(rng: Rng, affixId: string, ilvl: number): number {
  const a = affix(affixId);
  return Math.max(1, Math.round(rng.float(a.min, a.max + 1) + a.perLevel * ilvl));
}

const EXCLUDED_FROM_GEAR: MaterialCategory[] = ['gem', 'valuable'];

/** Pick a material of the given categories whose tier suits `depth`. */
export function materialForDepth(rng: Rng, depth: number, categories: MaterialCategory[]): MaterialDef {
  const pool = MATERIALS.filter((m) => categories.includes(m.category) && !EXCLUDED_FROM_GEAR.includes(m.category));
  const fallback = MATERIALS.filter((m) => categories.includes(m.category));
  const candidates = pool.length ? pool : fallback;
  const list = candidates.filter((m) => materialAvailableAtDepth(m, depth));
  const target = 1 + (depth - 1) * 0.55 + rng.float(-0.7, 0.8);
  return rng.weighted((list.length ? list : candidates).map((m) => [m, Math.exp(-Math.abs(m.tier - target) * 1.6) * materialRarityWeight(m)] as const));
}

/**
 * Which floor a material tier starts appearing on, indexed by tier.
 *
 * Tier 3 used to be reachable on floor one, which is most of why the power
 * curve ran away: silver and ironwood were in the first chest you opened, and
 * the gear ladder was three rungs ahead of the floor ladder by depth 2. The
 * metal you are wearing should say how deep you have been.
 */
const TIER_DEPTH = [1, 1, 2, 4, 5, 6];

export function materialAvailableAtDepth(material: MaterialDef, depth: number): boolean {
  const tierDepth = TIER_DEPTH[material.tier] ?? 6;
  return depth >= tierDepth && rarityAvailableAtDepth(material.rarity, depth);
}

function materialRarityWeight(material: MaterialDef): number {
  return 0.35 ** RARITY_ORDER[material.rarity];
}

export interface RollEquipmentOpts {
  rarity?: Rarity;
  minRarity?: Rarity;
  baseId?: string;
  identifyBelow?: Rarity;
  /** Uniques already found in this playthrough, so the dungeon can favour new ones. */
  seenUniques?: string[];
  /** Force the Legendary roll to a unique you have not held. The boss's promise. */
  guaranteeNewUnique?: boolean;
}

export function rollEquipment(rng: Rng, depth: number, find: number, opts: RollEquipmentOpts = {}): Item {
  const base: ItemBaseDef = opts.baseId
    ? itemBase(opts.baseId)
    : rng.weighted(ITEM_BASES.filter((b) => b.minDepth <= depth).map((b) => [b, b.weight] as const));
  const mat = materialForDepth(rng, depth, base.primary);
  let rarity = opts.rarity ?? rollRarity(rng, depth, find);
  if (opts.minRarity && RARITY_ORDER[rarity] < RARITY_ORDER[opts.minRarity]) rarity = opts.minRarity;
  const order = RARITY_ORDER[rarity];
  const ilvl = depth * 2 + rng.int(0, 2);
  const autoId = RARITY_ORDER[opts.identifyBelow ?? Rarity.Uncommon];
  // A Legendary is not a Rare with two more affixes any more: it *becomes* one
  // of the authored uniques. The base and material are already drawn above, so
  // diverting here costs no extra RNG draws and cannot reshuffle a floor that
  // exists. A caller that asked for a specific base still gets that base.
  if (rarity === Rarity.Legendary && !opts.baseId) {
    const def = pickUnique(rng, depth, opts.seenUniques ?? [], opts.guaranteeNewUnique);
    if (def) return makeUnique(def, rng, depth, order < autoId);
  }
  return makeEquipment({
    baseId: base.id,
    materialId: mat.id,
    rarity,
    ilvl,
    affixes: rollAffixes(rng, base.slot, ilvl, order),
    identified: order < autoId,
    quality: Math.round((rng.float(0.86, 1.08) + order * 0.04) * 100) / 100,
  });
}

function rollGem(rng: Rng, depth: number): MaterialDef {
  const gems = MATERIALS.filter((m) => m.category === 'gem');
  const available = gems.filter((g) => materialAvailableAtDepth(g, depth));
  return rng.weighted((available.length ? available : gems).map((g) => [g, materialRarityWeight(g)] as const));
}

function rollValuable(rng: Rng, depth: number): MaterialDef {
  const vals = MATERIALS.filter((m) => m.category === 'valuable');
  return rng.weighted(vals.map((v) => [v, Math.exp(-Math.abs(v.tier - (depth / 1.4 + 0.5)) * 1.2)] as const));
}

/** A recipe you have never seen is worth this much more than one you are ranking up. */
const UNKNOWN_BLUEPRINT_BONUS = 3;

/**
 * Pick a blueprint to drop. Three pressures stack into one weighted draw:
 * a recipe higher up its gear line is scarcer, a recipe you don't know yet is
 * favoured, and a maxed one never appears. Nothing is ever locked behind
 * another recipe — depth alone decides what the dungeon can hand you, and the
 * ladder only bends the odds.
 */
export function rollBlueprint(rng: Rng, depth: number, ranks: RecipeRanks = {}, reserved: Set<string> = new Set()): Item {
  const eligible = RECIPES.filter((r) => itemBase(r.baseId).minDepth <= depth);
  const unreserved = eligible.filter((r) => !reserved.has(r.id));
  const candidates = unreserved.length ? unreserved : eligible;
  const wanted = candidates.filter((r) => recipeRank(ranks, r.id) < MAX_RECIPE_RANK);
  const pool = wanted.length ? wanted : candidates;
  const picked = rng.weighted(pool.map((r) => {
    const unknown = recipeRank(ranks, r.id) === 0;
    return [r, blueprintDropWeight(r) * (unknown ? UNKNOWN_BLUEPRINT_BONUS : 1)] as const;
  }));
  reserved.add(picked.id);
  return makeBlueprint(picked.id);
}

export interface LootRoll {
  items: Item[];
  gold: number;
}

/**
 * Chance that a kill yields field notes on its own kind. Only rolls while the
 * entry is unread, so the codex fills steadily and then stops costing drops.
 * A boss always gives up its page.
 */
const LORE_CHANCE = 0.1;

export function rollEnemyLoot(
  rng: Rng,
  def: EnemyDef,
  depth: number,
  find: number,
  identifyBelow?: Rarity,
  ranks: RecipeRanks = {},
  bestiary?: BestiaryState,
  seenUniques: string[] = [],
): LootRoll {
  const items: Item[] = [];
  if (!isKnown(bestiary, def.id) && (def.behavior === 'boss' || rng.chance(LORE_CHANCE))) {
    items.push(makeLore(def.id));
  }
  const blueprints = new Set<string>();
  const f = 1 + find / 200;
  for (const e of def.loot) {
    if (rng.chance(Math.min(1, e.chance * f))) items.push(makeMaterial(e.id, rng.int(e.min, e.max)));
  }
  const gold = rng.int(def.gold[0], def.gold[1]);
  if (def.behavior === 'boss') {
    // The one guaranteed Legendary in the game, and it is always one you have
    // not held. Killing the King should be progression, not a lottery ticket.
    items.push(rollEquipment(rng, depth, find, { rarity: Rarity.Legendary, seenUniques, guaranteeNewUnique: true }));
    items.push(rollEquipment(rng, depth, find, { minRarity: Rarity.Epic }));
    items.push(rollBlueprint(rng, depth, ranks, blueprints));
  } else if (rng.chance(Math.min(0.95, def.itemChance * (1 + find / 100)))) {
    items.push(rollEquipment(rng, depth, find, { identifyBelow, seenUniques }));
  }
  // Potions off corpses were the reason health never actually ran out.
  if (rng.chance(0.025)) items.push(makeConsumable('healing_draught'));
  if (rng.chance(0.006 * depth)) items.push(rollBlueprint(rng, depth, ranks, blueprints));
  return { items, gold };
}

export type ContainerTier = 'urn' | 'chest' | 'vault' | 'secret';

/**
 * The only Legendary you can drink, and the odds of finding one. Kept genuinely
 * low: a run-long buff you can rely on is not a buff, it is a stat. Deeper
 * floors are likelier, and no merchant ever stocks it.
 */
const FIGHT_MILK_CHANCE = { chest: 0.008, vault: 0.03 };

/** Scales a find with depth: nothing at the top, full odds at the bottom. */
function depthFactor(depth: number): number {
  return Math.max(0, Math.min(1, (depth - 1) / 4));
}

export function rollContainerLoot(
  rng: Rng,
  depth: number,
  find: number,
  tier: ContainerTier,
  identifyBelow?: Rarity,
  ranks: RecipeRanks = {},
  seenUniques: string[] = [],
): LootRoll {
  const items: Item[] = [];
  let gold = 0;
  const f = 1 + find / 100;
  const cats: MaterialCategory[] = ['metal', 'wood', 'hide', 'cloth', 'bone'];
  switch (tier) {
    case 'urn':
      // An urn is a handful of something, or nothing. Most of them are nothing,
      // which is what makes the one with a gem in it worth the swing.
      if (rng.chance(0.4)) items.push(makeMaterial(materialForDepth(rng, depth, cats).id, rng.int(1, 2)));
      if (rng.chance(0.3)) gold += rng.int(2, 6 + depth * 3);
      if (rng.chance(0.03)) items.push(makeConsumable('healing_draught'));
      if (rng.chance(0.03 * f)) items.push(makeMaterial(rollValuable(rng, depth).id, 1));
      break;
    case 'chest':
      // Fewer chests on a floor, and a chest is allowed to be a real find. The
      // coin per chest is up; the gear chance is less than half what it was,
      // because a chest that hands you a weapon every other time is a vending
      // machine and you stop reading the room it is standing in.
      gold += rng.int(10, 22) * depth;
      for (let i = rng.int(1, 2); i > 0; i--) items.push(makeMaterial(materialForDepth(rng, depth, cats).id, rng.int(1, 3)));
      if (rng.chance(0.17 * (1 + find / 100))) items.push(rollEquipment(rng, depth, find, { identifyBelow, seenUniques }));
      if (rng.chance(0.12)) items.push(makeConsumable(rng.pick(['healing_draught', 'stamina_tonic'])));
      if (rng.chance(0.07)) items.push(makeConsumable('scroll_identify'));
      if (rng.chance(0.14 * f)) items.push(makeMaterial(rollValuable(rng, depth).id, 1));
      if (rng.chance(0.1 * f)) items.push(makeMaterial(rollGem(rng, depth).id, 1));
      if (rng.chance(0.05)) items.push(rollBlueprint(rng, depth, ranks));
      if (rng.chance(FIGHT_MILK_CHANCE.chest * depthFactor(depth))) items.push(makeConsumable('fight_milk'));
      break;
    case 'vault':
    case 'secret':
      // Untouched on purpose. A vault is behind a key and a secret is behind a
      // wall you had to read: they are the two places in the dungeon that are
      // supposed to pay, and they are rarer than everything else by design.
      gold += rng.int(40, 75) * depth;
      items.push(rollEquipment(rng, depth, find, { minRarity: depth >= 4 ? Rarity.Rare : Rarity.Uncommon, identifyBelow, seenUniques }));
      if (rng.chance(0.25)) items.push(rollEquipment(rng, depth, find, { minRarity: Rarity.Uncommon, identifyBelow, seenUniques }));
      items.push(makeMaterial(rollValuable(rng, depth).id, rng.int(1, 2)));
      items.push(makeMaterial(rollGem(rng, depth).id, 1));
      if (rng.chance(tier === 'secret' ? 0.7 : 0.35)) items.push(rollBlueprint(rng, depth, ranks));
      if (rng.chance(0.35)) items.push(makeConsumable(rng.pick(['greater_healing', 'scroll_recall', 'scroll_identify'])));
      if (rng.chance(FIGHT_MILK_CHANCE.vault * depthFactor(depth))) items.push(makeConsumable('fight_milk'));
      break;
  }
  return { items, gold };
}

/** Break an equipment item back into materials. */
export function salvage(item: Item, rng: Rng): Item[] {
  if (item.kind !== 'equipment') return [];
  const r = RECIPES.find((rc) => rc.baseId === item.ref);
  const out: Item[] = [];
  const primaryQty = r ? r.slots[0].qty : 2;
  if (item.materialId) out.push(makeMaterial(item.materialId, Math.max(1, Math.floor(primaryQty / 2))));
  if (item.secondaryId && rng.chance(0.5)) out.push(makeMaterial(item.secondaryId, 1));
  const order = RARITY_ORDER[item.rarity ?? Rarity.Common];
  if (order > 0 && rng.chance(0.2 * order)) out.push(makeMaterial(rollGem(rng, (item.ilvl ?? 2) / 2).id, 1));
  return out;
}

export { RARITIES, rarityFromOrder, CONSUMABLES };
