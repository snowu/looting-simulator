import { ConsumableDef, ItemBaseDef, Rarity } from '../types';

export const ITEM_BASES: ItemBaseDef[] = [
  // --- Weapons ------------------------------------------------------------
  {
    id: 'dagger', name: 'Dagger', slot: 'weapon', icon: 'ic_dagger', weaponClass: 'dagger', damageType: 'pierce',
    base: { attack: 5, luck: 3 }, perTier: { attack: 3 }, primary: ['metal'],
    swing: { windup: 0.12, recovery: 0.26, staminaCost: 11, reach: 1 }, value: 18, minDepth: 1, weight: 3,
  },
  {
    id: 'short_sword', name: 'Short Sword', slot: 'weapon', icon: 'ic_short_sword', weaponClass: 'blade', damageType: 'slash',
    base: { attack: 7 }, perTier: { attack: 4 }, primary: ['metal'],
    swing: { windup: 0.18, recovery: 0.36, staminaCost: 15, reach: 1 }, value: 28, minDepth: 1, weight: 3,
  },
  {
    id: 'long_sword', name: 'Long Sword', slot: 'weapon', icon: 'ic_long_sword', weaponClass: 'blade', damageType: 'slash',
    base: { attack: 10 }, perTier: { attack: 5.5 }, primary: ['metal'],
    swing: { windup: 0.26, recovery: 0.48, staminaCost: 21, reach: 1 }, value: 55, minDepth: 2, weight: 2,
  },
  {
    id: 'war_axe', name: 'War Axe', slot: 'weapon', icon: 'ic_axe', weaponClass: 'axe', damageType: 'slash',
    base: { attack: 12 }, perTier: { attack: 6.5 }, primary: ['metal'],
    swing: { windup: 0.34, recovery: 0.6, staminaCost: 26, reach: 1 }, value: 60, minDepth: 2, weight: 2,
  },
  {
    id: 'mining_pick', name: 'Mining Pick', slot: 'weapon', icon: 'ic_mining_pick', weaponClass: 'pick', damageType: 'pierce',
    base: { attack: 10, luck: 2 }, perTier: { attack: 5.5 }, primary: ['metal'],
    swing: { windup: 0.3, recovery: 0.52, staminaCost: 22, reach: 1 }, value: 48, minDepth: 1, weight: 2,
  },
  {
    id: 'mace', name: 'Mace', slot: 'weapon', icon: 'ic_mace', weaponClass: 'blunt', damageType: 'blunt',
    base: { attack: 9 }, perTier: { attack: 5 }, primary: ['metal'],
    swing: { windup: 0.26, recovery: 0.5, staminaCost: 20, reach: 1 }, value: 45, minDepth: 1, weight: 2,
  },
  {
    id: 'spear', name: 'Spear', slot: 'weapon', icon: 'ic_spear', weaponClass: 'spear', damageType: 'pierce',
    base: { attack: 8 }, perTier: { attack: 4.5 }, primary: ['metal'],
    swing: { windup: 0.24, recovery: 0.5, staminaCost: 19, reach: 2 }, value: 46, minDepth: 2, weight: 2,
  },
  {
    id: 'club', name: 'Club', slot: 'weapon', icon: 'ic_club', weaponClass: 'blunt', damageType: 'blunt',
    base: { attack: 6 }, perTier: { attack: 3 }, primary: ['wood', 'bone'],
    swing: { windup: 0.22, recovery: 0.44, staminaCost: 16, reach: 1 }, value: 10, minDepth: 1, weight: 3,
  },

  // --- Off-hand -----------------------------------------------------------
  {
    id: 'buckler', name: 'Buckler', slot: 'offhand', icon: 'ic_buckler',
    base: { defense: 1, block: 35 }, perTier: { defense: 1, block: 5 }, primary: ['metal', 'wood'],
    value: 18, minDepth: 1, weight: 3,
  },
  {
    id: 'kite_shield', name: 'Kite Shield', slot: 'offhand', icon: 'ic_kite_shield',
    base: { defense: 2, block: 55 }, perTier: { defense: 1.5, block: 5 }, primary: ['wood', 'metal'],
    value: 38, minDepth: 2, weight: 2,
  },
  {
    id: 'tower_shield', name: 'Tower Shield', slot: 'offhand', icon: 'ic_tower_shield',
    base: { defense: 4, block: 70, speed: -10 }, perTier: { defense: 2, block: 4 }, primary: ['metal'],
    value: 60, minDepth: 3, weight: 1,
  },

  // --- Head ---------------------------------------------------------------
  {
    id: 'cap', name: 'Cap', slot: 'head', icon: 'ic_cap',
    base: { defense: 1 }, perTier: { defense: 1 }, primary: ['hide', 'cloth'], value: 9, minDepth: 1, weight: 3,
  },
  {
    id: 'helm', name: 'Helm', slot: 'head', icon: 'ic_helm',
    base: { defense: 3 }, perTier: { defense: 2 }, primary: ['metal'], value: 30, minDepth: 1, weight: 2,
  },
  {
    id: 'great_helm', name: 'Great Helm', slot: 'head', icon: 'ic_great_helm',
    base: { defense: 5, health: 5 }, perTier: { defense: 2.5 }, primary: ['metal'], value: 55, minDepth: 3, weight: 1,
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
    base: { defense: 6, speed: -5 }, perTier: { defense: 3 }, primary: ['metal'], value: 55, minDepth: 2, weight: 2,
  },
  {
    id: 'plate', name: 'Plate Armor', slot: 'body', icon: 'ic_plate',
    base: { defense: 10, speed: -10, stamina: -10 }, perTier: { defense: 4 }, primary: ['metal'], value: 92, minDepth: 4, weight: 1,
  },

  // --- Hands --------------------------------------------------------------
  {
    id: 'gloves', name: 'Gloves', slot: 'hands', icon: 'ic_gloves',
    base: { defense: 1, speed: 3 }, perTier: { defense: 1 }, primary: ['hide', 'cloth'], value: 12, minDepth: 1, weight: 3,
  },
  {
    id: 'gauntlets', name: 'Gauntlets', slot: 'hands', icon: 'ic_gauntlets',
    base: { defense: 2, attack: 1 }, perTier: { defense: 1.5, attack: 0.5 }, primary: ['metal'], value: 28, minDepth: 2, weight: 2,
  },

  // --- Jewelry ------------------------------------------------------------
  {
    id: 'band', name: 'Band', slot: 'ring', icon: 'ic_ring',
    base: { luck: 1 }, perTier: { luck: 1 }, primary: ['metal'], value: 24, minDepth: 1, weight: 2,
  },
  {
    id: 'pendant', name: 'Pendant', slot: 'amulet', icon: 'ic_amulet',
    base: { health: 5 }, perTier: { health: 5 }, primary: ['metal'], value: 34, minDepth: 2, weight: 1,
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
    id: 'scroll_recall', name: 'Scroll of Recall', icon: 'ic_scroll', ramp: ['#1a2a4a', '#34508a', '#6a90d0', '#d0e4ff'],
    description: 'After 5 seconds of stillness, carries you and your pack back to town.',
    effect: { type: 'recall', seconds: 5 }, rarity: Rarity.Rare, value: 95, stack: 5,
  },
];

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
export const FIST_SWING = { windup: 0.14, recovery: 0.3, staminaCost: 9, reach: 1 };
export const FIST_ATTACK = 3;
