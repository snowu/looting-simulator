import { GameState } from './game-state';
import { parseSave, serializeSave } from './save-format';

const SAVE_KEY = 'looting-simulator-save-v2';

/**
 * The local store: synchronous, authoritative during play, and never waiting on
 * a network. Cloud sync layers on top of this rather than replacing it, so a
 * signed-out or offline player sees exactly the behaviour they always had.
 */

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, serializeSave(state));
  } catch {
    // Storage full or blocked: the game keeps running, it just won't persist.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return parseSave(raw);
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
