import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { esc } from '../core/escape';
import {
  CONTENT_HASH_RE,
  MAX_DEVICE_ID_LENGTH,
  MAX_SAVE_ID_LENGTH,
  validateDeleteArgs,
  validateUploadArgs,
} from '../cloud/cloud-save';

// The deployed schema and the client module under test, read as text so the
// tests pin the security properties themselves rather than a summary of them.
const SQL = readFileSync(new URL('../../supabase/game_saves.sql', import.meta.url).pathname, 'utf8');
const CLIENT = readFileSync(new URL('../cloud/cloud-save.ts', import.meta.url).pathname, 'utf8');

describe('cloud save schema: nobody can touch another player row', () => {
  it('enables row-level security on game_saves', () => {
    expect(SQL).toMatch(/alter table public\.game_saves enable row level security/i);
  });

  it('scopes every policy to the caller own row', () => {
    for (const op of ['select', 'insert', 'update', 'delete']) {
      const re = new RegExp(`create policy[\\s\\S]*?for ${op}[\\s\\S]*?auth\\.uid\\(\\) = user_id`, 'i');
      expect(SQL, `missing or unscoped ${op} policy`).toMatch(re);
    }
  });

  it('never uses security definer', () => {
    expect(SQL.toLowerCase()).not.toContain('security definer');
  });

  it('derives identity from auth.uid(), never from a client parameter', () => {
    expect(SQL).not.toMatch(/p_user_id/i);
    // Both RPC functions bind the caller JWT to a local and filter on it.
    const bindings = SQL.match(/v_uid uuid := auth\.uid\(\)/g) ?? [];
    expect(bindings.length).toBeGreaterThanOrEqual(2);
    const writes = SQL.match(/where user_id = v_uid/g) ?? [];
    expect(writes.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps anonymous callers out of the functions', () => {
    expect(SQL).toMatch(/revoke all on function public\.save_game\(smallint, text, bigint, jsonb, integer, integer, text, text\) from public, anon/i);
    expect(SQL).toMatch(/revoke all on function public\.save_game\(bigint, jsonb, integer, integer, text, text\) from public, anon/i);
    expect(SQL).toMatch(/revoke all on function public\.delete_game\(smallint, text\) from public, anon/i);
    expect(SQL).toMatch(/grant execute on function public\.save_game\(smallint, text, bigint, jsonb, integer, integer, text, text\) to authenticated/i);
    expect(SQL).toMatch(/grant execute on function public\.delete_game\(smallint, text\) to authenticated/i);
  });

  it('contains no service-role key or bypass', () => {
    expect(SQL.toLowerCase()).not.toContain('service_role');
    expect(SQL.toLowerCase()).not.toContain('service-role');
    expect(SQL.toLowerCase()).not.toContain('bypassrls');
  });
});

describe('cloud save schema: a tampered client cannot eat the quota', () => {
  it('caps state size, slot range and metadata lengths', () => {
    expect(SQL).toMatch(/game_saves_state_size[\s\S]*?pg_column_size\(state\) <= 2 \* 1024 \* 1024/);
    expect(SQL).toMatch(/game_saves_slot_range[\s\S]*?slot between 1 and 3/);
    expect(SQL).toMatch(/game_saves_ids_size[\s\S]*?save_id[\s\S]*?device_id[\s\S]*?content_hash/);
    expect(SQL).toMatch(/content_hash ~ '\^\[0-9a-f\]\{16\}\$'/);
  });

  it('validates inputs inside save_game before touching rows', () => {
    for (const msg of ['invalid slot', 'invalid save id', 'invalid device id', 'invalid content hash', 'invalid state', 'invalid format version']) {
      expect(SQL, `save_game missing check: ${msg}`).toContain(msg);
    }
  });

  it('validates inputs inside delete_game', () => {
    const body = SQL.slice(SQL.indexOf('create or replace function public.delete_game'));
    expect(body).toContain('invalid slot');
    expect(body).toContain('invalid save id');
  });
});

describe('cloud client: never sends identity, validates before the network', () => {
  it('sends no user_id to the server', () => {
    expect(CLIENT).not.toMatch(/user_id/i);
  });

  it('accepts honest upload metadata', () => {
    expect(() =>
      validateUploadArgs({ slot: 1, saveId: '550e8400-e29b-41d4-a716-446655440000', deviceId: 'ephemeral', contentHash: '0123456789abcdef' }),
    ).not.toThrow();
    expect(() => validateUploadArgs({ slot: 3, saveId: null, deviceId: 'x', contentHash: '0'.repeat(16) })).not.toThrow();
  });

  it('rejects out-of-range slots without a round trip', () => {
    for (const slot of [0, 4, -1, 1.5, NaN]) {
      expect(() => validateUploadArgs({ slot, saveId: null, deviceId: 'd', contentHash: '0'.repeat(16) })).toThrow(/invalid slot/i);
    }
  });

  it('rejects oversized or empty ids and malformed hashes', () => {
    const good = { slot: 1, saveId: null as string | null, deviceId: 'd', contentHash: '0'.repeat(16) };
    expect(() => validateUploadArgs({ ...good, saveId: '' })).toThrow(/save id/i);
    expect(() => validateUploadArgs({ ...good, saveId: 'x'.repeat(MAX_SAVE_ID_LENGTH + 1) })).toThrow(/save id/i);
    expect(() => validateUploadArgs({ ...good, deviceId: '' })).toThrow(/device id/i);
    expect(() => validateUploadArgs({ ...good, deviceId: 'x'.repeat(MAX_DEVICE_ID_LENGTH + 1) })).toThrow(/device id/i);
    for (const hash of ['', 'xyz', '0'.repeat(15), '0'.repeat(17), '0123456789ABCDEF', '0123456789abcdeg']) {
      expect(() => validateUploadArgs({ ...good, contentHash: hash })).toThrow(/content hash/i);
    }
    expect(CONTENT_HASH_RE.test('0123456789abcdef')).toBe(true);
  });

  it('validates delete arguments the same way', () => {
    expect(() => validateDeleteArgs({ slot: 2, saveId: null })).not.toThrow();
    expect(() => validateDeleteArgs({ slot: 9, saveId: null })).toThrow(/invalid slot/i);
    expect(() => validateDeleteArgs({ slot: 1, saveId: 'x'.repeat(MAX_SAVE_ID_LENGTH + 1) })).toThrow(/save id/i);
  });
});

describe('html escaping for save-derived strings', () => {
  it('escapes markup, quotes and ampersands', () => {
    expect(esc('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(esc('a&b"c<d>e')).toBe('a&amp;b&quot;c&lt;d&gt;e');
    expect(esc('Kingslayer')).toBe('Kingslayer');
  });

  it('neutralizes a hostile save name inside markup', () => {
    const hostile = '"><script>alert(document.domain)</script>';
    const html = `<div class="gold-t">“${esc(hostile)}”</div>`;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
