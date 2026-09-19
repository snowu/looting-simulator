import { GameState } from '../state/game-state';
import { BOSS_ID } from '../data/enemies';
import { SealId, validSeals } from '../data/seals';
import { bestiaryEntry } from './bestiary';

/**
 * Seals open once the Ashen King has fallen to this playthrough, read from the
 * bestiary's kill count so a hero who beat him before Seals existed has them
 * already.
 */
export function sealsUnlocked(state: GameState): boolean {
  return bestiaryEntry(state.bestiary, BOSS_ID).kills > 0;
}

/** Toggle a Seal for the next delve. Only in town between delves, and only once unlocked. */
export function toggleSeal(state: GameState, id: SealId): boolean {
  if (state.run || !sealsUnlocked(state)) return false;
  const set = new Set(validSeals(state.pendingSeals));
  if (set.has(id)) set.delete(id);
  else set.add(id);
  state.pendingSeals = [...set];
  return true;
}
