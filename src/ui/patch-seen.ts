import { PATCHES, type Patch } from '../data/patches';

/**
 * The newest patch number this browser has shown the player. Patch numbers
 * are what players read (and they only move on gameplay changes), so this is
 * the "version" we remember, not the build id, which changes on every commit.
 * Per-browser and never synced, like the other UI preferences; losing it only
 * means the next patch notes are announced again.
 */
const KEY = 'looting-simulator-last-seen-patch';

/** The stored patch number, or null when this browser has never recorded one. */
export function readLastSeenPatch(): number | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function writeLastSeenPatch(n: number): void {
  try {
    localStorage.setItem(KEY, String(n));
  } catch {
    // Storage blocked: the notice shows again next visit, which is the safe failure.
  }
}

/**
 * Patches the player has not seen yet. With no record (a first visit, or
 * storage cleared) nothing is new: announcing all of history would be noise.
 * Pure, tested.
 */
export function unseenPatches(patches: Patch[], lastSeen: number | null): Patch[] {
  if (lastSeen === null) return [];
  return patches.filter((p) => p.n > lastSeen);
}

/** The newest patch number in the list, whatever order it is in. */
export function newestPatchNumber(patches: Patch[]): number {
  return patches.reduce((max, p) => Math.max(max, p.n), 0);
}

// Captured once per page load. The title-screen notice and the overlay's
// "New" highlights both read this snapshot, so opening the notes (which
// records them as seen) does not wipe the highlights for the rest of the session.
const lastSeenAtLoad = readLastSeenPatch();
if (lastSeenAtLoad === null) writeLastSeenPatch(newestPatchNumber(PATCHES));

/** Patches added since the player last opened the game (fixed for this page load). */
export function newSinceLastVisit(): Patch[] {
  return unseenPatches(PATCHES, lastSeenAtLoad);
}

/** Patches not yet opened in the notes, read live, so the title button clears once they are. */
export function unreadPatchCount(): number {
  return unseenPatches(PATCHES, readLastSeenPatch()).length;
}

/** Record that the player has now seen every current patch. */
export function markPatchesSeen(): void {
  writeLastSeenPatch(newestPatchNumber(PATCHES));
}
