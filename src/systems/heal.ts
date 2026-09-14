import { EQUIP_SLOTS, Item } from '../types';
import { Equipment } from './player';
import { itemValue } from './items';

/** Worn gear value, the "gear level" axis of the physicker's price. */
export function wornGearValue(equipment: Equipment): number {
  let total = 0;
  for (const slot of EQUIP_SLOTS) {
    const it: Item | null = equipment[slot];
    if (it) total += itemValue(it);
  }
  return total;
}

export interface HealQuote {
  /** Gear score fed into the price: worn value / 10. */
  gearScore: number;
  maxHp: number;
  missing: number;
  cursed: boolean;
  depth: number;
  cost: number;
}

/**
 * The Bleakmere physicker's price for a full mend in town.
 *
 * Scales on all three requested axes: max health, gear level and curse —
 * plus depth, so a late delve pays late prices:
 *
 *   cost = ceil((8 + maxHp * 0.9 + gearScore * 0.5) * curseMult * depthMult)
 *
 * where gearScore = worn itemValue / 10, curseMult = 1.5 when cursed,
 * depthMult = 1 + 0.08 * (depth - 1). Indicative: early (70 HP, ~150 worn
 * value, D1) ≈ 79g; late (135 HP, ~6000 worn value, D6) ≈ 602g, ~903g
 * cursed. Deliberately steep at the top: healing every run should compete
 * with gear and potions, not be automatic. Curses persist through the
 * mend — fonts keep their job.
 */
export function healCostFor(args: { maxHp: number; gearValue: number; cursed: boolean; depth: number }): number {
  const gearScore = Math.max(0, args.gearValue) / 10;
  const base = 8 + args.maxHp * 0.9 + gearScore * 0.5;
  const curseMult = args.cursed ? 1.5 : 1.0;
  const depthMult = 1 + 0.08 * (Math.max(1, args.depth) - 1);
  return Math.max(1, Math.ceil(base * curseMult * depthMult));
}

export function quoteHeal(args: {
  equipment: Equipment;
  maxHp: number;
  hp: number;
  cursed: boolean;
  depth: number;
}): HealQuote {
  const gearValue = wornGearValue(args.equipment);
  return {
    gearScore: gearValue / 10,
    maxHp: args.maxHp,
    missing: Math.max(0, args.maxHp - args.hp),
    cursed: args.cursed,
    depth: args.depth,
    cost: healCostFor({ maxHp: args.maxHp, gearValue, cursed: args.cursed, depth: args.depth }),
  };
}
