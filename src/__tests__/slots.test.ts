import { beforeEach, describe, expect, it } from 'vitest';
import { SLOTS, clearSave, lastSlot, loadGame, saveGame, setLastSlot } from '../state/persistence';
import { newGame } from '../state/game-state';
import { createRng } from '../core/rng';

/** A Map-backed localStorage, since these tests run outside a browser. */
function stubStorage(): Map<string, string> {
  const m = new Map<string, string>();
  (globalThis as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
  return m;
}

const LEGACY_KEY = 'looting-simulator-save-v2';
let store: Map<string, string>;

beforeEach(() => {
  store = stubStorage();
});

describe('save slots', () => {
  it('reads a save written before slots existed as slot 1', () => {
    // The exact key a shipped build has been writing to all along. If this
    // breaks, every existing player loses their game.
    const existing = newGame(createRng(1));
    existing.gold = 840;
    store.set(LEGACY_KEY, JSON.stringify(existing));

    const loaded = loadGame(1);
    expect(loaded).not.toBeNull();
    expect(loaded!.gold).toBe(840);
  });

  it('keeps writing slot 1 to that same key', () => {
    saveGame(newGame(createRng(1)), 1);
    expect(store.has(LEGACY_KEY)).toBe(true);
  });

  it('gives every slot its own game', () => {
    for (const n of SLOTS) {
      const g = newGame(createRng(n));
      g.gold = n * 100;
      saveGame(g, n);
    }
    for (const n of SLOTS) expect(loadGame(n)!.gold).toBe(n * 100);
    expect(store.size).toBe(SLOTS.length);
  });

  it('starts the other slots empty even when slot 1 has a game', () => {
    saveGame(newGame(createRng(1)), 1);
    expect(loadGame(2)).toBeNull();
    expect(loadGame(3)).toBeNull();
  });

  it('erasing one slot leaves the others alone', () => {
    for (const n of SLOTS) saveGame(newGame(createRng(n)), n);
    clearSave(2);
    expect(loadGame(2)).toBeNull();
    expect(loadGame(1)).not.toBeNull();
    expect(loadGame(3)).not.toBeNull();
  });

  it('remembers the slot last played, and defaults to the first', () => {
    expect(lastSlot()).toBe(1);
    setLastSlot(3);
    expect(lastSlot()).toBe(3);
  });

  it('falls back to slot 1 if the remembered slot is nonsense', () => {
    store.set('looting-simulator-slot', '7');
    expect(lastSlot()).toBe(1);
  });
});
