/**
 * The rite recogniser: an ordered, arc-length-resampled path matcher. A trace is
 * resampled to 32 evenly spaced points, normalised into a unit box
 * (position and size mean nothing; shape means everything), and scored
 * against the rite's template in both stroke directions — an M drawn
 * right-to-left is still an M.
 *
 * Scores run 0..1: 1 is a perfect trace. A tap or a dot is not a trace at
 * all and always botches, so pressing the input without drawing can never
 * cast for free.
 */
export interface TracePoint {
  x: number;
  y: number;
}

export type RiteGrade = 'full' | 'weak' | 'botch';

const RESAMPLE_N = 32;
/** A trace with fewer points, or a shorter path, than this is a dot: a botch. */
const MIN_TRACE_POINTS = 2;
const MIN_TRACE_LENGTH = 0.4;

export const RITE_FULL_SCORE = 0.8;
export const RITE_WEAK_SCORE = 0.6;

export function traceLength(points: readonly TracePoint[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

function resample(points: readonly TracePoint[], n: number): TracePoint[] {
  const total = traceLength(points);
  const step = total / (n - 1);
  const out: TracePoint[] = [{ ...points[0] }];
  let acc = 0;
  let prev = { ...points[0] };
  for (let i = 1; i < points.length && out.length < n; i++) {
    const cur = points[i];
    const d = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    if (acc + d >= step && d > 0) {
      const t = (step - acc) / d;
      const next = { x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) };
      out.push(next);
      prev = next;
      acc = 0;
      i--;
    } else {
      acc += d;
      prev = { ...cur };
    }
  }
  while (out.length < n) out.push({ ...points[points.length - 1] });
  return out;
}

function normalize(points: readonly TracePoint[]): TracePoint[] {
  let cx = 0, cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  cx /= points.length;
  cy /= points.length;
  let maxSide = 0;
  for (const p of points) {
    maxSide = Math.max(maxSide, Math.abs(p.x - cx), Math.abs(p.y - cy));
  }
  if (maxSide === 0) return points.map(() => ({ x: 0, y: 0 }));
  return points.map((p) => ({ x: (p.x - cx) / maxSide, y: (p.y - cy) / maxSide }));
}

function meanDistance(a: readonly TracePoint[], b: readonly TracePoint[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return sum / a.length;
}

/** 0..1 match of a raw trace against a raw template (either direction). */
export function matchRite(points: readonly TracePoint[], template: readonly (readonly [number, number])[]): number {
  if (points.length < MIN_TRACE_POINTS || traceLength(points) < MIN_TRACE_LENGTH) return 0;
  const norm = normalize(resample(points, RESAMPLE_N));
  const ref = normalize(resample(template.map(([x, y]) => ({ x, y })), RESAMPLE_N));
  const fwd = meanDistance(norm, ref);
  const rev = meanDistance(norm, [...ref].reverse());
  return Math.max(0, 1 - Math.min(fwd, rev) / 0.5);
}

export function gradeRite(points: readonly TracePoint[], template: readonly (readonly [number, number])[]): RiteGrade {
  const score = matchRite(points, template);
  if (score >= RITE_FULL_SCORE) return 'full';
  if (score >= RITE_WEAK_SCORE) return 'weak';
  return 'botch';
}
