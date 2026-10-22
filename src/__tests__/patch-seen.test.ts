import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Patch } from '../data/patches';
import {
  newestPatchNumber,
  readLastSeenPatch,
  unseenPatches,
  unreadPatchCount,
  writeLastSeenPatch,
} from '../ui/patch-seen';

const fake = (n: number): Patch => ({
  n, hash: 'a'.repeat(40), short: 'aaaaaaa', date: '2026-09-24', title: `P${n}`, summary: 's', tags: ['t'],
});
const list = [fake(3), fake(2), fake(1)];

/** Minimal Storage stand-in: the suite runs in node, where localStorage does not exist. */
function stubStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  return store;
}

describe('unseen patches', () => {
  it('lists only patches newer than the last one seen', () => {
    expect(unseenPatches(list, 1).map((p) => p.n)).toEqual([3, 2]);
    expect(unseenPatches(list, 2).map((p) => p.n)).toEqual([3]);
  });

  it('reports nothing when the player is caught up or ahead', () => {
    expect(unseenPatches(list, 3)).toEqual([]);
    expect(unseenPatches(list, 9)).toEqual([]);
  });

  it('treats a first visit as nothing new, so history is not announced', () => {
    expect(unseenPatches(list, null)).toEqual([]);
  });

  it('finds the newest number regardless of list order', () => {
    expect(newestPatchNumber(list)).toBe(3);
    expect(newestPatchNumber([fake(1), fake(7), fake(4)])).toBe(7);
    expect(newestPatchNumber([])).toBe(0);
  });
});

describe('last-seen storage', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = stubStorage();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips the patch number', () => {
    expect(readLastSeenPatch()).toBeNull();
    writeLastSeenPatch(42);
    expect(readLastSeenPatch()).toBe(42);
  });

  it('ignores a stored value that is not a patch number', () => {
    store.set('looting-simulator-last-seen-patch', 'banana');
    expect(readLastSeenPatch()).toBeNull();
    store.set('looting-simulator-last-seen-patch', '-4');
    expect(readLastSeenPatch()).toBeNull();
  });

  it('counts unread patches against what is stored now', () => {
    writeLastSeenPatch(1);
    expect(unreadPatchCount()).toBeGreaterThan(0);
    writeLastSeenPatch(Number.MAX_SAFE_INTEGER);
    expect(unreadPatchCount()).toBe(0);
  });
});

describe('storage that cannot be read or written', () => {
  it('falls back quietly instead of throwing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readLastSeenPatch()).toBeNull();
    expect(() => writeLastSeenPatch(5)).not.toThrow();
    vi.unstubAllGlobals();
  });
});
