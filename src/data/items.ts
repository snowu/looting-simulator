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
    viewmodel: 'vm_dagger',
    base: { attack: 5, luck: 5 }, perTier: { attack: 3, luck: 1.5 }, primary: ['metal'],
    swing: { windup: 0.12, recovery: 0.26, staminaCost: 10, reach: 1, critMult: 2.4 }, value: 18, minDepth: 1, weight: 3,
  },
  {
    id: 'short_sword', name: 'Short Sword', slot: 'weapon', icon: 'ic_short_sword', weaponClass: 'blade', damageType: 'slash',
    viewmodel: 'vm_short_sword',
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
    id: 'club', name: 'Club', slot: 'weapon', icon: 'ic_club', viewmodel: 'vm_club', weaponClass: 'blunt', damageType: 'blunt',
    base: { attack: 6 }, perTier: { attack: 4 }, primary: ['wood', 'bone'],
    swing: { windup: 0.22, recovery: 0.44, staminaCost: 12, reach: 1 }, value: 10, minDepth: 1, weight: 3,
  },

  // --- Two-handed ---------------------------------------------------------
  // These spend the offhand, which is by a distance the most valuable slot in
  // the game: a silver Tower Shield is +12 Defense and 82% block for a −10
  // speed tax, and every rung of the gear ladder carries one because there was
  // never a reason not to.
  //
  // So they hit harder than anything one-handed, and the whole cost is weight.
  // Each carries a Speed penalty, which is not one tax but three: it slows the
  // swing (`derivePlayer` divides windup and recovery by the speed factor), it
  // slows every step you take, and past −12 total it tips you into `encumbered`
  // and slows them again. A Great Maul alone sits exactly on that line; a Great
  // Maul over plate is well past it, and you will feel every corridor.
  //
  // The earlier rule here was that no two-hander could lead the weapon table on
  // DPS. That was the wrong knob: it kept them a rounding error behind the War
  // Axe while they also gave up a shield, so there was no reason to carry one
  // but flavour. They lead on damage now, and pay for it in footspeed, stamina
  // and the guard they do not have.
  {
    id: 'halberd', name: 'Halberd', slot: 'weapon', icon: 'ic_halberd', weaponClass: 'halberd', damageType: 'pierce',
    twoHanded: true, viewmodel: 'vm_polearm',
    base: { attack: 32, speed: -7 }, perTier: { attack: 8 }, primary: ['metal'],
    swing: { windup: 0.36, recovery: 0.70, staminaCost: 27, reach: 2, cleave: CLEAVE, stagger: 0.5, chips: 2 },
    value: 118, minDepth: 3, weight: 0.5,
  },
  {
    id: 'great_maul', name: 'Great Maul', slot: 'weapon', icon: 'ic_great_maul', weaponClass: 'maul', damageType: 'blunt',
    twoHanded: true, viewmodel: 'vm_maul',
    base: { attack: 40, speed: -12 }, perTier: { attack: 9 }, primary: ['metal', 'wood'],
    swing: { windup: 0.48, recovery: 0.78, staminaCost: 31, reach: 1, cleave: CLEAVE, stagger: 0.3, chips: 2 },
    value: 128, minDepth: 4, weight: 0.4,
  },
  {
    id: 'greatsword', name: 'Greatsword', slot: 'weapon', icon: 'ic_greatsword', weaponClass: 'greatsword', damageType: 'slash',
    twoHanded: true, viewmodel: 'vm_greatsword',
    base: { attack: 36, speed: -8 }, perTier: { attack: 8 }, primary: ['metal'],
    swing: { windup: 0.40, recovery: 0.64, staminaCost: 29, reach: 1, cleave: CLEAVE, stagger: 0.3, chips: 2 },
    value: 172, minDepth: 5, weight: 0.3,
  },

  // --- Oddities -----------------------------------------------------------
  // Three weapons that are jokes with real numbers attached. Each one hooks a
  // system the game already runs rather than adding a new rule, and each one
  // is priced so that picking it is a trade rather than a punchline you pay
  // for. See docs/ODDITIES.md.
  {
    // A preserved toe the size of a forearm. Terrible reach — you have to be
    // *on* something to hit it with this — bought back with the widest cleave
    // and the heaviest stagger of any one-hander. It does not cut, it shoves,
    // which makes it a corridor weapon: a real niche, held in a real toe.
    id: 'big_toe', name: 'Big Toe', slot: 'weapon', icon: 'ic_big_toe', viewmodel: 'vm_big_toe',
    weaponClass: 'blunt', damageType: 'blunt',
    base: { attack: 17, speed: -4 }, perTier: { attack: 4 }, primary: ['bone', 'hide'],
    swing: { windup: 0.30, recovery: 0.58, staminaCost: 19, reach: 1, cleave: 0.4, stagger: 0.35, chips: 2 },
    value: 44, minDepth: 2, weight: 0.5,
  },
  {
    // The Prize Bull's. A spear that keeps a spear's reach and answers to a
    // charge rather than to a poke: see UNIQUES.
    id: 'prize_horn', name: 'Horn', slot: 'weapon', icon: 'ic_prize_horn', viewmodel: 'vm_prize_horn',
    weaponClass: 'spear', damageType: 'pierce',
    base: { attack: 20 }, perTier: { attack: 4.5 }, primary: ['bone'],
    swing: { windup: 0.26, recovery: 0.54, staminaCost: 18, reach: 2 },
    // Never in the ordinary pool: the Pasture hands this out or nobody does.
    value: 60, minDepth: 2, weight: 0,
  },
  {
    // A cane. It is worth almost nothing as a thing to hit people with, and
    // that is the trade — see UNIQUES.
    id: 'cane', name: 'Cane', slot: 'weapon', icon: 'ic_cane', viewmodel: 'vm_cane',
    weaponClass: 'blunt', damageType: 'blunt',
    base: { attack: 8, speed: 4 }, perTier: { attack: 2 }, primary: ['wood'],
    swing: { windup: 0.16, recovery: 0.32, staminaCost: 9, reach: 1 },
    value: 40, minDepth: 2, weight: 0,
  },

  // --- Thrown -------------------------------------------------------------
  // Their own slot, worn alongside a weapon and a shield: a belt of shafts is
  // not the thing in your hands. So `attack` here is what a *throw* is worth on
  // its own — it never touches your melee damage, and your sword never touches
  // the throw. `attack x thrown.power` is the number to compare against a
  // weapon's attack, and it lands a javelin near a Long Sword and knives well
  // under one, which is where a thing you can only do a handful of times, from
  // outside its reach, belongs.
  //
  // A finite stock that lands on the floor and has to be collected. Running dry
  // costs you the tool until you call the shafts back, which is the price of
  // reaching something that cannot reach you.
  {
    id: 'throwing_knives', name: 'Throwing Knives', slot: 'thrown', icon: 'ic_throwing_knives', weaponClass: 'thrown', damageType: 'pierce',
    base: { attack: 5 }, perTier: { attack: 1.4 }, primary: ['metal'],
    thrown: {
      stock: 6, stockPerTier: 0.5, windup: 0.16, recovery: 0.10, staminaCost: 9,
      speed: 9, range: 4, power: 1.8, sprite: 'proj_knife', groundSprite: 'pickup_knives',
    },
    value: 26, minDepth: 2, weight: 1.6,
  },
  {
    id: 'throwing_axes', name: 'Throwing Axes', slot: 'thrown', icon: 'ic_throwing_axes', weaponClass: 'thrown', damageType: 'slash',
    base: { attack: 12 }, perTier: { attack: 2.8 }, primary: ['metal', 'wood'],
    thrown: {
      stock: 4, stockPerTier: 0.5, windup: 0.24, recovery: 0.14, staminaCost: 15,
      speed: 7, range: 5, power: 1.42, sprite: 'proj_axe_thrown', groundSprite: 'pickup_axes',
    },
    value: 58, minDepth: 3, weight: 0.9,
  },
  {
    id: 'javelins', name: 'Javelins', slot: 'thrown', icon: 'ic_javelins', weaponClass: 'thrown', damageType: 'pierce',
    base: { attack: 17 }, perTier: { attack: 2.9 }, primary: ['metal'],
    thrown: {
      stock: 2, stockPerTier: 0.5, windup: 0.32, recovery: 0.18, staminaCost: 19,
      speed: 8, range: 7, power: 1.54, sprite: 'proj_javelin', groundSprite: 'pickup_javelins',
    },
    value: 88, minDepth: 4, weight: 0.5,
  },

  // --- Off-hand -----------------------------------------------------------
  {
    id: 'buckler', name: 'Buckler', slot: 'offhand', icon: 'ic_buckler',
    viewmodel: 'vm_shield',
    base: { defense: 1, block: 35 }, perTier: { defense: 1, block: 5 }, primary: ['metal', 'wood'],
    value: 18, minDepth: 1, weight: 3,
  },
  {
    id: 'kite_shield', name: 'Kite Shield', slot: 'offhand', icon: 'ic_kite_shield',
    viewmodel: 'vm_kite_shield',
    base: { defense: 4, block: 55 }, perTier: { defense: 1.5, block: 5 }, primary: ['wood', 'metal'],
    value: 38, minDepth: 2, weight: 1.7,
  },
  {
    id: 'tower_shield', name: 'Tower Shield', slot: 'offhand', icon: 'ic_tower_shield',
    viewmodel: 'vm_tower_shield',
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
    id: 'greater_healing', name: 'Greater Healing', icon: 'ic_potion_greater', ramp: ['#3a0428', '#7a0c5a', '#d0209a', '#ffa0e0'],
    description: 'Restores 55% of your health.', effect: { type: 'heal', fraction: 0.55 },
    rarity: Rarity.Rare, value: 70, stack: 5,
  },
  {
    id: 'stamina_tonic', name: 'Stamina Tonic', icon: 'ic_tonic', ramp: ['#0c3a10', '#1a7020', '#40b030', '#b0ff80'],
    description: 'Refills your stamina at once.', effect: { type: 'stamina', fraction: 1 },
    rarity: Rarity.Common, value: 16, stack: 5,
  },
  {
    id: 'scroll_identify', name: 'Scroll of Identify', icon: 'ic_scroll_identify', ramp: ['#4a3a20', '#8a7040', '#c8a868', '#f4e4b0'],
    description: 'Reveals the true nature of one item.', effect: { type: 'identify' },
    rarity: Rarity.Uncommon, value: 30, stack: 10,
  },
  {
    // Blinding true light in a tube: expensive, because answering every
    // wind-up for the price of an Identify would make telegraphs decorative.
    id: 'scroll_flash', name: 'Flash Scroll', icon: 'ic_scroll_flash', ramp: ['#5a2a04', '#b05a08', '#f0a020', '#fff080'],
    description: 'A blinding flash at whatever faces you. Blind 2s, 3s with the swing cancelled mid-wind-up. It burns whether it lands or not.',
    effect: { type: 'flash' }, rarity: Rarity.Rare, value: 210, stack: 5,
  },
  {
    // A short step back along your own path: the escape half of torn Recall,
    // priced so it is a decision rather than a habit.
    id: 'scroll_backstep', name: 'Backstep Scroll', icon: 'ic_scroll_backstep', ramp: ['#2a3a5a', '#5a7ab0', '#9ac0ff', '#e0f0ff'],
    description: 'Snaps you back to where you stood 2 seconds ago. Torn while standing still, it burns and comes to nothing.',
    effect: { type: 'backstep' }, rarity: Rarity.Rare, value: 160, stack: 5,
  },
  {
    // A legendary flask infusion, found only in the dark: never stocked by any
    // merchant and not craftable. Installed at the forge, never drunk.
    id: 'fight_milk', name: 'Fight Milk', icon: 'ic_milk', ramp: ['#2a2410', '#6a6030', '#c8c088', '#f8f4d8'],
    description: "Infused at the forge, it lasts the delve. You come back quicker and you have less to come back with.",
    effect: { type: 'tonic', tonicId: 'fight_milk' },
    rarity: Rarity.Legendary, value: 420, stack: 2,
  },
  {
    id: 'scroll_recall', name: 'Scroll of Recall', icon: 'ic_scroll_recall', ramp: ['#1a2a4a', '#34508a', '#6a90d0', '#d0e4ff'],
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
  // A short sword and long sword share a class but have different silhouettes.
  // Prefer the base override; accept a bare class for callers without a base.
  if (base && typeof base === 'object') {
    if (base.viewmodel) return base.viewmodel;
    return viewmodelFor(base.weaponClass);
  }
  switch (base) {
    case 'dagger': return 'vm_dagger';
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

export function findItemBase(id: string): ItemBaseDef | undefined {
  return BASE_BY_ID.get(id);
}

export function consumable(id: string): ConsumableDef {
  const c = CONS_BY_ID.get(id);
  if (!c) throw new Error(`unknown consumable ${id}`);
  return c;
}

export function findConsumable(id: string): ConsumableDef | undefined {
  return CONS_BY_ID.get(id);
}

/** Unarmed swing when no weapon is equipped. */
export const FIST_SWING: SwingProfile = { windup: 0.14, recovery: 0.3, staminaCost: 9, reach: 1 };
export const FIST_ATTACK = 3;
