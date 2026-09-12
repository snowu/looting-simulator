import { GameState, SAVE_VERSION } from '../state/game-state';
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
  | { status: 'ok' | 'unchanged'; generation: number; updatedAt: string }
  | { status: 'conflict' | 'stale_client'; generation: number | null; updatedAt: string | null };

interface Row {
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
export async function fetchCloudSave(): Promise<CloudFetch> {
  const { data, error } = await (await supabase())
    .from('game_saves')
    .select('state, format_version, schema_revision, generation, device_id, updated_at')
    .maybeSingle<Row>();
  if (error) throw error;
  if (!data) return { kind: 'none' };

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
  const raw = JSON.stringify(data.state);
  const state = parseSave(raw);
  if (!state) return incompatible;

  return {
    kind: 'save',
    save: { state, generation: data.generation, updatedAt: data.updated_at, device: data.device_id, raw },
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
export async function uploadSave(state: GameState, expectedGeneration: number | null): Promise<UploadResult> {
  // A save from a newer build must not be written back under this build's
  // revision. The server enforces this too; refusing here saves a round trip
  // and gives the UI something specific to say.
  if (isFutureSave(state)) return { status: 'stale_client', generation: expectedGeneration, updatedAt: null };

  const raw = serializeSave(state);
  const { data, error } = await (await supabase()).rpc('save_game', {
    p_expected_generation: expectedGeneration,
    p_state: JSON.parse(raw),
    p_format_version: state.version,
    p_schema_revision: state.revision ?? SAVE_REVISION,
    p_device_id: deviceId(),
    p_content_hash: contentHash(raw),
  });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as
    | { result_status: string; result_generation: number | null; result_updated_at: string | null }
    | undefined;
  if (!row) throw new Error('save_game returned nothing');

  const status = row.result_status as UploadResult['status'];
  if (status === 'ok' || status === 'unchanged') {
    return { status, generation: row.result_generation!, updatedAt: row.result_updated_at! };
  }
  return { status, generation: row.result_generation, updatedAt: row.result_updated_at };
}
