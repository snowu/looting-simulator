/**
 * Dev-only: stand in a room with a firing squad, without playing to find one.
 *
 * Reached with `?autostart=archers`. Same contract as `./boss-arena`: behind
 * an `import.meta.env.DEV` guard at its one call site in `main.ts`, so the
 * dynamic import is dropped and none of this reaches a production bundle.
 *
 * Five archers, mixed elements, already aware of you and inside bow range —
 * hold block (Shift / right mouse) and time the raise to parry the volley.
 */
import { GameState } from '../state/game-state';
import { World } from '../world/world';
import { dropSquad, prepareScratch } from './squad-room';

/** One of each arrow in the quiver: physical pair plus fire, frost, gloom. */
const ARCHERS = ['goblin_archer', 'skeleton_archer', 'cinder_raider', 'elemental_frost', 'elemental_shadow'];

/** Kit the character out and fill the pack, before the run starts. */
export function prepare(state: GameState): void {
  prepareScratch(state);
}

/**
 * Clear the biggest ordinary room on this floor and line five archers up in
 * it, facing the player from bow range. Returns the description for the log.
 */
export function dropIntoArcherRoom(world: World): string {
  return dropSquad(world, {
    ids: ARCHERS,
    label: 'archers',
    idPrefix: 'archer',
    stand: 'corner',
    spacing: 'ranged',
    prime: 'alert',
  });
}
