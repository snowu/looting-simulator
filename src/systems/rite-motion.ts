/**
 * Rites on a gamepad: stick motions, not drawing.
 *
 * A stick is not a pen — it springs back to the centre — so steering a cursor
 * through a mark with one is miserable. Instead the right stick is read the
 * way a fighting game reads a quarter-circle: each push out from the centre
 * and back is one **flick**, snapped to eight directions, and a full turn of
 * the stick while it is held out is a **roll**. A mark's motion is derived
 * from its template, so the V is ↘ ↗, the Z → ↙ →, the triangle ↘ ← ↗ and the
 * circle a roll; each can be made either way round, like the drawn marks.
 *
 * Grading keeps the drawn rite's three outcomes: the exact motion is full
 * power, one slip (a neighbouring direction costs half a slip, a wrong,
 * extra or missing flick a whole one) is half power, and anything further is
 * a botch, read as whichever known mark it came closest to.
 *
 * The tablet still shows the mark burning in: each flick that keeps to a
 * known mark lays down that mark's own leg, so a clean motion draws the mark
 * itself; a flick that keeps to none draws a plain stroke where it pointed.
 */
import type { RiteGrade, TracePoint } from './rite-draw';

/** 0 is right, then clockwise in screen space (y down): 1 ↘, 2 ↓, 3 ↙, 4 ←, 5 ↖, 6 ↑, 7 ↗. */
export type Flick = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type MotionToken = Flick | 'roll';

/** The stick counts as pushed out past this, and as back home below the next. */
export const MOTION_OUT = 0.6;
export const MOTION_IN = 0.3;
/** Turning this far while held out is a roll: a circle, made with the stick. */
export const MOTION_ROLL = (300 / 180) * Math.PI;
/** Turning this far (short of a roll) slides between two flicks without going home. */
export const MOTION_SLIDE = (60 / 180) * Math.PI;

const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
/** A template with more corners than this is a loop, made by a roll. */
const MAX_FLICKS = 5;

type Template = readonly (readonly [number, number])[];

export function snapFlick(angle: number): Flick {
  return (((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8) as Flick;
}

/** The motion that makes a mark: a flick per straight leg, or one roll for a loop. */
export function motionOf(template: Template): MotionToken[] {
  if (template.length - 1 > MAX_FLICKS) return ['roll'];
  const out: MotionToken[] = [];
  for (let i = 1; i < template.length; i++) {
    out.push(snapFlick(Math.atan2(template[i][1] - template[i - 1][1], template[i][0] - template[i - 1][0])));
  }
  return out;
}

/** The same mark made from its other end. */
export function reverseMotion(motion: readonly MotionToken[]): MotionToken[] {
  return [...motion].reverse().map((t) => (t === 'roll' ? t : (((t + 4) % 8) as Flick)));
}

/** How a motion is shown on the legend: arrows, or a turn for a roll. */
export function motionLabel(motion: readonly MotionToken[]): string {
  return motion.map((t) => (t === 'roll' ? '⟳' : ARROWS[t])).join(' ');
}

function slip(a: MotionToken, b: MotionToken): number {
  if (a === b) return 0;
  if (a === 'roll' || b === 'roll') return 1;
  const d = Math.abs(a - b) % 8;
  return Math.min(d, 8 - d) === 1 ? 0.5 : 1;
}

/** Slips between a made motion and a mark's: an edit distance, a neighbour at half. */
export function motionDistance(made: readonly MotionToken[], mark: readonly MotionToken[]): number {
  let row = Array.from({ length: mark.length + 1 }, (_, j) => j);
  for (let i = 1; i <= made.length; i++) {
    const next = [i];
    for (let j = 1; j <= mark.length; j++) {
      next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + slip(made[i - 1], mark[j - 1]));
    }
    row = next;
  }
  return row[mark.length];
}

export function gradeMotion(distance: number): RiteGrade {
  return distance === 0 ? 'full' : distance <= 1 ? 'weak' : 'botch';
}

/** The known mark a motion reads as, and how well; nothing for no motion at all. */
export function readMotion<T extends { template: Template }>(
  made: readonly MotionToken[], candidates: readonly T[],
): { def: T; grade: RiteGrade } | undefined {
  if (!made.length) return undefined;
  let best: { def: T; distance: number } | undefined;
  for (const def of candidates) {
    const motion = motionOf(def.template);
    const distance = Math.min(motionDistance(made, motion), motionDistance(made, reverseMotion(motion)));
    if (!best || distance < best.distance) best = { def, distance };
  }
  return best && { def: best.def, grade: gradeMotion(best.distance) };
}

/** A plain flick that keeps to no known mark: this long on the tablet. */
const LOOSE_LEG = 0.25;
/**
 * Marks are laid at this size about the tablet's centre. A first flick can
 * keep to more than one mark (the V and the triangle both open ↘), so the
 * stroke may start at one mark's corner and go on as another's: at full size
 * that runs off the tablet, at this size it stays on it. The matcher reads
 * shape, not size.
 */
const LAY_SCALE = 0.55;
const LEG_STEPS = 8;

/**
 * Reads the right stick into flicks and rolls, and lays the stroke the
 * tablet shows. One per trace: make a new one when a trace opens.
 */
export class StickMotion {
  readonly tokens: MotionToken[] = [];
  /** The tablet's stroke, in 0..1; only ever appended to. */
  readonly points: TracePoint[] = [];
  private out = false;
  private rolled = false;
  private startA = 0;
  private lastA = 0;
  private peakA = 0;
  private peak = 0;
  private turned = 0;

  constructor(private readonly templates: readonly Template[]) {}

  /** One stick sample (y down, as the Gamepad API reports it). Returns the points it added. */
  sample(x: number, y: number): TracePoint[] {
    const mag = Math.hypot(x, y);
    const a = Math.atan2(y, x);
    if (!this.out) {
      if (mag < MOTION_OUT) return [];
      Object.assign(this, { out: true, rolled: false, startA: a, lastA: a, peakA: a, peak: mag, turned: 0 });
      return [];
    }
    if (mag <= MOTION_IN) {
      this.out = false;
      return this.rolled ? [] : this.lay(this.close());
    }
    let d = a - this.lastA;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    this.turned += d;
    this.lastA = a;
    if (mag > this.peak) {
      this.peak = mag;
      this.peakA = a;
    }
    if (!this.rolled && Math.abs(this.turned) >= MOTION_ROLL) {
      this.rolled = true;
      return this.lay(['roll']);
    }
    return [];
  }

  /**
   * Where the tablet's guide for a mark goes: laid the way this motion is
   * making it, at the stroke's size, from the stroke's first point — so a
   * clean motion burns in on top of its guide.
   */
  guide(template: Template): TracePoint[] {
    const motion = motionOf(template);
    const ahead = motionDistance(this.tokens, motion) <= motionDistance(this.tokens, reverseMotion(motion));
    const verts = ahead ? template : [...template].reverse();
    const [x0, y0] = verts[0];
    const o = this.points[0] ?? { x: 0.5 + LAY_SCALE * (x0 - 0.5), y: 0.5 + LAY_SCALE * (y0 - 0.5) };
    return verts.map(([x, y]) => ({ x: o.x + LAY_SCALE * (x - x0), y: o.y + LAY_SCALE * (y - y0) }));
  }

  /** The stick is still out as the trace closes: count what it was doing. */
  flush(): TracePoint[] {
    if (!this.out) return [];
    this.out = false;
    return this.rolled ? [] : this.lay(this.close());
  }

  private close(): MotionToken[] {
    if (Math.abs(this.turned) < MOTION_SLIDE) return [snapFlick(this.peakA)];
    const from = snapFlick(this.startA), to = snapFlick(this.lastA);
    return from === to ? [from] : [from, to];
  }

  private lay(made: MotionToken[]): TracePoint[] {
    const before = this.points.length;
    for (const t of made) {
      this.tokens.push(t);
      this.layLeg(this.tokens.length - 1);
    }
    return this.points.slice(before);
  }

  /** Token `i` keeps to a known mark: draw that mark's leg; otherwise a plain one. */
  private layLeg(i: number): void {
    const leg = this.markLeg(i);
    if (leg) {
      if (!this.points.length) this.push(0.5 + LAY_SCALE * (leg[0].x - 0.5), 0.5 + LAY_SCALE * (leg[0].y - 0.5));
      const from = this.points[this.points.length - 1];
      for (let k = 1; k < leg.length; k++) {
        this.segment({ x: from.x + LAY_SCALE * (leg[k].x - leg[0].x), y: from.y + LAY_SCALE * (leg[k].y - leg[0].y) }, leg.length > 2 ? 1 : LEG_STEPS);
      }
      return;
    }
    if (!this.points.length) this.points.push({ x: 0.5, y: 0.5 });
    const from = this.points[this.points.length - 1];
    const t = this.tokens[i];
    if (t === 'roll') {
      const r = LOOSE_LEG / 2;
      for (let k = 1; k <= 24; k++) {
        const a = -Math.PI / 2 + (k / 24) * 2 * Math.PI;
        this.push(from.x + r * Math.cos(a), from.y + r + r * Math.sin(a));
      }
      return;
    }
    const a = (t * Math.PI) / 4;
    this.segment({ x: from.x + LOOSE_LEG * Math.cos(a), y: from.y + LOOSE_LEG * Math.sin(a) }, LEG_STEPS);
  }

  /** The leg of a known mark that the motion so far keeps to, oriented the way it is being made. */
  private markLeg(i: number): TracePoint[] | undefined {
    const made = this.tokens.slice(0, i + 1);
    for (const template of this.templates) {
      const verts = template.map(([x, y]) => ({ x, y }));
      for (const way of [verts, [...verts].reverse()]) {
        const motion = motionOf(template);
        const oriented = way === verts ? motion : reverseMotion(motion);
        if (oriented.length <= i || made.some((t, k) => t !== oriented[k])) continue;
        return oriented[0] === 'roll' ? way : [way[i], way[i + 1]];
      }
    }
    return undefined;
  }

  /** From the stroke's last point to `to`, in even steps. */
  private segment(to: TracePoint, steps: number): void {
    const { x: x0, y: y0 } = this.points[this.points.length - 1];
    for (let k = 1; k <= steps; k++) this.push(x0 + ((to.x - x0) * k) / steps, y0 + ((to.y - y0) * k) / steps);
  }

  private push(x: number, y: number): void {
    this.points.push({ x: Math.min(0.98, Math.max(0.02, x)), y: Math.min(0.98, Math.max(0.02, y)) });
  }
}
