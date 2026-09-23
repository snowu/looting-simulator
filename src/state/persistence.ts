import { GameState } from './game-state';
import { parseSave, sanitizeSaveName, serializeSave } from './save-format';
import { carryAgreementThroughMigration } from '../cloud/sync-meta';

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

/**
 * Scratch mode: nothing may be written to a slot at all.
 *
 * The dev boss arena runs on a throwaway game holding endgame gear and maxed
 * renown, and it must never land in a real playthrough. That guard lived at the
 * call sites first and was bypassed within the hour — `beforeunload` wrote
 * directly and skipped it, so navigating away from the arena silently ate the
 * save. There is exactly one door to disk, so the lock belongs on the door.
 */
let scratch = false;

export function setScratchMode(on: boolean): void {
  scratch = on;
}

export function isScratchMode(): boolean {
  return scratch;
}

export function saveGame(state: GameState, slot: Slot): void {
  if (scratch) return;
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
    const state = parseSave(raw);
    if (state) carryAgreementThroughMigration(raw, state);
    return state;
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

/**
 * Give the save in a slot a player-visible name. Returns the renamed state,
 * or null when the slot holds nothing — there is nothing to name then.
 */
export function renameSave(slot: Slot, name: string): GameState | null {
  const existing = loadGame(slot);
  if (!existing) return null;
  existing.name = sanitizeSaveName(name);
  saveGame(existing, slot);
  return existing;
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
