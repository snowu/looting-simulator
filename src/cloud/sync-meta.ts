import { GameState } from '../state/game-state';
import { contentHash, serializeSave } from '../state/save-format';
import type { Slot } from '../state/persistence';

/**
 * The last state this browser and the cloud agreed on, for one playthrough.
 *
 * `CloudSync` lives only as long as the page, but reloads are exactly when
 * the question matters: a local save lands on every unload while its cloud
 * push is still debounced, so after a reload the local snapshot is routinely
 * a checkpoint ahead of the cloud row. Without a memory of the last agreement
 * that looks identical to two devices genuinely diverging, and the player gets
 * interrogated over a few seconds of their own progress. Remembering the last
 * agreed generation and hash tells the two apart: cloud untouched plus local
 * moved on means catch the cloud up; local untouched plus cloud moved on
 * means take the cloud; only both moved on is a real question.
 */
export interface SyncMeta {
  generation: number;
  hash: string;
  cloudSlot: Slot;
}

const META_PREFIX = 'looting-simulator-sync-v1-';

function metaKey(saveId: string): string {
  return `${META_PREFIX}${saveId}`;
}

export function loadMeta(saveId: string | undefined | null): SyncMeta | null {
  try {
    if (!saveId) return null;
    const raw = localStorage.getItem(metaKey(saveId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SyncMeta>;
    if (typeof parsed.generation !== 'number' || typeof parsed.hash !== 'string') return null;
    return parsed as SyncMeta;
  } catch {
    return null;
  }
}

export function storeMeta(saveId: string | undefined | null, meta: SyncMeta): void {
  try {
    if (!saveId) return;
    localStorage.setItem(metaKey(saveId), JSON.stringify(meta));
  } catch {
    // Storage blocked: sync still works, it just cannot tell unsent local
    // progress from a genuine divergence on the next reload.
  }
}

/**
 * Carry the last agreement through a migration.
 *
 * The agreement is a hash of the save as it was serialized then. Loading a
 * save written before a save-revision bump migrates it — new fields, a new
 * revision stamp — so the very same game serializes differently afterwards,
 * and `begin()` read that as local progress. With the cloud untouched that was
 * harmless (it uploaded), but if another device had written in the meantime it
 * put an untouched save up against the other device's progress in the chooser.
 *
 * Migration is not play. When the text on disk is exactly what was agreed,
 * the migrated game is that same agreement, re-hashed in this build's form.
 */
export function carryAgreementThroughMigration(raw: string, state: GameState): void {
  const meta = loadMeta(state.saveId);
  if (!meta || meta.hash !== contentHash(raw)) return;
  const migrated = contentHash(serializeSave(state));
  if (migrated !== meta.hash) storeMeta(state.saveId, { ...meta, hash: migrated });
}
