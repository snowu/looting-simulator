export interface MetaUpgrade {
  id: string;
  name: string;
  description: string;
  /** Renown cost of each level, in order. */
  costs: number[];
}

export const META_UPGRADES: MetaUpgrade[] = [
  { id: 'pack_mule', name: 'Pack Mule', description: '+4 backpack slots per level.', costs: [4, 8, 14] },
  { id: 'toughness', name: 'Toughness', description: '+12 max health per level.', costs: [3, 6, 10, 15, 22] },
  { id: 'endurance', name: 'Second Wind', description: '+15 max stamina per level.', costs: [3, 7, 12] },
  { id: 'soul_pouch', name: 'Soul Pouch', description: 'On death, keep 3 backpack slots and 20% of carried gold per level.', costs: [5, 10, 16] },
  { id: 'haggler', name: 'Silver Tongue', description: 'Merchants pay 4% more and charge 4% less per level.', costs: [4, 8, 13, 20] },
  { id: 'insider', name: 'Market Insider', description: 'L1: price history and trends. L2: hear rumours of tomorrow\'s market event.', costs: [5, 12] },
  { id: 'master_smith', name: 'Master Smith', description: '+6% crafted quality per level. L3: crafted gear rolls an extra affix.', costs: [4, 9, 15] },
  { id: 'appraiser', name: 'Appraiser\'s Eye', description: 'L1: identifying costs 40% less. L2: Rare and lower drops come identified.', costs: [5, 12] },
  { id: 'treasure_sense', name: 'Treasure Sense', description: '+12% loot find per level.', costs: [5, 10, 16] },
  { id: 'supply_crate', name: 'Supply Crate', description: 'Start each run with +1 Healing Draught per level.', costs: [3, 6, 10] },
  { id: 'lantern', name: 'Lantern Wick', description: '+1 light radius per level, 9.5 to 12.5 at L3, against fog that starts at 4. L1 also reads the floor for traps 3 tiles ahead instead of 2.', costs: [3, 7, 12] },
];

export type MetaLevels = Record<string, number>;

export function metaLevel(levels: MetaLevels, id: string): number {
  return levels[id] ?? 0;
}

export function nextCost(u: MetaUpgrade, levels: MetaLevels): number | null {
  const lvl = metaLevel(levels, u.id);
  return lvl < u.costs.length ? u.costs[lvl] : null;
}

export const BASE_BACKPACK = 16;

/**
 * The light you carry, in world units of radius. Kept deliberately small per
 * level: darkness is the resource this whole game is built on, and a lantern
 * you can buy your way out of would flatten every floor below the Ossuary.
 * Three levels take you from 9.5 to 12.5 — about half a tile each.
 */
export const BASE_LIGHT_RADIUS = 9.5;
const LIGHT_PER_LEVEL = 1;

export function lightRadius(levels: MetaLevels): number {
  return BASE_LIGHT_RADIUS + LIGHT_PER_LEVEL * metaLevel(levels, 'lantern');
}

/** A touch more throw as well as reach, so the extra radius doesn't look washed out. */
export function lightIntensity(levels: MetaLevels): number {
  return 0.95 + 0.04 * metaLevel(levels, 'lantern');
}

export function backpackCapacity(levels: MetaLevels): number {
  return BASE_BACKPACK + 4 * metaLevel(levels, 'pack_mule');
}

export function haggleLevel(levels: MetaLevels): number {
  return metaLevel(levels, 'haggler');
}

/**
 * Renown awarded when a run ends.
 *
 * Nothing is paid for a delve that never left the entrance hall: you start on
 * floor 1's up-stairs, so a single step back into them used to bank 4 renown
 * for no risk at all, which made the whole upgrade tree farmable by tapping
 * forward and back. Renown is for going down.
 */
export function renownForRun(depthReached: number, extracted: boolean, bossKilled: boolean): number {
  if (!extracted) return Math.max(0, depthReached - 1);
  if (depthReached <= 1) return 0;
  return 2 + depthReached * 2 + (bossKilled ? 25 : 0);
}
