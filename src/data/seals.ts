/**
 * Ashen Seals: the mastery layer, after the Ashen King.
 *
 * Hard stays the authored game. Once you have killed the King, you can put
 * Seals on your delves: each a known, stated complication, stackable, each
 * paying more renown and loot for the delve it is on. The highest number of
 * Seals you have killed the King under is kept as a record.
 *
 * A Seal is a named modifier over the delve's difficulty snapshot — the knobs
 * in `src/data/difficulty.ts` — or over a floor's generation, so they compose
 * with each other and with any difficulty.
 */
import type { DifficultyDef } from './difficulty';

export type SealId = 'teeth' | 'multitudes' | 'champions' | 'dry_well' | 'lightless';

export interface SealDef {
  id: SealId;
  name: string;
  rule: string;
}

export const SEALS: Record<SealId, SealDef> = {
  teeth: { id: 'teeth', name: 'Seal of Teeth', rule: 'Monsters hit 20% harder.' },
  multitudes: { id: 'multitudes', name: 'Seal of Multitudes', rule: '30% more monsters on every floor.' },
  champions: { id: 'champions', name: 'Seal of Champions', rule: 'Elites are 15 points likelier on every floor, from the first.' },
  dry_well: { id: 'dry_well', name: 'Seal of the Dry Well', rule: 'The flask starts the delve 2 charges short (never below 1).' },
  lightless: { id: 'lightless', name: 'Seal of the Lightless', rule: 'Your light reaches 3 units less.' },
};

export const SEAL_IDS = Object.keys(SEALS) as SealId[];

export const TEETH_DAMAGE = 1.2;
export const MULTITUDES_COUNT = 1.3;
export const CHAMPIONS_ELITE = 0.15;
export const DRY_WELL_CHARGES = 2;
export const LIGHTLESS_LIGHT = 3;
/** Per Seal on a delve: extra renown (as a share) and loot find. */
export const SEAL_RENOWN = 0.25;
export const SEAL_FIND = 15;

export function validSeals(ids: string[] | undefined | null): SealId[] {
  return (ids ?? []).filter((id): id is SealId => id in SEALS);
}

/**
 * The delve's difficulty with its Seals applied. Returns the base itself when
 * there are none. The loot-find bonus is not a knob here: loot rolls take the
 * base difficulty by id, so the world adds `SEAL_FIND` to the find it passes.
 */
export function sealDifficulty(base: DifficultyDef, seals: string[] | undefined): DifficultyDef {
  const s = validSeals(seals);
  if (!s.length) return base;
  return {
    ...base,
    enemyDamage: base.enemyDamage * (s.includes('teeth') ? TEETH_DAMAGE : 1),
  };
}

/** What Seals change about generating a floor. */
export interface FloorMods {
  enemyCount?: number;
  eliteBonus?: number;
}

export function sealFloorMods(seals: string[] | undefined): FloorMods | undefined {
  const s = validSeals(seals);
  if (!s.length) return undefined;
  return {
    enemyCount: s.includes('multitudes') ? MULTITUDES_COUNT : 1,
    eliteBonus: s.includes('champions') ? CHAMPIONS_ELITE : 0,
  };
}
