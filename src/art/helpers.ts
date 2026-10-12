/** Parse a template-literal pixel block into rows (blank lines and indentation dropped). */
export function rows(block: string): string[] {
  return block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/** A `w`×`h` block of one character: '.' for a blank canvas, '_' for an eraser to stamp. */
export function fill(w: number, h: number, ch = '.'): string[] {
  return Array.from({ length: h }, () => ch.repeat(w));
}

/** Flip rows left to right. */
export function mirror(r: string[]): string[] {
  return r.map((row) => [...row].reverse().join(''));
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

/** Fit a one-stroke mark into a pixel grid, preserving its proportions. */
export function traceRows(points: readonly (readonly [number, number])[], w: number, h: number, ink = 's'): string[] {
  const grid = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX, spanY = Math.max(...ys) - minY;
  const scale = Math.min((w - 1) / Math.max(spanX, 1e-9), (h - 1) / Math.max(spanY, 1e-9));
  const ox = (w - 1 - spanX * scale) / 2, oy = (h - 1 - spanY * scale) / 2;
  const vertices = points.map(([x, y]) => [ox + (x - minX) * scale, oy + (y - minY) * scale]);
  for (let i = 1; i < vertices.length; i++) {
    const [x0, y0] = vertices[i - 1], [x1, y1] = vertices[i];
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) + 1;
    for (let j = 0; j <= n; j++) grid[Math.round(y0 + (y1 - y0) * j / n)][Math.round(x0 + (x1 - x0) * j / n)] = ink;
  }
  return grid.map(row => row.join(''));
}
