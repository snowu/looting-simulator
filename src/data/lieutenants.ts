/**
 * Floor lieutenants: one named monster whose presence changes its floor until
 * it dies. You notice something is wrong (the clue on arrival, and then the
 * floor itself), decide whether hunting it is worth it, and feel the floor
 * change when it falls. Its reward relates to the rule it imposed.
 *
 * At most one per floor, from depth 2 to 5, rolled on its own stream when the
 * floor is first generated in a delve.
 */

export type LieutenantId = 'quartermaster' | 'hoarder';

export interface LieutenantDef {
  id: LieutenantId;
  /** The enemy def it spawns as. */
  enemy: string;
  /** The clue in the log on arriving. */
  clue: string;
  color: string;
}

export const LIEUTENANTS: Record<LieutenantId, LieutenantDef> = {
  quartermaster: {
    id: 'quartermaster', enemy: 'goblin_quartermaster', color: '#e8c060',
    clue: 'The goblins here move in formation. Somewhere on this floor, someone is giving orders.',
  },
  hoarder: {
    id: 'hoarder', enemy: 'hoarder', color: '#e8c060',
    clue: 'Coin scrapes across stone somewhere on this floor. Leave nothing lying around.',
  },
};

/** The chance a floor from depth 2 to 5 has a lieutenant. */
export function lieutenantChance(depth: number): number {
  return depth < 2 || depth > 5 ? 0 : 0.4;
}
/** A floor needs this many goblins for a Quartermaster to command. */
export const QUARTERMASTER_MIN_GOBLINS = 2;
/** Goblins under a living Quartermaster hit this much harder, and never flee. */
export const RALLY_DAMAGE = 1.25;
/** When the Quartermaster dies, its goblins break and run for this long. */
export const ROUT_SECONDS = 5;
/** The Hoarder goes for loot within this many steps, and flees you inside this many. */
export const HOARDER_REACH = 18;
export const HOARDER_SHY = 3;
/** Lieutenants keep this many steps from the arrival stair. */
export const LIEUTENANT_MIN_DISTANCE = 10;

/** Goblins: every goblin kind, bar the Quartermaster itself. */
export function isGoblin(enemyId: string): boolean {
  return enemyId.startsWith('goblin') && enemyId !== 'goblin_quartermaster';
}
