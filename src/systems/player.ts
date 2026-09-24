import { DamageType, DEFAULT_CRIT_MULT, EquipSlot, EQUIP_SLOTS, Item, Stats, SwingProfile, ThrownProfile, WeaponClass, addStats, emptyStats, slotOf } from '../types';
import { findProperty } from '../data/properties';
import { FIST_ATTACK, FIST_SWING, itemBase } from '../data/items';
import { DifficultyId, difficultyOf } from '../data/difficulty';
import { isTwoHanded, itemStats, thrownCapacity, thrownProfile, uniqueOf } from './items';
import { MetaLevels, metaLevel } from './meta';
import { clamp } from '../core/math';

export type Equipment = Record<EquipSlot, Item | null>;

export function emptyEquipment(): Equipment {
  const e = {} as Equipment;
  for (const s of EQUIP_SLOTS) e[s] = null;
  return e;
}

/**
 * What the bespoke legendaries you are wearing add up to.
 *
 * Resolved once here rather than read item by item at the point of use, so the
 * world sim asks one cheap question per swing instead of walking eight slots.
 * Every field is stated as a neutral value (1 for a multiplier, 0 for a bonus)
 * so the systems downstream can apply it unconditionally.
 */
export interface UniqueTraits {
  /** Damage added per parry stack, and how many stacks can be held. */
  parryFeed: number;
  parryFeedMax: number;
  /** Fraction of a parried melee blow dealt back at the attacker. */
  parryReflect: number;
  /** Damage multiplier against the undead. */
  undeadBane: number;
  /** Extra world units of carried light. */
  light: number;
  /** Multiplier on every source of healing. */
  healing: number;
  /** Extra tiles of floor read for traps. */
  trapSense: number;
  /** Multiplier on stamina regeneration. */
  staminaRegen: number;
  /** Tiles of sight the floor loses on you. */
  unseen: number;
  /**
   * The Big Toe: the chance a kill leaves a second morsel. The toe knows where
   * the meat is.
   */
  butcher: number;
  /**
   * The Prize Bull's Horn: Attack added per consecutive blow landed without
   * being hit, and the ceiling on it. A charge weapon for a charging animal.
   */
  charge: number;
  chargeMax: number;
  /**
   * The Impresario's Cane: a multiplier on everything you do — swing, recovery,
   * step and flask. Under 1 means faster, because these are durations.
   */
  haste: number;
  /** Inscribed build properties in effect. See `src/data/properties.ts`. */
  riposte: boolean;
  execution: boolean;
  kindling: boolean;
  bulwark: boolean;
  retrieval: boolean;
  lastFlask: boolean;
}

export function emptyTraits(): UniqueTraits {
  return {
    parryFeed: 0,
    parryFeedMax: 0,
    parryReflect: 0,
    undeadBane: 1,
    light: 0,
    healing: 1,
    trapSense: 0,
    staminaRegen: 1,
    unseen: 0,
    butcher: 0,
    charge: 0,
    chargeMax: 0,
    haste: 1,
    riposte: false,
    execution: false,
    kindling: false,
    bulwark: false,
    retrieval: false,
    lastFlask: false,
  };
}

/**
 * An inscribed property counts only on identified gear worn in a slot it was
 * made for; `inscribe` enforces the slot, and this rechecks it so a save edited
 * by hand cannot put Riposte on a helmet.
 */
function applyProperty(t: UniqueTraits, item: Item | null | undefined, slot: EquipSlot): void {
  const def = findProperty(item?.property);
  if (!def || !item || item.identified === false || !def.slots.includes(slotOf(slot))) return;
  switch (def.id) {
    case 'riposte': t.riposte = true; break;
    case 'execution': t.execution = true; break;
    case 'kindling': t.kindling = true; break;
    case 'bulwark': t.bulwark = true; break;
    case 'retrieval': t.retrieval = true; break;
    case 'last_flask': t.lastFlask = true; break;
  }
}

/** How many parry stacks a blade that feeds on them can hold. */
const PARRY_FEED_STACKS = 3;

/** How far a charge can build before it stops paying. */
export const CHARGE_STACKS = 6;

function traitsOf(eq: Equipment, twoHanded = false): UniqueTraits {
  const t = emptyTraits();
  for (const slot of EQUIP_SLOTS) {
    if (twoHanded && slot === 'offhand') continue;
    applyProperty(t, eq[slot], slot);
    const u = uniqueOf(eq[slot]);
    // An unidentified unique is a lump of metal like any other: you do not get
    // the effect until you know what you are holding.
    if (!u || eq[slot]?.identified === false) continue;
    switch (u.effect) {
      case 'parry_feed':
        t.parryFeed = u.power;
        t.parryFeedMax = PARRY_FEED_STACKS;
        break;
      case 'parry_reflect':
        t.parryReflect = u.power;
        break;
      case 'undead_bane':
        t.undeadBane *= u.power;
        break;
      case 'lantern':
        t.light += u.power;
        break;
      case 'half_healing':
        t.healing *= u.power;
        break;
      case 'trap_sense':
        t.trapSense += u.power;
        break;
      case 'swift_stamina':
        t.staminaRegen *= u.power;
        break;
      case 'unseen':
        t.unseen += u.power;
        break;
      case 'butcher':
        t.butcher += u.power;
        break;
      case 'charge':
        t.charge = u.power;
        t.chargeMax = CHARGE_STACKS;
        break;
      case 'haste':
        t.haste *= u.power;
        break;
      // never_dulls is a property of the item, handled in maxDurability.
      case 'never_dulls':
        break;
    }
  }
  return t;
}

export interface PlayerDerived {
  stats: Stats;
  maxHp: number;
  maxStamina: number;
  attack: number;
  damageType: DamageType;
  weaponClass: WeaponClass | null;
  swing: SwingProfile;
  /** Fraction of damage absorbed when blocking. */
  block: number;
  hasShield: boolean;
  /** Both hands are on the weapon, so the offhand contributes nothing. */
  twoHanded: boolean;
  /** Set when the equipped weapon is thrown rather than swung. */
  thrown: ThrownProfile | null;
  /** A full stock for that thrown weapon, or 0 when nothing is belted. */
  thrownCapacity: number;
  /**
   * What a throw hits for, before {@link ThrownProfile.power}. Read off the
   * belted shafts alone — your sword never makes your knives hit harder, and a
   * good set of knives never makes your sword hit harder.
   */
  thrownAttack: number;
  /** The shafts' own damage type, which need not match the weapon's. */
  thrownDamageType: DamageType;
  find: number;
  traits: UniqueTraits;
}

export const BASE_HP = 70;

export const BASE_STAMINA = 100;
/**
 * Loot find per level of Treasure Sense. Raised from 12 with the balance pass:
 * find multiplies drop *chances*, and those were cut by more than half, so
 * +36% of a much smaller number measured as very close to nothing. Scarcer
 * loot should make finding more of it matter more, not less.
 */
const FIND_PER_TREASURE_SENSE = 20;

/**
 * You, as a thrown shaft scores you.
 *
 * Attack and damage type come off the belt; everything else — Crit, leech,
 * elemental damage — is still the player, because those are things about you
 * rather than about the weapon. One helper rather than two copies: the world
 * snapshots this at throw time and the balance harness reads it directly, and a
 * throw measured differently from the throw that happens is worse than not
 * measuring it.
 */
export function thrownView(d: PlayerDerived): PlayerDerived {
  return { ...d, attack: d.thrownAttack, damageType: d.thrownDamageType };
}

export function derivePlayer(eq: Equipment, meta: MetaLevels, difficulty?: DifficultyId): PlayerDerived {
  // A two-hander keeps the offhand empty. `equipFrom` enforces that on the way
  // in, but it is not the only way an Equipment record gets built — the balance
  // harness and the boss arena assign the fields directly — so the rule is
  // applied here as well. Without it those two would quietly measure a maul
  // *and* a tower shield, and every number they print would be a build the game
  // cannot produce.
  const twoHanded = isTwoHanded(eq.weapon);
  const stats = emptyStats();
  for (const slot of EQUIP_SLOTS) {
    if (twoHanded && slot === 'offhand') continue;
    // The belt of shafts is ammunition, not gear. Its Attack is what a throw
    // is worth and is read separately below; letting it into `stats` would
    // make it a ninth gear slot and hand every build free Attack for wearing
    // three knives it never has to throw.
    if (slot === 'thrown') continue;
    const it = eq[slot];
    if (it) addStats(stats, itemStats(it));
  }
  const weapon = eq.weapon ? itemBase(eq.weapon.ref) : null;
  const traits = traitsOf(eq, twoHanded);
  // The Cane folds straight into the speed factor rather than being a second
  // multiplier hung off the swing: one number decides how fast you are, and
  // everything that reads it — the sim, the harness, the tooltip — agrees.
  const speedFactor = Math.max(0.5, (1 + stats.speed / 100) / traits.haste);
  const baseSwing = weapon?.swing ?? FIST_SWING;
  const hasShield = !twoHanded && !!eq.offhand;
  // Difficulty pads the health bar on Normal; Hard multiplies by exactly 1, so
  // the old number survives the round trip unchanged.
  const diff = difficultyOf(difficulty);
  const maxHp = Math.max(10, Math.round((BASE_HP + stats.health + 12 * metaLevel(meta, 'toughness')) * diff.playerHp));
  return {
    stats,
    maxHp,
    maxStamina: Math.max(30, BASE_STAMINA + stats.stamina + 15 * metaLevel(meta, 'endurance')),
    attack: weapon ? Math.max(1, stats.attack) : FIST_ATTACK + stats.attack,
    damageType: weapon?.damageType ?? 'blunt',
    weaponClass: weapon?.weaponClass ?? null,
    swing: {
      windup: baseSwing.windup / speedFactor,
      recovery: baseSwing.recovery / speedFactor,
      staminaCost: baseSwing.staminaCost,
      reach: baseSwing.reach,
      cleave: baseSwing.cleave,
      stagger: baseSwing.stagger,
      chips: baseSwing.chips,
      critMult: baseSwing.critMult ?? DEFAULT_CRIT_MULT,
    },
    // Parrying with a weapon still takes the edge off; shields do the real work.
    // Clamped at zero: a relic that spends Block can drive the stat negative,
    // and a negative absorption would turn raising your guard into taking more.
    // Normal adds its bonus before the shield cap, so it can never lift a guard past 90%.
    block: clamp((hasShield ? stats.block / 100 : twoHanded ? 0.2 : weapon ? 0.3 : 0.12) + diff.blockBonus, 0, 0.9),
    hasShield,
    twoHanded,
    thrown: thrownProfile(eq.thrown),
    thrownCapacity: thrownCapacity(eq.thrown),
    thrownAttack: eq.thrown ? Math.max(1, itemStats(eq.thrown).attack) : 0,
    thrownDamageType: (eq.thrown ? itemBase(eq.thrown.ref).damageType : undefined) ?? 'pierce',
    find: stats.find + FIND_PER_TREASURE_SENSE * metaLevel(meta, 'treasure_sense'),
    traits,
  };
}
