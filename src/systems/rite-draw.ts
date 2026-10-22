/** Claudemancy's $P point-cloud matcher, adapted for one-stroke rites.
 * Even arc-length samples and a uniform unit-box scale preserve shape while
 * forgiving speed, direction and small tilts. A conservative bend check keeps
 * taps and straight swipes from masquerading as a rite.
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

export const RITE_FULL_SCORE = 0.65;
export const RITE_WEAK_SCORE = 0.4;

export function traceLength(points: readonly TracePoint[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

function resample(points: readonly TracePoint[], n: number): TracePoint[] {
  const total = traceLength(points);
  const out: TracePoint[] = [{ ...points[0] }];
  let segment = 1, travelled = 0;
  for (let sample = 1; sample < n; sample++) {
    const target = total * sample / (n - 1);
    while (segment < points.length) {
      const a = points[segment - 1], b = points[segment];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length > 0 && travelled + length >= target) {
        const t = Math.min(1, Math.max(0, (target - travelled) / length));
        out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
        break;
      }
      travelled += length;
      segment++;
    }
    if (segment >= points.length) out.push({ ...points[points.length - 1] });
  }
  return out;
}

function normalize(points: readonly TracePoint[]): TracePoint[] {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const size = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY, 1e-9);
  const scaled = points.map(p => ({ x: (p.x - minX) / size, y: (p.y - minY) / size }));
  const cx = scaled.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = scaled.reduce((sum, p) => sum + p.y, 0) / points.length;
  return scaled.map(p => ({ x: p.x - cx, y: p.y - cy }));
}

function cloudDistance(a: readonly TracePoint[], b: readonly TracePoint[], start: number): number {
  const matched = new Uint8Array(b.length);
  let sum = 0;
  for (let k = 0; k < a.length; k++) {
    const p = a[(start + k) % a.length];
    let best = Infinity, index = 0;
    for (let j = 0; j < b.length; j++) if (!matched[j]) {
      const distance = Math.hypot(p.x - b[j].x, p.y - b[j].y);
      if (distance < best) { best = distance; index = j; }
    }
    matched[index] = 1;
    sum += (1 - k / a.length) * best;
  }
  return sum;
}

function cloudMatch(a: readonly TracePoint[], b: readonly TracePoint[]): number {
  let best = Infinity;
  const step = Math.floor(Math.sqrt(a.length));
  for (let i = 0; i < a.length; i += step) best = Math.min(best, cloudDistance(a, b, i), cloudDistance(b, a, i));
  return best;
}

function bendRatio(points: readonly TracePoint[]): number {
  const first = points[0], last = points[points.length - 1];
  return traceLength(points) / Math.max(Math.hypot(last.x - first.x, last.y - first.y), 0.01);
}

/** 0..1 match, with Claudemancy's tilted templates and greedy cloud distance. */
export function matchRite(points: readonly TracePoint[], template: readonly (readonly [number, number])[]): number {
  if (points.length < MIN_TRACE_POINTS || traceLength(points) < MIN_TRACE_LENGTH || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return 0;
  if (template.length < 2) return 0;
  const rawRef = template.map(([x, y]) => ({ x, y }));
  const sampled = resample(points, RESAMPLE_N);
  // Round corners freely, but keep at least some of the template's bends.
  if (bendRatio(sampled) < 1 + (Math.min(3, bendRatio(rawRef)) - 1) * 0.35) return 0;
  const norm = normalize(sampled), ref = normalize(resample(rawRef, RESAMPLE_N));
  let best = Infinity;
  for (const degrees of [-15, 0, 15]) {
    const angle = degrees * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    const tilted = ref.map(p => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
    best = Math.min(best, cloudMatch(norm, tilted));
  }
  return Math.max(0, 1 - best / 3);
}

export function gradeRite(points: readonly TracePoint[], template: readonly (readonly [number, number])[]): RiteGrade {
  return gradeScore(matchRite(points, template));
}

export function gradeScore(score: number): RiteGrade {
  return score >= RITE_FULL_SCORE ? 'full' : score >= RITE_WEAK_SCORE ? 'weak' : 'botch';
}

/**
 * Which of several marks a trace is: the best-scoring one, graded on its own
 * score. One tablet serves every rite you know, so the drawing is the choice.
 * A botch still names its closest mark, which decides how it backfires.
 */
export function recogniseRite<T extends { template: readonly (readonly [number, number])[] }>(
  points: readonly TracePoint[], candidates: readonly T[],
): { def: T; score: number; grade: RiteGrade } | undefined {
  let best: { def: T; score: number } | undefined;
  for (const def of candidates) {
    const score = matchRite(points, def.template);
    if (!best || score > best.score) best = { def, score };
  }
  return best && { ...best, grade: gradeScore(best.score) };
}
