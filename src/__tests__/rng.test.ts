import { describe, it, expect } from 'vitest';
import { createRng, hashString } from '../core/rng';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(123);
    const b = createRng(123);
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
  });

  it('resumes exactly from its saved state', () => {
    const a = createRng(9);
    a.next();
    a.next();
    const b = createRng(a.state);
    expect(b.next()).toBe(a.next());
  });

  it('int stays in range and hits both ends', () => {
    const r = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });

  it('weighted respects weights and ignores zero weights', () => {
    const r = createRng(7);
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 10000; i++) counts[r.weighted([['a', 1], ['b', 3], ['c', 0]] as const)]++;
    expect(counts.c).toBe(0);
    expect(counts.b / counts.a).toBeGreaterThan(2.5);
    expect(counts.b / counts.a).toBeLessThan(3.5);
  });

  it('fork gives stable, independent streams', () => {
    const a = createRng(5).fork('loot');
    const b = createRng(5).fork('loot');
    const c = createRng(5).fork('ai');
    expect(a.next()).toBe(b.next());
    expect(createRng(5).fork('loot').next()).not.toBe(c.next());
  });

  it('hashString is stable', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
  });
});
