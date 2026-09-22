/** Parse a template-literal pixel block into rows (blank lines and indentation dropped). */
export function rows(block: string): string[] {
  return block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** Mirror left-half rows into full symmetric rows. */
export function sym(half: string[]): string[] {
  return half.map((r) => r + [...r].reverse().join(''));
}

/**
 * Paint `over` onto `base` at (ox, oy). '.' keeps the base pixel,
 * '_' clears it to transparent, anything else replaces it.
 */
export function stamp(base: string[], over: string[], ox = 0, oy = 0): string[] {
  const out = base.map((r) => [...r]);
  over.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const ty = y + oy, tx = x + ox;
      if (ch === '.' || ty < 0 || ty >= out.length || tx < 0 || tx >= out[ty].length) return;
      out[ty][tx] = ch === '_' ? '.' : ch;
    });
  });
  return out.map((r) => r.join(''));
}
