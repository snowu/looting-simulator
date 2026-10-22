import { RITES, type RiteDef } from '../data/rites';
import type { Element } from '../types';
import type { RiteGrade, TracePoint } from '../systems/rite-draw';

/** Browser port of snowu/claudemancy's canvas.go, main.go and mandala.go:
 * heat ramp, 18Hz stroke shimmer, ember-dot halo, damped ballistic sparks,
 * then a spinning sling-ring that collapses into a burst (or fades to ash).
 * All randomness is visual and independent of the dungeon's seeded RNG.
 */
const SIZE = 256;
const MAX_SPARKS = 1200;
const STROKE_EDGE = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;
type Ramp = readonly (readonly [number, number, number, number])[];
/** Each element's heat ramp, dim to white-hot: the stroke burns in its rite's colour. */
const HEATS: Record<Element, Ramp> = {
  fire: [[0, 70, 12, 0], [0.35, 190, 55, 0], [0.7, 255, 130, 20], [1, 255, 190, 80], [1.5, 255, 248, 225]],
  frost: [[0, 6, 28, 70], [0.35, 30, 100, 190], [0.7, 90, 180, 255], [1, 170, 225, 255], [1.5, 240, 252, 255]],
  holy: [[0, 60, 44, 6], [0.35, 170, 130, 30], [0.7, 240, 200, 80], [1, 255, 236, 150], [1.5, 255, 252, 236]],
  shadow: [[0, 34, 8, 60], [0.35, 100, 40, 170], [0.7, 170, 100, 245], [1, 214, 170, 255], [1.5, 248, 236, 255]],
};
interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number }

export class RiteFire {
  readonly size = SIZE;
  readonly pixels = new Uint8ClampedArray(SIZE * SIZE * 4);
  private intensity = new Float32Array(SIZE * SIZE);
  private lines = new Float32Array(SIZE * SIZE);
  private sparks: Spark[] = [];
  private points: readonly TracePoint[] = [];
  private lastPoint: TracePoint | undefined;
  private state: 'idle' | 'draw' | 'cast' | 'fizzle' = 'idle';
  private elapsed = 0;
  private time = 0;
  private rimAcc = 0;
  private burst = false;
  private strength = 1;
  private from = { x: SIZE / 2, y: SIZE / 2, r: SIZE * 0.3 };
  private rng = 0x9e3779b9;
  private heat: Ramp = HEATS.fire;
  private mark: RiteDef['template'] = RITES[0].template;
  /** Which rite's colour and mark: the one the stroke reads as so far, or the one cast. */
  private riteId: string = RITES[0].id;

  get rite(): string { return this.riteId; }

  /** Burn in this rite's colour, and ring with its mark when it is cast. */
  setRite(def: Pick<RiteDef, 'id' | 'element' | 'template'>): void {
    this.riteId = def.id;
    this.heat = HEATS[def.element];
    this.mark = def.template;
  }

  get visible(): boolean { return this.state !== 'idle'; }
  get finishing(): boolean { return this.state === 'cast' || this.state === 'fizzle'; }

  reset(): void {
    if (this.state === 'idle') return;
    this.state = 'idle';
    this.points = [];
    this.lastPoint = undefined;
    this.sparks = [];
    this.pixels.fill(0);
    this.elapsed = this.rimAcc = 0;
    this.burst = false;
  }

  trace(points: readonly TracePoint[]): void {
    if (this.points !== points) this.reset();
    this.state = 'draw';
    this.points = points;
    // Find the old tail rather than relying on a point count: long strokes are thinned.
    const start = this.lastPoint ? points.lastIndexOf(this.lastPoint) + 1 : 0;
    for (let i = start; i < points.length; i++) {
      for (let n = 0; n < 5; n++) this.spark(points[i].x * SIZE, points[i].y * SIZE, 10 + this.random() * 55, 0.25 + this.random() * 0.5);
    }
    this.lastPoint = points.at(-1);
  }

  finish(points: readonly TracePoint[], grade: RiteGrade, def?: Pick<RiteDef, 'id' | 'element' | 'template'>): void {
    if (def) this.setRite(def);
    this.points = points;
    this.state = grade === 'botch' ? 'fizzle' : 'cast';
    this.strength = grade === 'weak' ? 0.65 : 1;
    this.elapsed = this.rimAcc = 0;
    this.burst = false;
    if (points.length) {
      const xs = points.map(p => p.x * SIZE), ys = points.map(p => p.y * SIZE);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      this.from = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, r: Math.max(x1 - x0, y1 - y0, 12) / 2 };
    }
    for (const p of points) this.spark(p.x * SIZE, p.y * SIZE, 15 + this.random() * 50, 0.3 + this.random() * 0.5);
  }

  update(dt: number, drawing = false): void {
    if (!this.visible) return;
    dt = Math.max(dt, 0);
    this.time += dt;
    this.elapsed += dt;
    this.sparks = this.sparks.filter(s => {
      s.life -= dt;
      if (s.life <= 0) return false;
      // Keep animation time honest on slow frames; only physics is substepped.
      const steps = Math.max(1, Math.ceil(dt / 0.05)), step = dt / steps;
      for (let i = 0; i < steps; i++) {
        s.vy += 55 * step;
        const drag = 1 - 1.8 * step;
        s.vx *= drag; s.vy *= drag;
        s.x += s.vx * step; s.y += s.vy * step;
      }
      return true;
    });
    if ((this.state === 'fizzle' && this.elapsed >= 0.75) || (this.state === 'cast' && this.elapsed >= 1.9)) {
      this.reset();
      return;
    }
    const ring = this.ring();
    if (this.state === 'cast') {
      if (this.elapsed > 0.3 && this.elapsed < 1.3) {
        this.rimAcc += dt * 260;
        while (this.rimAcc >= 1) {
          this.rimAcc--;
          const a = this.random() * Math.PI * 2, speed = 45 + this.random() * 70, out = 8 + this.random() * 20;
          this.sparkV(ring.x + ring.r * Math.cos(a), ring.y + ring.r * Math.sin(a),
            -Math.sin(a) * speed + Math.cos(a) * out, Math.cos(a) * speed + Math.sin(a) * out, 0.2 + this.random() * 0.35);
        }
      }
      if (this.elapsed >= 1.45 && !this.burst) {
        this.burst = true;
        for (let i = 0; i < 320; i++) this.spark(SIZE / 2, SIZE / 2, 30 + this.random() * 160, 0.25 + this.random() * 0.45);
      }
    }
    this.intensity.fill(0);
    this.lines.fill(0);
    const alpha = this.state === 'cast' ? Math.max(0, 1 - this.elapsed / 0.35) : 1;
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1], b = this.points[i];
      let heat = alpha * (0.88 + 0.12 * Math.sin(this.time * 18 + i * 0.45));
      if (this.state !== 'fizzle' && this.random() < 0.03) heat = alpha * 1.45;
      this.line(a.x * SIZE, a.y * SIZE, b.x * SIZE, b.y * SIZE, heat, true);
    }
    const tip = this.points.at(-1);
    if (tip && drawing && this.state === 'draw') this.circle(tip.x * SIZE, tip.y * SIZE, 1.5, 1.4);
    if (this.state === 'cast' && this.elapsed < 1.45) this.mandala(ring.x, ring.y, ring.r, ring.v * this.strength);
    // A fresh halo each frame, around line dots only; sparks never glow into boxes.
    for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) {
      const v = this.lines[y * SIZE + x];
      if (v < 0.3) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && this.random() < 0.14) this.plot(x + dx, y + dy, v * 0.24, false);
      }
    }
    for (const s of this.sparks) this.plot(s.x, s.y, s.life / s.max * 1.25, false);
    this.colour();
  }

  private random(): number {
    this.rng ^= this.rng << 13; this.rng ^= this.rng >>> 17; this.rng ^= this.rng << 5;
    return (this.rng >>> 0) / 0x100000000;
  }
  private spark(x: number, y: number, speed: number, life: number): void {
    const a = this.random() * Math.PI * 2;
    this.sparkV(x, y, Math.cos(a) * speed, Math.sin(a) * speed, life);
  }
  private sparkV(x: number, y: number, vx: number, vy: number, life: number): void {
    if (this.sparks.length < MAX_SPARKS) this.sparks.push({ x, y, vx, vy, life, max: life });
  }
  private plot(x: number, y: number, v: number, line = true): void {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE || v <= 0) return;
    const i = y * SIZE + x;
    this.intensity[i] = Math.max(this.intensity[i], v);
    if (line) this.lines[i] = Math.max(this.lines[i], v);
  }
  private line(x0: number, y0: number, x1: number, y1: number, v: number, thick = false): void {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) + 1;
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      this.plot(x, y, v);
      if (thick) for (const [dx, dy] of STROKE_EDGE) this.plot(x + dx, y + dy, v * 0.9);
    }
  }
  private circle(x: number, y: number, r: number, v: number): void {
    if (r < 1) return;
    const n = Math.ceil(2 * Math.PI * r * 1.6) + 8;
    for (let i = 0; i < n; i++) { const a = 2 * Math.PI * i / n; this.plot(x + r * Math.cos(a), y + r * Math.sin(a), v); }
  }
  private ring(): { x: number; y: number; r: number; v: number } {
    const k = 1 - Math.pow(1 - Math.min(1, this.elapsed / 0.4), 3);
    let r = this.from.r + (SIZE * 0.43 - this.from.r) * k;
    let v = this.elapsed > 0.4 ? 1 + 0.1 * Math.sin(this.elapsed * 9) : k;
    if (this.elapsed > 1.15) { const collapse = Math.pow(Math.min(1, (this.elapsed - 1.15) / 0.3), 3); r *= 1 - collapse; v = 1 + 0.5 * collapse; }
    return { x: this.from.x + (SIZE / 2 - this.from.x) * k, y: this.from.y + (SIZE / 2 - this.from.y) * k, r, v };
  }
  private mandala(cx: number, cy: number, r: number, v: number): void {
    if (r < 1) return;
    const rot = this.elapsed * 1.05;
    for (const [radius, heat] of [[1, 1], [0.955, 0.8], [0.8, 0.9], [0.62, 0.85], [0.26, 1], [0.2, 0.7]]) this.circle(cx, cy, r * radius, v * heat);
    const radial = (r0: number, r1: number, a: number, heat: number) => this.line(cx + r * r0 * Math.cos(a), cy + r * r0 * Math.sin(a), cx + r * r1 * Math.cos(a), cy + r * r1 * Math.sin(a), heat * v);
    for (let i = 0; i < 36; i++) radial(i % 3 === 0 ? 0.64 : 0.7, 0.78, -rot * 1.4 + i * Math.PI / 18, 0.75);
    // The rune band repeats the mark that was drawn, as on the guide and carving.
    for (let i = 0; i < 18; i++) {
      const a = rot + i * Math.PI / 9, x = cx + r * 0.877 * Math.cos(a), y = cy + r * 0.877 * Math.sin(a), s = r * 0.035;
      const pts = this.mark.map(([x, y]) => [(x - 0.5) * 2, (y - 0.5) * 2]);
      for (let j = 1; j < pts.length; j++) this.line(x + pts[j - 1][0] * s, y + pts[j - 1][1] * s, x + pts[j][0] * s, y + pts[j][1] * s, v * (0.85 + 0.15 * Math.sin(this.elapsed * 7 + i * 1.7)));
    }
    for (let k = 0; k < 2; k++) for (let i = 0; i < 4; i++) {
      const a = rot * 0.6 + k * Math.PI / 4 + i * Math.PI / 2, b = a + Math.PI / 2;
      this.line(cx + r * 0.62 * Math.cos(a), cy + r * 0.62 * Math.sin(a), cx + r * 0.62 * Math.cos(b), cy + r * 0.62 * Math.sin(b), v * 0.95);
    }
    for (let i = 0; i < 8; i++) radial(0.26, 0.44, -rot * 2 + i * Math.PI / 4, 0.6);
    // Central falling star.
    for (let i = 0; i < 4; i++) radial(0, 0.12, i * Math.PI / 2, 1.2);
  }
  private colour(): void {
    const ash = this.state === 'fizzle' ? Math.min(1, this.elapsed / 0.25) : 0;
    const fade = this.state === 'fizzle' ? Math.max(0, 1 - this.elapsed / 0.75) : 1;
    const heat = this.heat;
    for (let i = 0; i < this.intensity.length; i++) {
      const v = this.intensity[i], p = i * 4;
      if (v <= 0.08) { this.pixels[p + 3] = 0; continue; }
      let stop = 1;
      while (stop < heat.length - 1 && v > heat[stop][0]) stop++;
      const a = heat[stop - 1], b = heat[stop], t = Math.min(1, Math.max(0, (v - a[0]) / (b[0] - a[0])));
      const r = a[1] + (b[1] - a[1]) * t, g = a[2] + (b[2] - a[2]) * t, blue = a[3] + (b[3] - a[3]) * t;
      const grey = (r + g + blue) / 3 * 0.55;
      this.pixels[p] = r + (grey - r) * ash;
      this.pixels[p + 1] = g + (grey - g) * ash;
      this.pixels[p + 2] = blue + (grey + 10 - blue) * ash;
      this.pixels[p + 3] = 255 * fade;
    }
  }
}
