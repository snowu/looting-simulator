import { DamageType, EquipSlot, EQUIP_SLOTS, Item, Stats, SwingProfile, WeaponClass, addStats, emptyStats } from '../types';
import { FIST_ATTACK, FIST_SWING, itemBase } from '../data/items';
import { itemStats } from './items';
import { MetaLevels, metaLevel } from './meta';

export type Equipment = Record<EquipSlot, Item | null>;

export function emptyEquipment(): Equipment {
  const e = {} as Equipment;
  for (const s of EQUIP_SLOTS) e[s] = null;
  return e;
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
}

export const BASE_HP = 70;
export const BASE_STAMINA = 100;

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
    },
    // Parrying with a weapon still takes the edge off; shields do the real work.
    block: hasShield ? Math.min(0.9, stats.block / 100) : weapon ? 0.3 : 0.12,
    hasShield,
    find: stats.find + 12 * metaLevel(meta, 'treasure_sense'),
  };
}
