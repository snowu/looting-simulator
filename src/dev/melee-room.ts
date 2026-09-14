/**
 * Dev-only: stand in a room with a pile-on, without playing to find one.
 *
 * Reached with `?autostart=melee`. Same contract as `./boss-arena`: behind
 * an `import.meta.env.DEV` guard at its one call site in `main.ts`, so the
 * dynamic import is dropped and none of this reaches a production bundle.
 *
 * Five brutes crowding you, already mid-swing so the whole pile lands inside
 * one parry window — hold block (Shift / right mouse) as they come in and
 * watch the parry stagger the pack, not just the one you caught.
 */
import { GameState } from '../state/game-state';
import { World } from '../world/world';
import { dropSquad, prepareScratch } from './squad-room';

/** Shallow-floor teeth: all honest melee, all happy to dogpile. */
const BRUTES = ['skeleton', 'goblin', 'rat', 'spider', 'bat'];

/** Kit the character out and fill the pack, before the run starts. */
export function prepare(state: GameState): void {
  prepareScratch(state);
}

/**
 * Clear the biggest ordinary room on this floor and crowd five brutes around
 * the player, already mid-swing. Returns the description for the log.
 */
export function dropIntoMeleeRoom(world: World): string {
  return dropSquad(world, {
    ids: BRUTES,
    label: 'brutes',
    idPrefix: 'brute',
    stand: 'center',
    spacing: 'near',
    prime: 'windup',
  });
}
