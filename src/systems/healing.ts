import { clamp } from '../core/math';
export const BASE_FLASK_CHARGES = 3;
export const MAX_FLASK_SHARDS = 3;
export const FLASK_POTENCY = [0.3, 0.35, 0.4, 0.45, 0.5] as const;
export const FLASK_UPGRADE_COSTS = [250, 700, 1600, 3200] as const;
export const SIP_SECONDS = 0.5;
export const SIP_BUFFER_SECONDS = 0.35;
export const CHEW_SECONDS = 1.2;
export const MORSEL_ROT_SECONDS = 240;
export const DREGS_FRACTION = 0.5;

export const MORSEL_HEAL = {
  scrap: 0.1,
  cut: 0.125,
  heart: 0.15,
} as const;

/** The dish each tier is drawn as, bigger heal, bigger dish. */
export const MORSEL_ART = {
  scrap: { art: 'ic_gyoza', name: 'Gyoza', height: 0.4 },
  cut: { art: 'ic_pizza', name: 'Pizza slice', height: 0.45 },
  heart: { art: 'ic_drumstick', name: 'Chicken thigh', height: 0.5 },
} as const;

export function flaskMax(shards: number): number {
  return BASE_FLASK_CHARGES + clamp(Math.trunc(shards), 0, MAX_FLASK_SHARDS);
}

export function morselChance(depth: number): number {
  return Math.max(0, 0.28 - 0.024 * (Math.max(1, depth) - 1));
}
