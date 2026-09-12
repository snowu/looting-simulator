import { Rng, hashString } from '../core/rng';
import {
  AffixRoll,
  EnemyDef,
  Item,
  ItemBaseDef,
  MaterialCategory,
  MaterialDef,
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
import { MATERIALS, findMaterial, material } from '../data/materials';
import { AFFIXES, affix } from '../data/affixes';
import { RECIPES, recipe } from '../data/recipes';

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
  };
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
    case 'equipment': {
      const base = itemBase(item.ref);
      const adj = item.materialId ? MATERIAL_ADJ[item.materialId] ?? findMaterial(item.materialId)?.name ?? '' : '';
      const core = `${adj} ${base.name}`.trim();
      if (!isIdentified(item)) return `Unidentified ${core}`;
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

/** Zero for gear that never wears, so callers can test with one check. */
export function maxDurability(item: Item): number {
  if (item.kind !== 'equipment') return 0;
  const slotMax = DURABILITY_BY_SLOT[itemBase(item.ref).slot];
  if (!slotMax) return 0;
  const tier = item.materialId ? findMaterial(item.materialId)?.tier ?? 1 : 1;
  return Math.round(slotMax * (0.8 + 0.2 * tier));
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
  const base = itemBase(item.ref);
  const mat = item.materialId ? findMaterial(item.materialId) : undefined;
  const tier = mat?.tier ?? 1;
  const q = item.quality ?? 1;
  addStats(s, base.base, q);
  addStats(s, base.perTier, (tier - 1) * q);
  if (mat) addStats(s, mat.mods);
  if (item.secondaryId) {
    const m2 = findMaterial(item.secondaryId);
    if (m2) addStats(s, m2.mods, 0.5);
  }
  if (isIdentified(item)) {
    for (const a of item.affixes ?? []) s[affix(a.id).stat] += a.value;
  }
  // Broken gear still hangs on you, but it is barely doing its job.
  if (durability(item).broken) for (const k of STAT_KEYS) s[k] *= BROKEN_STAT_FRACTION;
  for (const k of STAT_KEYS) s[k] = Math.round(s[k]);
  return s;
}

const RARITY_VALUE_MULT = [1, 1.35, 1.9, 2.8, 4.5];

/** Fair value of ONE unit, before market modifiers. */
export function itemValue(item: Item): number {
  switch (item.kind) {
    case 'material':
      return material(item.ref).value;
    case 'consumable':
      return consumable(item.ref).value;
    case 'blueprint':
      return recipe(item.ref).value || 60;
    case 'equipment': {
      const base = itemBase(item.ref);
      const mat = item.materialId ? findMaterial(item.materialId) : undefined;
      const tier = mat?.tier ?? 1;
      const affixValue = (item.affixes ?? []).reduce((sum, a) => sum + a.value * 4, 0);
      const raw = base.value * (1 + (tier - 1) * 0.9) + (mat?.value ?? 0) * 1.5 + affixValue;
      return Math.max(1, Math.round(raw * (item.quality ?? 1) * RARITY_VALUE_MULT[RARITY_ORDER[item.rarity ?? Rarity.Common]]));
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
  const f = 1 + find / 100;
  return rng.weighted<Rarity>([
    [Rarity.Common, 100],
    [Rarity.Uncommon, (28 + depth * 6) * f],
    [Rarity.Rare, (7 + depth * 3) * f],
    [Rarity.Epic, (1.2 + depth * 1.1) * f],
    [Rarity.Legendary, (0.15 + depth * 0.3) * f],
  ]);
}

export function rollAffixes(rng: Rng, slot: Slot, ilvl: number, count: number, exclude: string[] = []): AffixRoll[] {
  const out: AffixRoll[] = [];
  const usedStats = new Set<string>();
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
  const list = pool.length ? pool : fallback;
  const target = 1 + (depth - 1) * 0.7 + rng.float(-0.6, 1.1);
  return rng.weighted(list.map((m) => [m, Math.exp(-Math.abs(m.tier - target) * 1.6) * (m.tier <= depth + 1 ? 1 : 0.05)] as const));
}

export function rollEquipment(
  rng: Rng,
  depth: number,
  find: number,
  opts: { rarity?: Rarity; minRarity?: Rarity; baseId?: string; identifyBelow?: Rarity } = {},
): Item {
  const base: ItemBaseDef = opts.baseId
    ? itemBase(opts.baseId)
    : rng.weighted(ITEM_BASES.filter((b) => b.minDepth <= depth).map((b) => [b, b.weight] as const));
  const mat = materialForDepth(rng, depth, base.primary);
  let rarity = opts.rarity ?? rollRarity(rng, depth, find);
  if (opts.minRarity && RARITY_ORDER[rarity] < RARITY_ORDER[opts.minRarity]) rarity = opts.minRarity;
  const order = RARITY_ORDER[rarity];
  const ilvl = depth * 2 + rng.int(0, 2);
  const autoId = RARITY_ORDER[opts.identifyBelow ?? Rarity.Uncommon];
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
  return rng.weighted(gems.map((g) => [g, g.tier <= depth / 1.5 + 1.5 ? 1 : 0.15] as const));
}

function rollValuable(rng: Rng, depth: number): MaterialDef {
  const vals = MATERIALS.filter((m) => m.category === 'valuable');
  return rng.weighted(vals.map((v) => [v, Math.exp(-Math.abs(v.tier - (depth / 1.4 + 0.5)) * 1.2)] as const));
}

function rollBlueprint(rng: Rng, depth: number): Item {
  const pool = RECIPES.filter((r) => !r.starter && itemBase(r.baseId).minDepth <= depth + 1);
  return makeBlueprint(rng.pick(pool.length ? pool : RECIPES.filter((r) => !r.starter)).id);
}

export interface LootRoll {
  items: Item[];
  gold: number;
}

export function rollEnemyLoot(rng: Rng, def: EnemyDef, depth: number, find: number, identifyBelow?: Rarity): LootRoll {
  const items: Item[] = [];
  const f = 1 + find / 200;
  for (const e of def.loot) {
    if (rng.chance(Math.min(1, e.chance * f))) items.push(makeMaterial(e.id, rng.int(e.min, e.max)));
  }
  const gold = rng.int(def.gold[0], def.gold[1]);
  if (def.behavior === 'boss') {
    items.push(rollEquipment(rng, depth, find, { rarity: Rarity.Legendary }));
    items.push(rollEquipment(rng, depth, find, { minRarity: Rarity.Epic }));
    items.push(rollBlueprint(rng, depth));
  } else if (rng.chance(Math.min(0.95, def.itemChance * (1 + find / 100)))) {
    items.push(rollEquipment(rng, depth, find, { identifyBelow }));
  }
  if (rng.chance(0.06)) items.push(makeConsumable('healing_draught'));
  if (rng.chance(0.012 * depth)) items.push(rollBlueprint(rng, depth));
  return { items, gold };
}

export type ContainerTier = 'urn' | 'chest' | 'vault' | 'secret';

export function rollContainerLoot(rng: Rng, depth: number, find: number, tier: ContainerTier, identifyBelow?: Rarity): LootRoll {
  const items: Item[] = [];
  let gold = 0;
  const cats: MaterialCategory[] = ['metal', 'wood', 'hide', 'cloth', 'bone'];
  switch (tier) {
    case 'urn':
      if (rng.chance(0.55)) items.push(makeMaterial(materialForDepth(rng, depth, cats).id, rng.int(1, 2)));
      if (rng.chance(0.35)) gold += rng.int(2, 6 + depth * 3);
      if (rng.chance(0.06)) items.push(makeConsumable('healing_draught'));
      if (rng.chance(0.05)) items.push(makeMaterial(rollValuable(rng, depth).id, 1));
      break;
    case 'chest':
      gold += rng.int(8, 20) * depth;
      for (let i = rng.int(1, 3); i > 0; i--) items.push(makeMaterial(materialForDepth(rng, depth, cats).id, rng.int(1, 3)));
      if (rng.chance(0.4 * (1 + find / 100))) items.push(rollEquipment(rng, depth, find, { identifyBelow }));
      if (rng.chance(0.2)) items.push(makeConsumable(rng.pick(['healing_draught', 'stamina_tonic'])));
      if (rng.chance(0.1)) items.push(makeConsumable('scroll_identify'));
      if (rng.chance(0.18)) items.push(makeMaterial(rollValuable(rng, depth).id, 1));
      if (rng.chance(0.12)) items.push(makeMaterial(rollGem(rng, depth).id, 1));
      if (rng.chance(0.08)) items.push(rollBlueprint(rng, depth));
      break;
    case 'vault':
    case 'secret':
      gold += rng.int(30, 60) * depth;
      items.push(rollEquipment(rng, depth + 1, find, { minRarity: Rarity.Rare, identifyBelow }));
      if (rng.chance(0.5)) items.push(rollEquipment(rng, depth + 1, find, { minRarity: Rarity.Uncommon, identifyBelow }));
      items.push(makeMaterial(rollValuable(rng, depth + 1).id, rng.int(1, 2)));
      items.push(makeMaterial(rollGem(rng, depth + 1).id, 1));
      if (rng.chance(tier === 'secret' ? 0.7 : 0.35)) items.push(rollBlueprint(rng, depth + 1));
      if (rng.chance(0.35)) items.push(makeConsumable(rng.pick(['greater_healing', 'scroll_recall', 'scroll_identify'])));
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
