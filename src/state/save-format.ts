import { GameState, SAVE_VERSION } from './game-state';
import { AFFIXES } from '../data/affixes';
import { BLESSINGS } from '../world/world';
import { SAVE_REVISION, migrateSave } from './migrations';

/**
 * The single path a save takes in or out of the game.
 *
 * Everything that reads a save written by something other than this running
 * tab — the browser store, a row synced from another device — comes through
 * `parseSave`, and everything that writes one goes out through
 * `serializeSave`. Cloud sync is a transport bolted onto these, never a second
 * set of rules: a snapshot arriving over the network gets exactly the format
 * checks and migrations a local one gets.
 */

const AFFIX_IDS = new Set(AFFIXES.map((a) => a.id));

/** Serialize for storage, stamping the revision this build is writing at. */
export function serializeSave(state: GameState): string {
  stampRevision(state);
  return canonicalJson(state);
}

/** Stable JSON for comparisons across stores such as Postgres jsonb. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(sortObjectKeys(value));
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (!value || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const sorted = sortObjectKeys((value as Record<string, unknown>)[key]);
    if (sorted !== undefined) out[key] = sorted;
  }
  return out;
}

/**
 * Record which revision last wrote this save.
 *
 * Stamping `SAVE_REVISION` unconditionally would let this build relabel a save
 * written by a newer one as its own. The unknown fields survive the round trip
 * regardless — JSON keeps what it does not understand — but the label is how
 * the newer build decides which migrations still have to run, and a save
 * quietly dated backwards gets them applied a second time. So a future save
 * keeps its own number: this build did not write it and should not claim to.
 */
export function stampRevision(state: GameState): void {
  const written = typeof state.revision === 'number' ? state.revision : 0;
  state.revision = Math.max(written, SAVE_REVISION);
}

/**
 * True when a newer build wrote this save. Such a save is still played and
 * still saved locally — refusing would cost the player the session in front of
 * them — but it must not be pushed to the cloud, where it would land under a
 * revision this build cannot honestly vouch for.
 */
export function isFutureSave(state: GameState): boolean {
  return (typeof state.revision === 'number' ? state.revision : 0) > SAVE_REVISION;
}

/**
 * Turn saved JSON into a usable state, or null if it is from an incompatible
 * format. Exported so the migration tests can run real old saves through it.
 */
export function parseSave(raw: string): GameState | null {
  // Drop affixes that no longer exist (e.g. the removed "of Mending").
  const parsed = JSON.parse(raw, (key, value) =>
    key === 'affixes' && Array.isArray(value) ? value.filter((a: { id?: string }) => a && AFFIX_IDS.has(a.id ?? '')) : value,
  ) as GameState;
  if (parsed.version !== SAVE_VERSION) return null;
  if (parsed.run?.blessing && !(parsed.run.blessing in BLESSINGS)) parsed.run.blessing = null;
  migrateSave(parsed);
  return parsed;
}

/**
 * FNV-1a over the serialized save, in two lanes for 64 bits of hex. It is only
 * ever compared for equality — it answers "would this upload change anything?"
 * — so it wants to be cheap and synchronous rather than cryptographic.
 */
export function contentHash(text: string): string {
  let a = 0x811c9dc5;
  let b = 0xcbf29ce4;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x85ebca6b);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

export interface SaveSummary {
  day: number;
  /** Where the save sits: in town, or partway down a delve. */
  place: string;
  gold: number;
  runs: number;
  /** The player-given name, or '' when the save is unnamed. */
  name: string;
  /** Town-side difficulty setting: 'Normal' or 'Hard'. */
  difficulty: string;
}

/** The longest name a save can carry. Short enough for a slot card. */
export const MAX_SAVE_NAME = 24;

/**
 * What actually gets stored when the player names a save: trimmed, single
 * spaces, capped. An empty result means unnamed, and the slot shows "Slot N".
 */
export function sanitizeSaveName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, MAX_SAVE_NAME);
}

/**
 * What the title screen calls a save. A save without a player-given name
 * defaults to its slot spot — "Slot 1", "Slot 2", "Slot 3" — so every
 * existing game already has a sensible name before anyone renames anything.
 * Kept as a display fallback rather than stored, so it always matches where
 * the save actually sits.
 */
export function displaySaveName(name: string | undefined, slot: number): string {
  return sanitizeSaveName(typeof name === 'string' ? name : '') || `Slot ${slot}`;
}

/**
 * The handful of facts that let a player recognize one of their own saves.
 *
 * Deliberately descriptive and never comparative: day, gold and depth can all
 * legitimately go backwards, so none of them can decide which save is newer.
 * Only the player can, which is what the chooser is for.
 */
export function describeSave(state: GameState): SaveSummary {
  const run = state.run;
  const place = run && run.outcome === 'active' ? `Depth ${run.depth}, mid-delve` : 'In town';
  const name = typeof state.name === 'string' ? state.name : '';
  const difficulty = state.difficulty === 'normal' ? 'Normal' : 'Hard';
  return { day: state.market?.day ?? 1, place, gold: state.gold ?? 0, runs: state.lifetime?.runs ?? 0, name, difficulty };
}

/**
 * Hash of what a save contains, ignoring which playthrough it claims to be
 * and what the player calls it.
 *
 * Identity answers "is this the same game?"; this answers "has anything
 * actually happened since?". They have to be asked separately, because a row
 * written before ids existed gets one assigned on the way in, and comparing
 * that against a local save would report a difference that is purely the id.
 * The name is cosmetic for the same reason: renaming a save must not read as
 * two versions of one game.
 */
export function progressHash(state: GameState): string {
  const { saveId: _saveId, name: _name, ...rest } = state;
  return contentHash(canonicalJson(rest));
}
