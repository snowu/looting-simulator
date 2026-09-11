/**
 * Seeded PRNG (mulberry32). Every random decision in the game goes through an
 * Rng so a run can be reproduced from its seed and tests are deterministic.
 */
export interface Rng {
  /** Current internal state; persist it to resume the exact sequence. */
  readonly state: number;
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Float in [min, max). */
  float(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  /** Pick by weight. Entries with weight <= 0 are never chosen. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
  shuffle<T>(arr: T[]): T[];
  /** Independent child stream, stable for a given label. */
  fork(label: string | number): Rng;
}

export function hashString(s: string): number {
  // FNV-1a, 32-bit.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    get state() {
      return s;
    },
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    float(min, max) {
      return min + next() * (max - min);
    },
    chance(p) {
      return next() < p;
    },
    pick(arr) {
      if (arr.length === 0) throw new Error('pick from empty array');
      return arr[Math.floor(next() * arr.length)];
    },
    weighted(entries) {
      let total = 0;
      for (const [, w] of entries) if (w > 0) total += w;
      if (total <= 0) throw new Error('weighted pick with no positive weights');
      let r = next() * total;
      for (const [v, w] of entries) {
        if (w <= 0) continue;
        r -= w;
        if (r < 0) return v;
      }
      // Float rounding: fall back to the last positive entry.
      for (let i = entries.length - 1; i >= 0; i--) if (entries[i][1] > 0) return entries[i][0];
      throw new Error('unreachable');
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    fork(label) {
      const l = typeof label === 'number' ? label : hashString(label);
      return createRng((Math.imul(s ^ l, 0x9e3779b1) + l) >>> 0);
    },
  };
  return rng;
}
