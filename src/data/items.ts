import { ConsumableDef, ItemBaseDef, Rarity, SwingProfile } from '../types';

export const ITEM_BASES: ItemBaseDef[] = [
  // --- Weapons ------------------------------------------------------------
  {
    id: 'dagger', name: 'Dagger', slot: 'weapon', icon: 'ic_dagger', weaponClass: 'dagger', damageType: 'pierce',
    base: { attack: 5, luck: 5 }, perTier: { attack: 3, luck: 1.5 }, primary: ['metal'],
    swing: { windup: 0.12, recovery: 0.26, staminaCost: 10, reach: 1, critMult: 2.4 }, value: 18, minDepth: 1, weight: 3,
  },
  {
    id: 'short_sword', name: 'Short Sword', slot: 'weapon', icon: 'ic_short_sword', weaponClass: 'blade', damageType: 'slash',
    base: { attack: 12 }, perTier: { attack: 4 }, primary: ['metal'],
    swing: { windup: 0.18, recovery: 0.36, staminaCost: 16, reach: 1 }, value: 28, minDepth: 2, weight: 1.7,
  },
  {
    id: 'long_sword', name: 'Long Sword', slot: 'weapon', icon: 'ic_long_sword', weaponClass: 'blade', damageType: 'slash',
    base: { attack: 21 }, perTier: { attack: 5.5 }, primary: ['metal'],
    swing: { windup: 0.26, recovery: 0.48, staminaCost: 24, reach: 1 }, value: 55, minDepth: 3, weight: 0.85,
  },
  {
    id: 'war_axe', name: 'War Axe', slot: 'weapon', icon: 'ic_axe', weaponClass: 'axe', damageType: 'slash',
    base: { attack: 36 }, perTier: { attack: 3.5 }, primary: ['metal'],
    swing: { windup: 0.36, recovery: 0.62, staminaCost: 22, reach: 1 }, value: 60, minDepth: 4, weight: 0.45,
  },
  {
    id: 'mining_pick', name: 'Mining Pick', slot: 'weapon', icon: 'ic_mining_pick', weaponClass: 'pick', damageType: 'pierce',
    base: { attack: 26, luck: 2 }, perTier: { attack: 4 }, primary: ['metal'],
    swing: { windup: 0.30, recovery: 0.54, staminaCost: 20, reach: 1 }, value: 52, minDepth: 3, weight: 0.85,
  },
  {
    id: 'mace', name: 'Mace', slot: 'weapon', icon: 'ic_mace', weaponClass: 'blunt', damageType: 'blunt',
    base: { attack: 15 }, perTier: { attack: 4.5 }, primary: ['metal'],
    swing: { windup: 0.28, recovery: 0.52, staminaCost: 17, reach: 1 }, value: 45, minDepth: 2, weight: 1.7,
  },
  {
    id: 'spear', name: 'Spear', slot: 'weapon', icon: 'ic_spear', weaponClass: 'spear', damageType: 'pierce',
    base: { attack: 19 }, perTier: { attack: 4.5 }, primary: ['metal'],
    swing: { windup: 0.24, recovery: 0.56, staminaCost: 17, reach: 2 }, value: 48, minDepth: 2, weight: 1.3,
  },
  {
    id: 'club', name: 'Club', slot: 'weapon', icon: 'ic_club', weaponClass: 'blunt', damageType: 'blunt',
    base: { attack: 6 }, perTier: { attack: 4 }, primary: ['wood', 'bone'],
    swing: { windup: 0.22, recovery: 0.44, staminaCost: 12, reach: 1 }, value: 10, minDepth: 1, weight: 3,
  },

  // --- Off-hand -----------------------------------------------------------
  {
    id: 'buckler', name: 'Buckler', slot: 'offhand', icon: 'ic_buckler',
    base: { defense: 1, block: 35 }, perTier: { defense: 1, block: 5 }, primary: ['metal', 'wood'],
    value: 18, minDepth: 1, weight: 3,
  },
  {
    id: 'kite_shield', name: 'Kite Shield', slot: 'offhand', icon: 'ic_kite_shield',
    base: { defense: 4, block: 55 }, perTier: { defense: 1.5, block: 5 }, primary: ['wood', 'metal'],
    value: 38, minDepth: 2, weight: 1.7,
  },
  {
    id: 'tower_shield', name: 'Tower Shield', slot: 'offhand', icon: 'ic_tower_shield',
    base: { defense: 8, block: 74, speed: -10 }, perTier: { defense: 2, block: 4 }, primary: ['metal'],
    value: 60, minDepth: 3, weight: 0.85,
  },

  // --- Head ---------------------------------------------------------------
  {
    id: 'cap', name: 'Cap', slot: 'head', icon: 'ic_cap',
    base: { defense: 1 }, perTier: { defense: 1 }, primary: ['hide', 'cloth'], value: 9, minDepth: 1, weight: 3,
  },
  {
    id: 'helm', name: 'Helm', slot: 'head', icon: 'ic_helm',
    base: { defense: 4 }, perTier: { defense: 2 }, primary: ['metal'], value: 30, minDepth: 2, weight: 1.7,
  },
  {
    id: 'great_helm', name: 'Great Helm', slot: 'head', icon: 'ic_great_helm',
    base: { defense: 9, health: 5 }, perTier: { defense: 2.5 }, primary: ['metal'], value: 55, minDepth: 3, weight: 0.85,
  },

  // --- Body ---------------------------------------------------------------
  {
    id: 'robe', name: 'Robe', slot: 'body', icon: 'ic_robe',
    base: { defense: 1, stamina: 10 }, perTier: { defense: 1, stamina: 5 }, primary: ['cloth'], value: 18, minDepth: 1, weight: 2,
  },
  {
    id: 'jerkin', name: 'Jerkin', slot: 'body', icon: 'ic_jerkin',
    base: { defense: 3 }, perTier: { defense: 2 }, primary: ['hide'], value: 24, minDepth: 1, weight: 3,
  },
  {
    id: 'hauberk', name: 'Hauberk', slot: 'body', icon: 'ic_hauberk',
    base: { defense: 8, speed: -5 }, perTier: { defense: 3 }, primary: ['metal'], value: 55, minDepth: 2, weight: 1.7,
  },
  {
    id: 'plate', name: 'Plate Armor', slot: 'body', icon: 'ic_plate',
    base: { defense: 15, speed: -10, stamina: -10 }, perTier: { defense: 4 }, primary: ['metal'], value: 92, minDepth: 4, weight: 0.5,
  },

  // --- Hands --------------------------------------------------------------
  {
    id: 'gloves', name: 'Gloves', slot: 'hands', icon: 'ic_gloves',
    base: { defense: 1, speed: 3 }, perTier: { defense: 1 }, primary: ['hide', 'cloth'], value: 12, minDepth: 1, weight: 3,
  },
  {
    id: 'gauntlets', name: 'Gauntlets', slot: 'hands', icon: 'ic_gauntlets',
    base: { defense: 4, attack: 1 }, perTier: { defense: 1.5, attack: 0.5 }, primary: ['metal'], value: 28, minDepth: 2, weight: 1.7,
  },

  // --- Jewelry ------------------------------------------------------------
  {
    id: 'band', name: 'Band', slot: 'ring', icon: 'ic_ring',
    base: { luck: 1 }, perTier: { luck: 1 }, primary: ['metal'], value: 24, minDepth: 1, weight: 2,
  },
  {
    id: 'pendant', name: 'Pendant', slot: 'amulet', icon: 'ic_amulet',
    base: { health: 5 }, perTier: { health: 5 }, primary: ['metal'], value: 34, minDepth: 2, weight: 1.2,
  },
];

export const CONSUMABLES: ConsumableDef[] = [
  {
    id: 'healing_draught', name: 'Healing Draught', icon: 'ic_potion', ramp: ['#3a0408', '#7a0c14', '#c82028', '#ff8080'],
    description: 'Restores 35% of your health.', effect: { type: 'heal', fraction: 0.35 },
    rarity: Rarity.Common, value: 24, stack: 5,
  },
  {
    id: 'greater_healing', name: 'Greater Healing', icon: 'ic_potion', ramp: ['#3a0428', '#7a0c5a', '#d0209a', '#ffa0e0'],
    description: 'Restores 75% of your health.', effect: { type: 'heal', fraction: 0.75 },
    rarity: Rarity.Rare, value: 70, stack: 5,
  },
  {
    id: 'stamina_tonic', name: 'Stamina Tonic', icon: 'ic_potion', ramp: ['#0c3a10', '#1a7020', '#40b030', '#b0ff80'],
    description: 'Refills your stamina at once.', effect: { type: 'stamina', fraction: 1 },
    rarity: Rarity.Common, value: 16, stack: 5,
  },
  {
    id: 'scroll_identify', name: 'Scroll of Identify', icon: 'ic_scroll', ramp: ['#4a3a20', '#8a7040', '#c8a868', '#f4e4b0'],
    description: 'Reveals the true nature of one item.', effect: { type: 'identify' },
    rarity: Rarity.Uncommon, value: 30, stack: 10,
  },
  {
    // The only Legendary you can drink. Deliberately not stocked by any
    // merchant and not craftable: it turns up in the dark or not at all.
    id: 'fight_milk', name: 'Fight Milk', icon: 'ic_potion', ramp: ['#2a2410', '#6a6030', '#c8c088', '#f8f4d8'],
    description: "Crow's egg, goat milk, and something the distiller declined to name. For the rest of the delve: stamina recovers 70% faster (34/s → 57.8/s), maximum stamina −20. A second bottle does nothing.",
    effect: { type: 'tonic', tonicId: 'fight_milk' },
    rarity: Rarity.Legendary, value: 420, stack: 2,
  },
  {
    id: 'scroll_recall', name: 'Scroll of Recall', icon: 'ic_scroll', ramp: ['#1a2a4a', '#34508a', '#6a90d0', '#d0e4ff'],
    description: 'After 5 seconds of stillness, carries you and your pack back to town.',
    effect: { type: 'recall', seconds: 5 }, rarity: Rarity.Rare, value: 95, stack: 5,
  },
];

/**
 * Gear progression lines, each running from the crudest piece to the strongest.
 * A line is the spine of the loot ladder: a piece is built to beat the one
 * below it forged from material two tiers better, it starts dropping a depth
 * later, and its blueprint is markedly scarcer. Singletons are lines of one.
 */
export const GEAR_LINES: readonly (readonly string[])[] = [
  ['dagger', 'short_sword', 'long_sword'],
  ['club', 'mace', 'mining_pick', 'war_axe'],
  ['spear'],
  ['buckler', 'kite_shield', 'tower_shield'],
  ['cap', 'helm', 'great_helm'],
  ['robe'],
  ['jerkin', 'hauberk', 'plate'],
  ['gloves', 'gauntlets'],
  ['band'],
  ['pendant'],
];

const LINE_POS = new Map<string, { line: number; tier: number }>();
for (let line = 0; line < GEAR_LINES.length; line++) {
  GEAR_LINES[line].forEach((id, tier) => LINE_POS.set(id, { line, tier }));
}

/** How far up its line a base sits: 0 is the entry piece. */
export function gearTier(baseId: string): number {
  return LINE_POS.get(baseId)?.tier ?? 0;
}

/** The weaker piece this one follows, or null at the head of a line. */
export function gearPredecessor(baseId: string): string | null {
  const at = LINE_POS.get(baseId);
  return at && at.tier > 0 ? GEAR_LINES[at.line][at.tier - 1] : null;
}

/** Sort key placing bases line by line, weakest first within each line. */
export function gearLadderIndex(baseId: string): number {
  const at = LINE_POS.get(baseId);
  return at ? at.line * 100 + at.tier : 9999;
}

const BASE_BY_ID = new Map(ITEM_BASES.map((b) => [b.id, b]));
const CONS_BY_ID = new Map(CONSUMABLES.map((c) => [c.id, c]));

export function itemBase(id: string): ItemBaseDef {
  const b = BASE_BY_ID.get(id);
  if (!b) throw new Error(`unknown item base ${id}`);
  return b;
}

export function consumable(id: string): ConsumableDef {
  const c = CONS_BY_ID.get(id);
  if (!c) throw new Error(`unknown consumable ${id}`);
  return c;
}

/** Unarmed swing when no weapon is equipped. */
export const FIST_SWING: SwingProfile = { windup: 0.14, recovery: 0.3, staminaCost: 9, reach: 1 };
export const FIST_ATTACK = 3;
