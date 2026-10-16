import { describe, it, expect } from 'vitest';
import { RITES, rite } from '../data/rites';
import { recogniseRite } from '../systems/rite-draw';
import { StickMotion, motionDistance, motionLabel, motionOf, readMotion, reverseMotion, type MotionToken } from '../systems/rite-motion';

const templates = RITES.map((r) => r.template);

/** Push the stick out along each direction and let it spring home. */
function flicks(m: StickMotion, dirs: number[]): void {
  for (const d of dirs) {
    const a = (d * Math.PI) / 4;
    m.sample(0.4 * Math.cos(a), 0.4 * Math.sin(a));
    m.sample(0.95 * Math.cos(a), 0.95 * Math.sin(a));
    m.sample(0.1 * Math.cos(a), 0.1 * Math.sin(a));
    m.sample(0, 0);
  }
}

/** Roll the stick a full turn while it is held out, then let go. */
function roll(m: StickMotion, clockwise = true): void {
  for (let k = 0; k <= 36; k++) {
    const a = (clockwise ? 1 : -1) * (k / 36) * 2 * Math.PI - Math.PI / 2;
    m.sample(0.95 * Math.cos(a), 0.95 * Math.sin(a));
  }
  m.sample(0, 0);
}

describe('the motion that makes each mark', () => {
  it('derives a flick per leg from the templates, and a roll for the circle', () => {
    expect(RITES.map((r) => motionLabel(motionOf(r.template)))).toEqual(['↘ ↗', '→ ↙ →', '↘ ← ↗', '⟳']);
  });

  it('keeps the four marks apart: none is one slip from another', () => {
    const motions = RITES.map((r) => motionOf(r.template));
    for (let i = 0; i < motions.length; i++) for (let j = 0; j < motions.length; j++) {
      if (i === j) continue;
      const d = Math.min(motionDistance(motions[i], motions[j]), motionDistance(motions[i], reverseMotion(motions[j])));
      expect(d, `${RITES[i].id} vs ${RITES[j].id}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('reads either way round, full when exact, half for one slip, a botch past that', () => {
    const read = (made: MotionToken[]) => readMotion(made, RITES);
    expect(read([1, 7])).toMatchObject({ def: rite('meteor'), grade: 'full' });
    expect(read([3, 5])).toMatchObject({ def: rite('meteor'), grade: 'full' });
    expect(read([4, 7, 4])).toMatchObject({ def: rite('glacial_tomb'), grade: 'full' });
    expect(read([3, 0, 5])).toMatchObject({ def: rite('judgement'), grade: 'full' });
    expect(read(['roll'])).toMatchObject({ def: rite('penguining'), grade: 'full' });
    // A neighbouring direction is half a slip; a wrong or extra flick a whole one.
    expect(read([2, 7])).toMatchObject({ def: rite('meteor'), grade: 'weak' });
    expect(read([0, 3, 0, 0])).toMatchObject({ def: rite('glacial_tomb'), grade: 'weak' });
    expect(read([6, 6, 6])?.grade).toBe('botch');
    expect(read([])).toBeUndefined();
  });

  it('only reads as a rite you know', () => {
    expect(readMotion([1, 7], [rite('judgement')])).toMatchObject({ def: rite('judgement'), grade: 'weak' });
  });
});

describe('reading the stick', () => {
  it('counts a flick when the stick springs home, at the direction it reached', () => {
    const m = new StickMotion(templates);
    flicks(m, [1, 7]);
    expect(m.tokens).toEqual([1, 7]);
  });

  it('ignores a nudge that never leaves the dead zone', () => {
    const m = new StickMotion(templates);
    m.sample(0.5, 0);
    m.sample(0, 0);
    expect(m.tokens).toEqual([]);
  });

  it('reads a slide round the rim as two flicks, and a full turn as a roll, either way', () => {
    const slide = new StickMotion(templates);
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI / 4 - (k / 10) * (Math.PI / 2);
      slide.sample(0.95 * Math.cos(a), 0.95 * Math.sin(a));
    }
    slide.sample(0, 0);
    expect(slide.tokens).toEqual([1, 7]);
    for (const cw of [true, false]) {
      const m = new StickMotion(templates);
      roll(m, cw);
      expect(m.tokens).toEqual(['roll']);
    }
  });

  it('counts a flick still held out as the trace closes', () => {
    const m = new StickMotion(templates);
    flicks(m, [1]);
    m.sample(0.7, -0.7);
    expect(m.tokens).toEqual([1]);
    expect(m.flush().length).toBeGreaterThan(0);
    expect(m.tokens).toEqual([1, 7]);
  });
});

describe('what the tablet shows', () => {
  it('lays the mark itself for a clean motion, so the drawn reading agrees', () => {
    for (const def of RITES) {
      const m = new StickMotion(templates);
      const motion = motionOf(def.template);
      if (motion[0] === 'roll') roll(m);
      else flicks(m, motion as number[]);
      expect(recogniseRite(m.points, RITES)).toMatchObject({ def, grade: 'full' });
    }
  });

  it('lays the guide under a clean stroke, either way round', () => {
    for (const [def, made] of [['meteor', [1, 7]], ['meteor', [3, 5]], ['judgement', [3, 0, 5]], ['glacial_tomb', [4, 7, 4]]] as const) {
      const m = new StickMotion(templates);
      flicks(m, [...made]);
      const guide = m.guide(rite(def).template);
      expect(guide[0].x).toBeCloseTo(m.points[0].x, 5);
      expect(guide[0].y).toBeCloseTo(m.points[0].y, 5);
      const end = m.points[m.points.length - 1], last = guide[guide.length - 1];
      expect(Math.hypot(end.x - last.x, end.y - last.y), def).toBeLessThan(0.06);
    }
  });

  it('only ever appends, and keeps every point on the tablet', () => {
    const m = new StickMotion(templates);
    const seen = m.points;
    flicks(m, [6, 6, 6, 6, 6, 6]);
    expect(m.points).toBe(seen);
    expect(m.points.length).toBeGreaterThan(6);
    for (const p of m.points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });
});
