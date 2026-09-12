// ---------------------------------------------------------------------------
// Rarity
// ---------------------------------------------------------------------------

export enum Rarity {
  Common = 'Common',
  Uncommon = 'Uncommon',
  Rare = 'Rare',
  Epic = 'Epic',
  Legendary = 'Legendary',
}

export const RARITIES: Rarity[] = [Rarity.Common, Rarity.Uncommon, Rarity.Rare, Rarity.Epic, Rarity.Legendary];

export const RARITY_ORDER: Record<Rarity, number> = {
  [Rarity.Common]: 0,
  [Rarity.Uncommon]: 1,
  [Rarity.Rare]: 2,
  [Rarity.Epic]: 3,
  [Rarity.Legendary]: 4,
};

export const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.Common]: '#c9c1ad',
  [Rarity.Uncommon]: '#6fd66f',
  [Rarity.Rare]: '#5b9bff',
  [Rarity.Epic]: '#c070ff',
  [Rarity.Legendary]: '#ffa53a',
};

export function rarityAtLeast(r: Rarity, min: Rarity): boolean {
  return RARITY_ORDER[r] >= RARITY_ORDER[min];
}

export function rarityFromOrder(n: number): Rarity {
  return RARITIES[Math.max(0, Math.min(RARITIES.length - 1, Math.round(n)))];
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const STAT_KEYS = [
  'attack',
  'defense',
  'health',
  'stamina',
  'block',
  'speed',
  'luck',
  'find',
  'leech',
  'fire',
  'frost',
  'shadow',
  'holy',
] as const;

export type StatKey = (typeof STAT_KEYS)[number];
export type Stats = Record<StatKey, number>;

export const STAT_LABELS: Record<StatKey, string> = {
  attack: 'Attack',
  defense: 'Defense',
  health: 'Health',
  stamina: 'Stamina',
  block: 'Block %',
  speed: 'Speed %',
  luck: 'Crit %',
  find: 'Loot Find %',
  leech: 'Life Leech %',
  fire: 'Fire Dmg',
  frost: 'Frost Dmg',
  shadow: 'Shadow Dmg',
  holy: 'Holy Dmg',
};

export function emptyStats(): Stats {
  const s = {} as Stats;
  for (const k of STAT_KEYS) s[k] = 0;
  return s;
}

/** a += b * scale (mutates and returns a). */
export function addStats(a: Stats, b: Partial<Stats>, scale = 1): Stats {
  for (const k of STAT_KEYS) {
    const v = b[k];
    if (v) a[k] += v * scale;
  }
  return a;
}

export type DamageType = 'slash' | 'pierce' | 'blunt' | 'fire' | 'frost' | 'shadow' | 'holy';
export const ELEMENTS = ['fire', 'frost', 'shadow', 'holy'] as const;
export type Element = (typeof ELEMENTS)[number];

// ---------------------------------------------------------------------------
// Materials (every stackable commodity: crafting materials and valuables)
// ---------------------------------------------------------------------------

export type MaterialCategory = 'metal' | 'wood' | 'hide' | 'cloth' | 'bone' | 'gem' | 'valuable';

export interface MaterialDef {
  id: string;
  name: string;
  category: MaterialCategory;
  /** 1..5 — drives crafted stat scaling and drop depth. */
  tier: number;
  rarity: Rarity;
  /** Fair market value in gold. */
  value: number;
  /** Art id of the icon. */
  icon: string;
  /** Four colours dark→light that replace ramp chars 1-4 in the icon / weapon art. */
  ramp: [string, string, string, string];
  /** Stat bonus when used as the primary material (secondary slots apply half). */
  mods: Partial<Stats>;
  /** For gems: the affix a catalyst slot grants. */
  catalystAffix?: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export type Slot = 'weapon' | 'offhand' | 'head' | 'body' | 'hands' | 'ring' | 'amulet';
export type EquipSlot = 'weapon' | 'offhand' | 'head' | 'body' | 'hands' | 'ring1' | 'ring2' | 'amulet';
export const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'offhand', 'head', 'body', 'hands', 'ring1', 'ring2', 'amulet'];

export function slotOf(e: EquipSlot): Slot {
  return e === 'ring1' || e === 'ring2' ? 'ring' : e;
}

export type WeaponClass = 'blade' | 'dagger' | 'axe' | 'blunt' | 'spear' | 'pick';

export interface SwingProfile {
  /** Seconds from button press to the hit landing. */
  windup: number;
  /** Seconds after the hit before you can act again. */
  recovery: number;
  staminaCost: number;
  /** Tiles in front of you the swing reaches. */
  reach: number;
  /**
   * Damage multiplier on a crit. Defaults to {@link DEFAULT_CRIT_MULT}; a
   * dagger sets it higher, which is what makes Crit % gear worth stacking on
   * one rather than being a rounding error on everything.
   */
  critMult?: number;
}

/** Crit damage for anything that does not state its own. */
export const DEFAULT_CRIT_MULT = 1.6;

export interface ItemBaseDef {
  id: string;
  name: string;
  slot: Slot;
  icon: string;
  weaponClass?: WeaponClass;
  damageType?: DamageType;
  /** Stats at material tier 1. */
  base: Partial<Stats>;
  /** Added per material tier above 1. */
  perTier: Partial<Stats>;
  /** Material categories allowed as the primary material. */
  primary: MaterialCategory[];
  swing?: SwingProfile;
  value: number;
  /** Shallowest depth this base drops at. */
  minDepth: number;
  /** Relative drop weight. */
  weight: number;
}

export type ConsumableEffect =
  | { type: 'heal'; fraction: number }
  | { type: 'stamina'; fraction: number }
  | { type: 'identify' }
  | { type: 'recall'; seconds: number };

export interface ConsumableDef {
  id: string;
  name: string;
  icon: string;
  ramp?: [string, string, string, string];
  description: string;
  effect: ConsumableEffect;
  rarity: Rarity;
  value: number;
  stack: number;
}

export interface AffixDef {
  id: string;
  name: string;
  kind: 'prefix' | 'suffix';
  stat: StatKey;
  min: number;
  max: number;
  /** Value added per item level. */
  perLevel: number;
  slots: Slot[];
  weight: number;
  minIlvl: number;
}

export interface AffixRoll {
  id: string;
  value: number;
}

export type ItemKind = 'equipment' | 'consumable' | 'material' | 'blueprint' | 'lore';

/**
 * One inventory entry. `ref` points into the matching data table:
 * equipment → ITEM_BASES, consumable → CONSUMABLES, material → MATERIALS,
 * blueprint → RECIPES, lore → ENEMIES. Stats and names are derived, never
 * stored.
 */
export interface Item {
  uid: string;
  kind: ItemKind;
  ref: string;
  qty: number;
  /** Equipment: primary material. */
  materialId?: string;
  /** Equipment: secondary material (crafted items). */
  secondaryId?: string;
  rarity?: Rarity;
  ilvl?: number;
  affixes?: AffixRoll[];
  identified?: boolean;
  /** Multiplier on base stats, ~0.85–1.25. */
  quality?: number;
  crafted?: boolean;
  /** Recipe rank when forged. Absent on drops and old crafts means rank 1. */
  craftRank?: number;
  /**
   * Which bespoke legendary this is, if it is one. **Absent means it is an
   * ordinary item**, which is the same trick `dur` uses — so adding uniques
   * costs no migration on the items themselves.
   */
  uniqueId?: string;
  /**
   * Remaining durability. **Absent means undamaged** — that is what lets every
   * item written before durability existed read as a fresh one without a
   * migration walking every container on the save.
   */
  dur?: number;
}

// ---------------------------------------------------------------------------
// Crafting
// ---------------------------------------------------------------------------

export interface RecipeSlot {
  label: string;
  categories: MaterialCategory[];
  qty: number;
  optional?: boolean;
}

export interface RecipeDef {
  id: string;
  baseId: string;
  /** slots[0] is the primary material slot. A 'gem' slot acts as a catalyst. */
  slots: RecipeSlot[];
  /** Known from the start (otherwise learned from a blueprint). */
  starter: boolean;
  value: number;
}

/** Recipe id to mastery rank. Missing recipes are unknown (rank 0). */
export type RecipeRanks = Record<string, number>;

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

export interface LootEntry {
  id: string;
  chance: number;
  min: number;
  max: number;
}

export type EnemyBehavior = 'melee' | 'ranged' | 'skittish' | 'boss';

export interface ProjectileDef {
  sprite: string;
  /** Tiles per second. */
  speed: number;
  damageType: DamageType;
  light?: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  /** Art id prefix: `${sprite}_0`, `${sprite}_1` walk, `${sprite}_atk` attack. */
  sprite: string;
  /** Sprite height in tiles. */
  scale: number;
  hp: number;
  attack: number;
  defense: number;
  damageType: DamageType;
  /** Damage multipliers taken per type (default 1). */
  resist: Partial<Record<DamageType, number>>;
  undead?: boolean;
  behavior: EnemyBehavior;
  /** Seconds per tile step. */
  step: number;
  windup: number;
  recovery: number;
  /** Tiles of sight. */
  sight: number;
  projectile?: ProjectileDef;
  /** Preferred distance for ranged enemies. */
  range?: number;
  floats?: boolean;
  minDepth: number;
  maxDepth: number;
  weight: number;
  loot: LootEntry[];
  gold: [number, number];
  itemChance: number;
  /** Light emitted by the enemy (hex), e.g. wisps and wraiths. */
  glow?: string;
  description: string;
}
