import { GameState } from './game-state';
import { parseSave, serializeSave } from './save-format';

/**
 * The local store: synchronous, authoritative during play, and never waiting on
 * a network. Cloud sync layers on top of this rather than replacing it, so a
 * signed-out or offline player sees exactly the behaviour they always had.
 */

/** Three independent playthroughs. Slots are separate games, not a history. */
export type Slot = 1 | 2 | 3;
export const SLOTS: readonly Slot[] = [1, 2, 3];

const LAST_SLOT_KEY = 'looting-simulator-slot';

/**
 * Slot 1 deliberately keeps the key saves were written under before slots
 * existed. Anyone who has been playing already finds their game in slot 1,
 * exactly where it was, without a migration touching it.
 */
function keyFor(slot: Slot): string {
  return slot === 1 ? 'looting-simulator-save-v2' : `looting-simulator-save-v2-s${slot}`;
}

export function saveGame(state: GameState, slot: Slot): void {
  try {
    localStorage.setItem(keyFor(slot), serializeSave(state));
  } catch {
    // Storage full or blocked: the game keeps running, it just won't persist.
  }
}

export function loadGame(slot: Slot): GameState | null {
  try {
    const raw = localStorage.getItem(keyFor(slot));
    if (!raw) return null;
    return parseSave(raw);
  } catch {
    return null;
  }
}

export function clearSave(slot: Slot): void {
  try {
    localStorage.removeItem(keyFor(slot));
  } catch {
    // ignore
  }
}

/** Which slot the player was last in, so the title can lead with it. */
export function lastSlot(): Slot {
  try {
    const n = Number(localStorage.getItem(LAST_SLOT_KEY));
    if (n === 1 || n === 2 || n === 3) return n;
  } catch {
    // ignore
  }
  return 1;
}

export function setLastSlot(slot: Slot): void {
  try {
    localStorage.setItem(LAST_SLOT_KEY, String(slot));
  } catch {
    // ignore
  }
}
