import { describe, expect, it } from 'vitest';
import { MAX_SAVE_NAME, contentHash, describeSave, displaySaveName, isFutureSave, parseSave, progressHash, sanitizeSaveName, serializeSave } from '../state/save-format';
import { SAVE_REVISION } from '../state/migrations';
import { newGame } from '../state/game-state';
import { createRng } from '../core/rng';
import { GameState } from '../state/game-state';

import legacySave from './fixtures/save-legacy.json';
const LEGACY = JSON.stringify(legacySave);

const fresh = (): GameState => newGame(createRng(1));

function reverseObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseObjectKeys(child)]));
}

describe('writing a save', () => {
  it('stamps the revision this build writes at', () => {
    const s = parseSave(LEGACY)!;
    const back = JSON.parse(serializeSave(s)) as GameState;
    expect(back.revision).toBe(SAVE_REVISION);
  });

  it('does not relabel a save written by a newer build', () => {
    // The player installed a newer build elsewhere, then opened this one. If
    // saving dated the file backwards, the newer build would come back and run
    // migrations that had already been applied.
    const s = parseSave(LEGACY)! as GameState & { revision: number };
    s.revision = SAVE_REVISION + 5;
    const back = JSON.parse(serializeSave(s)) as GameState;
    expect(back.revision).toBe(SAVE_REVISION + 5);
  });

  it('still saves a future save rather than refusing it', () => {
    const s = fresh() as GameState & { revision: number };
    s.revision = SAVE_REVISION + 5;
    s.gold = 999;
    const back = parseSave(serializeSave(s))!;
    expect(back.gold).toBe(999);
  });

  it('keeps fields it does not understand', () => {
    const s = fresh() as GameState & Record<string, unknown>;
    s.revision = SAVE_REVISION + 5;
    s.cathedral = { consecrated: true };
    const back = JSON.parse(serializeSave(s)) as Record<string, unknown>;
    expect(back.cathedral).toEqual({ consecrated: true });
  });

  it('recognizes a future save, and an ordinary one', () => {
    const s = fresh();
    expect(isFutureSave(s)).toBe(false);
    s.revision = SAVE_REVISION + 1;
    expect(isFutureSave(s)).toBe(true);
    // A save from before revisions existed is old, not future.
    delete s.revision;
    expect(isFutureSave(s)).toBe(false);
  });
});

describe('content hash', () => {
  it('is stable for identical content', () => {
    expect(contentHash(LEGACY)).toBe(contentHash(LEGACY));
  });

  it('changes when anything in the save changes', () => {
    const s = parseSave(LEGACY)!;
    const before = contentHash(serializeSave(s));
    s.gold += 1;
    expect(contentHash(serializeSave(s))).not.toBe(before);
  });

  it('is stable after a jsonb-style recursive key reorder', () => {
    const local = fresh();
    const localRaw = serializeSave(local);
    const databaseRaw = JSON.stringify(reverseObjectKeys(JSON.parse(localRaw)));
    const downloaded = parseSave(databaseRaw)!;

    expect(serializeSave(downloaded)).toBe(localRaw);
    expect(contentHash(serializeSave(downloaded))).toBe(contentHash(localRaw));
  });

  it('notices a change buried deep in a run', () => {
    const s = parseSave(LEGACY)!;
    const before = contentHash(serializeSave(s));
    s.run!.player.hp -= 1;
    expect(contentHash(serializeSave(s))).not.toBe(before);
  });

  it('separates saves that differ only late in a long string', () => {
    const a = 'x'.repeat(5000) + 'a';
    const b = 'x'.repeat(5000) + 'b';
    expect(contentHash(a)).not.toBe(contentHash(b));
  });
});

describe('progress hash', () => {
  it('ignores which playthrough a save claims to be', () => {
    // A cloud row written before ids existed has one assigned on the way in.
    // If that counted as a difference, the card would report two versions of a
    // save that is byte-for-byte the same game.
    const a = parseSave(LEGACY)!;
    const b = parseSave(LEGACY)!;
    a.saveId = 'one';
    b.saveId = 'another';
    expect(progressHash(a)).toBe(progressHash(b));
  });

  it('still notices actual progress', () => {
    const a = parseSave(LEGACY)!;
    const b = parseSave(LEGACY)!;
    b.gold += 1;
    expect(progressHash(a)).not.toBe(progressHash(b));
  });

  it('ignores object key order at every depth', () => {
    const local = fresh();
    const reordered = parseSave(JSON.stringify(reverseObjectKeys(JSON.parse(serializeSave(local)))))!;
    expect(progressHash(reordered)).toBe(progressHash(local));
  });

  it('ignores the player-given name', () => {
    // Renaming a save must not read as two versions of one game.
    const a = parseSave(LEGACY)!;
    const b = parseSave(LEGACY)!;
    b.name = 'Kingslayer';
    expect(progressHash(a)).toBe(progressHash(b));
  });

  it('still uploads a rename', () => {
    // The progress hash ignores the name, but the content hash must not: a
    // rename has to reach the cloud like any other change.
    const s = fresh();
    const before = contentHash(serializeSave(s));
    s.name = 'Kingslayer';
    expect(contentHash(serializeSave(s))).not.toBe(before);
  });
});

describe('save names', () => {
  it('trims and collapses whitespace', () => {
    expect(sanitizeSaveName('  Ashen   King  ')).toBe('Ashen King');
  });

  it('caps the length for the slot card', () => {
    expect(sanitizeSaveName('x'.repeat(MAX_SAVE_NAME + 10))).toBe('x'.repeat(MAX_SAVE_NAME));
  });

  it('treats blank as unnamed', () => {
    expect(sanitizeSaveName('   ')).toBe('');
  });

  it('defaults an unnamed save to its slot spot', () => {
    expect(displaySaveName('', 2)).toBe('Slot 2');
    expect(displaySaveName(undefined, 3)).toBe('Slot 3');
    expect(displaySaveName('Kingslayer', 1)).toBe('Kingslayer');
  });

  it('carries the name in the summary', () => {
    const s = fresh();
    s.name = 'Kingslayer';
    expect(describeSave(s).name).toBe('Kingslayer');
  });

  it('backfills a name for saves from before names existed', () => {
    const back = parseSave(LEGACY)!;
    expect(back.name).toBe('');
    expect(describeSave(back).name).toBe('');
  });
});
