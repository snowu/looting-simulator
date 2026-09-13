import { DamageType, DEFAULT_CRIT_MULT, EquipSlot, EQUIP_SLOTS, Item, Stats, SwingProfile, WeaponClass, addStats, emptyStats } from '../types';
import { FIST_ATTACK, FIST_SWING, itemBase } from '../data/items';
import { itemStats, uniqueOf } from './items';
import { MetaLevels, metaLevel } from './meta';

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
  };
}

/** How many parry stacks a blade that feeds on them can hold. */
const PARRY_FEED_STACKS = 3;

function traitsOf(eq: Equipment): UniqueTraits {
  const t = emptyTraits();
  for (const slot of EQUIP_SLOTS) {
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

export function derivePlayer(eq: Equipment, meta: MetaLevels): PlayerDerived {
  const stats = emptyStats();
  for (const slot of EQUIP_SLOTS) {
    const it = eq[slot];
    if (it) addStats(stats, itemStats(it));
  }
  const weapon = eq.weapon ? itemBase(eq.weapon.ref) : null;
  const speedFactor = Math.max(0.5, 1 + stats.speed / 100);
  const baseSwing = weapon?.swing ?? FIST_SWING;
  const hasShield = !!eq.offhand;
  return {
    stats,
    maxHp: Math.max(10, BASE_HP + stats.health + 12 * metaLevel(meta, 'toughness')),
    maxStamina: Math.max(30, BASE_STAMINA + stats.stamina + 15 * metaLevel(meta, 'endurance')),
    attack: weapon ? Math.max(1, stats.attack) : FIST_ATTACK + stats.attack,
    damageType: weapon?.damageType ?? 'blunt',
    weaponClass: weapon?.weaponClass ?? null,
    swing: {
      windup: baseSwing.windup / speedFactor,
      recovery: baseSwing.recovery / speedFactor,
      staminaCost: baseSwing.staminaCost,
      reach: baseSwing.reach,
      critMult: baseSwing.critMult ?? DEFAULT_CRIT_MULT,
    },
    // Parrying with a weapon still takes the edge off; shields do the real work.
    // Clamped at zero: a relic that spends Block can drive the stat negative,
    // and a negative absorption would turn raising your guard into taking more.
    block: hasShield ? Math.max(0, Math.min(0.9, stats.block / 100)) : weapon ? 0.3 : 0.12,
    hasShield,
    find: stats.find + FIND_PER_TREASURE_SENSE * metaLevel(meta, 'treasure_sense'),
    traits: traitsOf(eq),
  };
}
