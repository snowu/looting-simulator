export const BASE_FLASK_CHARGES = 3;
export const MAX_FLASK_SHARDS = 3;
export const FLASK_POTENCY = [0.3, 0.35, 0.4, 0.45, 0.5] as const;
export const FLASK_UPGRADE_COSTS = [250, 700, 1600, 3200] as const;
export const SIP_SECONDS = 0.5;
export const CHEW_SECONDS = 1.2;
export const MORSEL_ROT_SECONDS = 240;
export const DREGS_FRACTION = 0.5;

export const MORSEL_HEAL = {
  scrap: 0.1,
  cut: 0.125,
  heart: 0.15,
} as const;

export function flaskMax(shards: number): number {
  return BASE_FLASK_CHARGES + Math.max(0, Math.min(MAX_FLASK_SHARDS, Math.trunc(shards)));
}

export function morselChance(depth: number): number {
  return Math.max(0, 0.35 - 0.026 * (Math.max(1, depth) - 1));
}
