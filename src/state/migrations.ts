import { GameState } from './game-state';
import { Floor } from '../systems/dungeon';
import { createContainer } from './inventory';
import { BASE_BACKPACK } from '../systems/meta';

/**
 * Additive save migrations.
 *
 * `SAVE_VERSION` in game-state.ts is the *format family*: changing it throws
 * every existing save away, so it must only move for a genuinely unreadable
 * change. Everything else — a new field on an item, a new array on a floor, a
 * new meta upgrade — is additive, and lands here instead as a new revision.
 *
 * `MIGRATIONS[i]` upgrades a save at revision `i` to revision `i + 1`. Saves
 * written before revisions existed have no `revision` field and count as 0, so
 * they run through every step. Each step must be safe to apply to a partially
 * built state and must never throw: a player mid-run is relying on it.
 */

/** Bump this (and push a migration) whenever a field is added to the save. */
export const SAVE_REVISION = 4;

type AnyState = GameState & Record<string, unknown>;

const MIGRATIONS: ((s: AnyState) => void)[] = [
  // 0 → 1: backfill the containers and collections that later code indexes into
  // without checking. Saves from before revisions existed predate this guard.
  (s) => {
    s.meta ??= {};
    s.knownRecipes ??= [];
    s.contracts ??= [];
    s.lifetime ??= { runs: 0, deaths: 0, extractions: 0, bestDepth: 0, goldEarned: 0, kills: 0 };
    s.lastRun ??= null;
    s.run ??= null;
    if (s.run) {
      s.run.keys ??= [];
      s.run.floors ??= [];
      for (const f of s.run.floors) if (f) normalizeFloor(f);
    }
  },
  // 1 → 2: floors grew traps. A floor generated before they existed simply has
  // none — regenerating it would move the walls under a player mid-run.
  (s) => {
    for (const f of s.run?.floors ?? []) if (f) f.traps ??= [];
  },
  // 2 → 3: a town-side loadout to pack before a delve, and the open town
  // portal a Scroll of Recall leaves behind. Older runs have neither.
  (s) => {
    s.loadout ??= createContainer(BASE_BACKPACK);
    s.loadout.items ??= [];
    if (s.run) s.run.portal ??= null;
  },
  // 3 → 4: monsters carry the opening a parry leaves in their guard. Nothing
  // mid-fight in an old save was parried, so they all start closed.
  (s) => {
    for (const f of s.run?.floors ?? []) for (const e of f?.enemies ?? []) e.vuln ??= 0;
  },
];

/** Every array a Floor is expected to have, so old floors don't crash lookups. */
function normalizeFloor(f: Floor): void {
  f.rooms ??= [];
  f.doors ??= [];
  f.secrets ??= [];
  f.stairs ??= [];
  f.torches ??= [];
  f.props ??= [];
  f.pickups ??= [];
  f.enemies ??= [];
  f.keys ??= [];
  f.traps ??= [];
}

/**
 * Bring a parsed save up to the current revision, in place. Unknown-but-newer
 * revisions are left alone: a save written by a newer build than this one is
 * better read as-is than half-migrated backwards.
 */
export function migrateSave(state: GameState): GameState {
  const s = state as AnyState;
  let rev = typeof s.revision === 'number' ? s.revision : 0;
  while (rev < SAVE_REVISION && rev < MIGRATIONS.length) {
    try {
      MIGRATIONS[rev](s);
    } catch {
      // A migration that fails shouldn't cost the player their save; the
      // defensive reads elsewhere still have to hold.
    }
    rev++;
  }
  s.revision = Math.max(rev, typeof s.revision === 'number' ? s.revision : 0);
  return state;
}
