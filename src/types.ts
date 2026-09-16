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
  'focus',
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
  focus: 'Spell Focus %',
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

/**
 * `thrown` is a belt of shafts, not a weapon. It has its own slot because a
 * bandolier of knives is not the thing in your hands — you carry it *and* a
 * sword, and a two-hander does not displace it the way it displaces a shield.
 * It contributes nothing to your stats while worn: it is ammunition, and if it
 * paid Defense it would just be a ninth gear slot.
 */
export type Slot = 'weapon' | 'offhand' | 'thrown' | 'head' | 'body' | 'hands' | 'ring' | 'amulet';
export type EquipSlot = 'weapon' | 'offhand' | 'thrown' | 'head' | 'body' | 'hands' | 'ring1' | 'ring2' | 'amulet';
export const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'offhand', 'thrown', 'head', 'body', 'hands', 'ring1', 'ring2', 'amulet'];

export function slotOf(e: EquipSlot): Slot {
  return e === 'ring1' || e === 'ring2' ? 'ring' : e;
}

export type WeaponClass = 'blade' | 'dagger' | 'axe' | 'blunt' | 'spear' | 'pick' | 'greatsword' | 'maul' | 'halberd' | 'thrown';

export interface SwingProfile {
  /** Seconds from button press to the hit landing. */
  windup: number;
  /** Seconds after the hit before you can act again. */
  recovery: number;
  staminaCost: number;
  /** Tiles in front of you the swing reaches. */
  reach: number;
  /**
   * Fraction of the blow carried into every tile touching the one you hit —
   * beside it, behind it and diagonally, but never back onto your own tile.
   *
   * Aimed squarely at the one thing a shield cannot do. A guard only ever
   * covers the tile you face, so a press of bodies is what it is worst at; a
   * cleave answers it by spending the swing past the first rank instead of
   * into it. It is deliberately a *spill*, not a second swing — the numbers
   * are small enough that cleaving is never the reason to pick a fight with
   * three things at once, only what makes it survivable when one picks you.
   */
  cleave?: number;
  /**
   * Seconds added to a struck enemy's attack cooldown. A two-hander buys time
   * rather than cancelling a wind-up — cancelling wind-ups is the parry's job
   * and stays the parry's job.
   */
  stagger?: number;
  /** Guard chips this blow counts for. Absent means one. */
  chips?: number;
  /**
   * Damage multiplier on a crit. Defaults to {@link DEFAULT_CRIT_MULT}; a
   * dagger sets it higher, which is what makes Crit % gear worth stacking on
   * one rather than being a rounding error on everything.
   */
  critMult?: number;
}

/** Crit damage for anything that does not state its own. */
export const DEFAULT_CRIT_MULT = 1.6;

/**
 * A thrown weapon's stock and flight.
 *
 * The stock is finite and the spent shafts land on the floor, so the loop is
 * throw, run dry, and go and get them back — the weapon is a resource you
 * manage across a room rather than a button you hold.
 */
export interface ThrownProfile {
  /** Shafts carried at material tier 1. */
  stock: number;
  /** Added per material tier above 1. */
  stockPerTier: number;
  /** Seconds from press to release, and after it before you can act. */
  windup: number;
  recovery: number;
  staminaCost: number;
  /** Tiles per second in flight. */
  speed: number;
  /** Tiles it covers before it falls short. */
  range: number;
  /**
   * Multiplier on your Attack for a thrown hit. The base's own `attack` is the
   * *melee* number — a thrown weapon out of shafts is a bad short weapon — and
   * this scales it up to what the throw does. Affixes and material ride along,
   * which is what keeps thrown weapons inside the power ladder rather than
   * beside it.
   */
  power: number;
  /** Art id of the shaft in flight. */
  sprite: string;
  /** Art id of the shafts lying on the floor waiting to be picked up. */
  groundSprite: string;
}

export interface ItemBaseDef {
  id: string;
  name: string;
  slot: Slot;
  icon: string;
  weaponClass?: WeaponClass;
  damageType?: DamageType;
  /**
   * Needs both hands, so the offhand stays empty while it is worn. Absent means
   * one-handed — the same trick `dur` and `uniqueId` use, so every item ever
   * written before two-handers existed reads as one-handed with no migration.
   */
  twoHanded?: boolean;
  /**
   * What the stock looks like and how it flies. Only bases in the `thrown`
   * slot carry one, and they have no `swing` at all — a belt of javelins is
   * never something you stab with, and you have a real weapon in hand for that.
   */
  thrown?: ThrownProfile;
  /** Stats at material tier 1. */
  base: Partial<Stats>;
  /** Added per material tier above 1. */
  perTier: Partial<Stats>;
  /** Material categories allowed as the primary material. */
  primary: MaterialCategory[];
  swing?: SwingProfile;
  value: number;
  /**
   * Overrides the weaponClass → viewmodel map, for a base whose class does not
   * pick the right model on its own.
   */
  viewmodel?: string;
  /** Shallowest depth this base drops at. */
  minDepth: number;
  /** Relative drop weight. */
  weight: number;
}

export type ConsumableEffect =
  | { type: 'heal'; fraction: number }
  | { type: 'stamina'; fraction: number }
  | { type: 'identify' }
  | { type: 'recall'; seconds: number }
  /** A blinding flash of true light at whatever faces you. See World.use. */
  | { type: 'flash' }
  /** Yanked back along your own path. See World.use. */
  | { type: 'backstep' }
  /** A draught whose effect lasts the rest of the delve. See TONICS. */
  | { type: 'tonic'; tonicId: string };

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

export type ItemKind = 'equipment' | 'consumable' | 'material' | 'blueprint' | 'lore' | 'sigil';

/**
 * One inventory entry. `ref` points into the matching data table:
 * equipment → ITEM_BASES, consumable → CONSUMABLES, material → MATERIALS,
 * blueprint → RECIPES, lore → ENEMIES, sigil → SIGILS. Stats and names are derived, never
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
  /** Equipment: optional second secondary material; absent on older crafts. */
  secondary2Id?: string;
  rarity?: Rarity;
  ilvl?: number;
  affixes?: AffixRoll[];
  identified?: boolean;
  /** Appraiser identification preserves otherwise-unidentified salvage mastery. */
  autoIdentified?: boolean;
  /** Source floor keeps salvage gems inside the original drop’s material band. */
  lootDepth?: number;
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
  /** Primary, required secondary, optional secondary, then gem catalyst. */
  slots: RecipeSlot[];
  /** Known from the start (otherwise learned from a blueprint). */
  starter: boolean;
  /** Overrides the gear-line-derived relative blueprint drop frequency. */
  blueprintWeight?: number;
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
  /** Native element for fire/frost-biome spawn rules. */
  element?: 'fire' | 'frost';
  /** Damage multipliers taken per type (default 1). */
  resist: Partial<Record<DamageType, number>>;
  undead?: boolean;
  behavior: EnemyBehavior;
  /**
   * Carried shield, if any. Frontal blows that land while the bearer is
   * neither winding up nor reeling are absorbed for `block` (fraction), and
   * every second consecutive blocked blow is answered with a shield-bash that
   * stuns you for `stun` seconds. Absent means no guard at all.
   */
  shield?: { block: number; stun: number };
  /** Seconds per tile step. */
  step: number;
  windup: number;
  recovery: number;
  /** Tiles of sight. */
  sight: number;
  projectile?: ProjectileDef;
  /** Preferred distance for ranged enemies. */
  range?: number;
  /** Lateral offsets of a volley. Absent means a single bolt. */
  volley?: number[];
  floats?: boolean;
  minDepth: number;
  maxDepth: number;
  weight: number;
  loot: LootEntry[];
  gold: [number, number];
  itemChance: number;
  /** Food left on death. Bosses and monsters that do not feed the delve omit it. */
  morsel?: 'scrap' | 'cut' | 'heart';
  /** Light emitted by the enemy (hex), e.g. wisps and wraiths. */
  glow?: string;
  description: string;
}
