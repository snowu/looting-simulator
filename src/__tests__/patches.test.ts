import { describe, expect, it } from 'vitest';
import { PATCHES, PATCH_COUNT } from '../data/patches';

/**
 * The patch-notes UI consumes PATCHES directly: hand-curated entries, newest
 * first, every field present so the overlay can render without guards. An
 * entry cites every commit it covers (`hash` plus `also`); `npm run patches`
 * checks those citations against history.
 */
describe('patch notes data', () => {
  it('has entries and matches the exported count', () => {
    expect(PATCHES.length).toBeGreaterThan(0);
    expect(PATCH_COUNT).toBe(PATCHES.length);
  });

  it('is newest first', () => {
    const dates = PATCHES.map((p) => p.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('numbers patches 1..N chronologically, newest first', () => {
    const ns = PATCHES.map((p) => p.n);
    expect(ns).toEqual([...ns].sort((a, b) => b - a));
    expect(Math.max(...ns)).toBe(PATCHES.length);
    expect(new Set(ns).size).toBe(ns.length);
    expect(Math.min(...ns)).toBe(1);
  });

  it('gives every patch a commit identity and a player-facing note', () => {
    for (const p of PATCHES) {
      expect(p.hash).toMatch(/^[0-9a-f]{40}$/);
      expect(p.short).toMatch(/^[0-9a-f]{7}$/);
      expect(p.hash.startsWith(p.short)).toBe(true);
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.summary.length).toBeGreaterThan(0);
      expect(p.tags.length).toBeGreaterThan(0);
    }
  });

  it('keeps detail bullets honest where they exist', () => {
    const detailed = PATCHES.filter((p) => p.details);
    expect(detailed.length).toBeGreaterThan(0);
    for (const p of detailed) for (const d of p.details!) expect(d.length).toBeGreaterThan(0);
  });

  it('has no duplicate commits', () => {
    const cited = PATCHES.flatMap((p) => [p.short, ...(p.also ?? [])]);
    expect(new Set(cited).size).toBe(cited.length);
  });
});
