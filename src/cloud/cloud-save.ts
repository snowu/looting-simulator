import { GameState, SAVE_VERSION } from '../state/game-state';
import { Slot } from '../state/persistence';
import { SAVE_REVISION } from '../state/migrations';
import { contentHash, isFutureSave, parseSave, serializeSave } from '../state/save-format';
import { deviceId } from './device';
import { supabase } from './supabase';

/**
 * Reading and writing the one cloud row, with the server's generation deciding
 * ordering. Nothing here touches the local save: a caller decides what to do
 * with what it gets back, and that decision belongs at the title screen or in
 * town, never mid-run.
 */

export interface CloudSave {
  slot: Slot;
  /**
   * The playthrough's identity, straight from the column. This is the
   * authority — not `state.saveId`, which a migration will happily invent for a
   * save that has never had one. Null on rows written before ids existed.
   */
  saveId: string | null;
  state: GameState;
  generation: number;
  updatedAt: string;
  device: string;
  /** Serialized form, so a caller can hash it without re-serializing. */
  raw: string;
}

export type CloudFetch =
  | { kind: 'none' }
  | { kind: 'save'; save: CloudSave }
  /** Readable row, unusable format: this build is too old, or the family moved. */
  | { kind: 'incompatible'; generation: number; updatedAt: string; schemaRevision: number };

export type UploadResult =
  | { status: 'ok' | 'unchanged'; slot: Slot; generation: number; updatedAt: string }
  | { status: 'conflict' | 'stale_client'; slot: Slot; generation: number | null; updatedAt: string | null };

interface Row {
  slot: Slot;
  save_id: string | null;
  state: unknown;
  format_version: number;
  schema_revision: number;
  generation: number;
  device_id: string;
  updated_at: string;
}

/**
 * Fetch this player's cloud save.
 *
 * A downloaded snapshot earns no more trust than one off the disk: it goes
 * through `parseSave`, so it gets the same format check and the same additive
 * migrations. A row written by a newer build is reported rather than installed
 * — this build cannot promise to maintain fields it has never heard of.
 */
export async function fetchCloudSave(slot: Slot): Promise<CloudFetch> {
  const { data, error } = await (await supabase())
    .from('game_saves')
    .select(COLUMNS)
    .eq('slot', slot)
    .maybeSingle<Row>();
  if (error) throw error;
  if (!data) return { kind: 'none' };
  return readRow(data);
}

/**
 * Every slot this player has in the cloud, for the title screen's picker. A
 * device that has never played still has to be able to see what is up there.
 */
export async function fetchCloudSlots(): Promise<Map<Slot, CloudFetch>> {
  const { data, error } = await (await supabase()).from('game_saves').select(COLUMNS);
  if (error) throw error;
  const out = new Map<Slot, CloudFetch>();
  // Rows this build cannot read are reported rather than hidden, so a slot the
  // player really has does not show up as empty and invite overwriting.
  for (const row of (data ?? []) as Row[]) out.set(row.slot, readRow(row));
  return out;
}

const COLUMNS = 'slot, save_id, state, format_version, schema_revision, generation, device_id, updated_at';

function readRow(data: Row): CloudFetch {
  const incompatible = {
    kind: 'incompatible' as const,
    generation: data.generation,
    updatedAt: data.updated_at,
    schemaRevision: data.schema_revision,
  };
  if (data.format_version !== SAVE_VERSION) return incompatible;
  if (data.schema_revision > SAVE_REVISION) return incompatible;

  // The column is jsonb, so it arrives parsed; back to text to go through the
  // one reader every save uses, reviver and all.
  const state = parseSave(JSON.stringify(data.state));
  if (!state) return incompatible;

  // Keep the identity the row carries. Without this the migration that
  // backfills ids invents a fresh one on every download, so the same cloud save
  // would look like a different playthrough on each device and to itself.
  if (data.save_id) state.saveId = data.save_id;

  // Serialize the way this build writes saves, so the hash is comparable with a
  // local one. The jsonb round trip is not: Postgres normalizes key order, so
  // comparing against it reports a difference between identical saves.
  const raw = serializeSave(state);

  return {
    kind: 'save',
    save: { slot: data.slot, saveId: data.save_id ?? null, state, generation: data.generation, updatedAt: data.updated_at, device: data.device_id, raw },
  };
}

/**
 * Upload via compare-and-swap.
 *
 * `expectedGeneration` is the generation this device believes it is replacing,
 * or null when it believes there is no row yet. A mismatch comes back as a
 * conflict rather than overwriting: whichever save is right is the player's
 * call, and they are the only one who can make it.
 */
export async function uploadSave(slot: Slot, state: GameState, expectedGeneration: number | null): Promise<UploadResult> {
  // A save from a newer build must not be written back under this build's
  // revision. The server enforces this too; refusing here saves a round trip
  // and gives the UI something specific to say.
  if (isFutureSave(state)) return { status: 'stale_client', slot, generation: expectedGeneration, updatedAt: null };

  const raw = serializeSave(state);
  const { data, error } = await (await supabase()).rpc('save_game', {
    p_slot: slot,
    // Identity travels with the save, so the server can recognise this
    // playthrough even when another device filed it in a different slot.
    p_save_id: state.saveId ?? null,
    p_expected_generation: expectedGeneration,
    p_state: JSON.parse(raw),
    p_format_version: state.version,
    p_schema_revision: state.revision ?? SAVE_REVISION,
    p_device_id: deviceId(),
    p_content_hash: contentHash(raw),
  });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as
    | { result_status: string; result_slot: Slot; result_generation: number | null; result_updated_at: string | null }
    | undefined;
  if (!row) throw new Error('save_game returned nothing');

  // The row keeps whichever slot it already occupied on this account, which
  // need not be the one this device asked for.
  const landed = row.result_slot ?? slot;
  const status = row.result_status as UploadResult['status'];
  if (status === 'ok' || status === 'unchanged') {
    return { status, slot: landed, generation: row.result_generation!, updatedAt: row.result_updated_at! };
  }
  return { status, slot: landed, generation: row.result_generation, updatedAt: row.result_updated_at };
}

/**
 * Delete a playthrough from the cloud, by identity where it has one.
 *
 * A save is matched by `saveId` wherever it sits rather than by slot number,
 * because the same playthrough can be filed under a different slot on each
 * device. A null id means a row from before ids existed, which can only be
 * addressed by position. This is an explicit, confirmed player action — the
 * title screen asks twice — so it wins over whatever generation is up there.
 */
export async function deleteCloudSave(slot: Slot, saveId: string | null): Promise<void> {
  const { error } = await (await supabase()).rpc('delete_game', {
    p_slot: slot,
    p_save_id: saveId,
  });
  if (error) throw error;
}
