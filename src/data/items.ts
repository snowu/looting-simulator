import { ConsumableDef, ItemBaseDef, Rarity, SwingProfile } from '../types';

/**
 * What a two-hander spills into everything touching the thing it hit. One
 * number for all three: the cleave is what "two-handed" means in this game, so
 * it is not a knob that distinguishes the three from each other — reach,
 * stagger and the size of the blow do that.
 */
const CLEAVE = 0.25;

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

  // --- Two-handed ---------------------------------------------------------
  // These spend the offhand, which is by a distance the most valuable slot in
  // the game: a silver Tower Shield is +12 Defense and 82% block for a −10
  // speed tax, and every rung of the gear ladder carries one because there was
  // never a reason not to. So none of the three is allowed to be the best
  // weapon by DPS — the Long Sword keeps that — and each pays the shield back
  // in something a shield cannot buy: reach without a guard, a swing that
  // covers your flanks, or the biggest blunt hit in the game.
  {
    id: 'halberd', name: 'Halberd', slot: 'weapon', icon: 'ic_halberd', weaponClass: 'halberd', damageType: 'pierce',
    twoHanded: true, viewmodel: 'vm_polearm',
    base: { attack: 28 }, perTier: { attack: 5.5 }, primary: ['metal'],
    swing: { windup: 0.34, recovery: 0.66, staminaCost: 22, reach: 2, cleave: CLEAVE, stagger: 0.5, chips: 2 },
    value: 92, minDepth: 3, weight: 0.5,
  },
  {
    id: 'great_maul', name: 'Great Maul', slot: 'weapon', icon: 'ic_great_maul', weaponClass: 'maul', damageType: 'blunt',
    twoHanded: true, viewmodel: 'vm_maul',
    base: { attack: 32 }, perTier: { attack: 6.5 }, primary: ['metal', 'wood'],
    swing: { windup: 0.46, recovery: 0.74, staminaCost: 23, reach: 1, cleave: CLEAVE, stagger: 0.3, chips: 2 },
    value: 96, minDepth: 4, weight: 0.4,
  },
  {
    id: 'greatsword', name: 'Greatsword', slot: 'weapon', icon: 'ic_greatsword', weaponClass: 'greatsword', damageType: 'slash',
    twoHanded: true, viewmodel: 'vm_greatsword',
    base: { attack: 30 }, perTier: { attack: 6 }, primary: ['metal'],
    swing: { windup: 0.38, recovery: 0.60, staminaCost: 24, reach: 1, cleave: CLEAVE, stagger: 0.3, chips: 2 },
    value: 130, minDepth: 5, weight: 0.3,
  },

  // --- Thrown -------------------------------------------------------------
  // A finite stock that lands on the floor and has to be collected. `attack`
  // here is the *melee* number — what the weapon is worth once the stock is
  // gone — and `thrown.power` scales it up to what a throw does. Every one is
  // deliberately worse in the hand than the cheapest melee weapon of its era,
  // so a thrown weapon is a positioning tool you pay for, never a free upgrade.
  {
    id: 'throwing_knives', name: 'Throwing Knives', slot: 'weapon', icon: 'ic_throwing_knives', weaponClass: 'thrown', damageType: 'pierce',
    viewmodel: 'vm_thrown_knife',
    base: { attack: 5 }, perTier: { attack: 1.4 }, primary: ['metal'],
    swing: { windup: 0.14, recovery: 0.30, staminaCost: 8, reach: 1 },
    thrown: {
      stock: 6, stockPerTier: 0.5, windup: 0.16, recovery: 0.34, staminaCost: 9,
      speed: 9, range: 4, power: 1.8, sprite: 'proj_knife', groundSprite: 'pickup_knives',
    },
    value: 26, minDepth: 2, weight: 1.6,
  },
  {
    id: 'throwing_axes', name: 'Throwing Axes', slot: 'weapon', icon: 'ic_throwing_axes', weaponClass: 'thrown', damageType: 'slash',
    viewmodel: 'vm_thrown_axe',
    base: { attack: 12 }, perTier: { attack: 2.8 }, primary: ['metal', 'wood'],
    swing: { windup: 0.20, recovery: 0.42, staminaCost: 13, reach: 1 },
    thrown: {
      stock: 4, stockPerTier: 0.5, windup: 0.24, recovery: 0.46, staminaCost: 15,
      speed: 7, range: 5, power: 1.42, sprite: 'proj_axe_thrown', groundSprite: 'pickup_axes',
    },
    value: 58, minDepth: 3, weight: 0.9,
  },
  {
    id: 'javelins', name: 'Javelins', slot: 'weapon', icon: 'ic_javelins', weaponClass: 'thrown', damageType: 'pierce',
    viewmodel: 'vm_javelin',
    base: { attack: 17 }, perTier: { attack: 2.9 }, primary: ['metal'],
    swing: { windup: 0.26, recovery: 0.56, staminaCost: 17, reach: 2 },
    thrown: {
      stock: 2, stockPerTier: 0.5, windup: 0.32, recovery: 0.58, staminaCost: 19,
      speed: 8, range: 7, power: 1.54, sprite: 'proj_javelin', groundSprite: 'pickup_javelins',
    },
    value: 88, minDepth: 4, weight: 0.5,
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
    description: 'Restores 25% of your health.', effect: { type: 'heal', fraction: 0.25 },
    rarity: Rarity.Common, value: 24, stack: 5,
  },
  {
    id: 'greater_healing', name: 'Greater Healing', icon: 'ic_potion', ramp: ['#3a0428', '#7a0c5a', '#d0209a', '#ffa0e0'],
    description: 'Restores 55% of your health.', effect: { type: 'heal', fraction: 0.55 },
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
    description: "Drunk, and it lasts the delve. You come back quicker and you have less to come back with.",
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
  ['throwing_knives', 'throwing_axes', 'javelins'],
  // Two-handers are lines of one, like the spear. A line *step* is required to
  // beat the step below it forged two material tiers better, on its own stats —
  // and a two-hander's compensation is paid in a slot that comparison cannot
  // see. Appending one to the blade or haft line would force it to be strictly
  // better than everything under it, which is the new top tier this roster is
  // not allowed to create. Each is tuned laterally against the whole ladder.
  ['halberd'],
  ['great_maul'],
  ['greatsword'],
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

/**
 * The first-person model a weapon class is held as. Shared so the dev art
 * sheet draws the viewmodels the game would actually draw, in the materials
 * the bases behind them allow, rather than guessing at the mapping.
 * An empty hand is `vm_fist`, decided by the caller that knows there is no
 * weapon at all.
 */
export function viewmodelFor(base: ItemBaseDef | ItemBaseDef['weaponClass']): string {
  // Takes a base rather than a class because the three thrown weapons share one
  // weapon class and must not share a model — a fan of knives and a cocked
  // javelin are not the same picture. A bare class is still accepted so callers
  // that only have one keep working.
  if (base && typeof base === 'object') {
    if (base.viewmodel) return base.viewmodel;
    return viewmodelFor(base.weaponClass);
  }
  switch (base) {
    case 'axe': return 'vm_axe';
    case 'pick': return 'vm_pick';
    case 'blunt': return 'vm_blunt';
    case 'spear': return 'vm_spear';
    case 'maul': return 'vm_maul';
    case 'halberd': return 'vm_polearm';
    case 'greatsword': return 'vm_greatsword';
    default: return 'vm_blade';
  }
}

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
