import { describe, expect, it } from 'vitest';
import { RiteFire } from '../render/rite-fire';
import { RITES } from '../data/rites';

const mark = RITES[0].template.map(([x, y]) => ({ x, y }));
const alpha = (fire: RiteFire) => fire.pixels.filter((_, i) => i % 4 === 3).some(v => v > 0);
const advance = (fire: RiteFire, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) fire.update(1 / 60);
};

describe('claudemancy fire for rites', () => {
  it('animates the stroke while held and clears ink and particles on retry/cancel', () => {
    const fire = new RiteFire();
    fire.trace(mark);
    fire.update(1 / 60, true);
    expect(alpha(fire)).toBe(true);
    const before = fire.pixels.slice();
    advance(fire, 0.2);
    expect(fire.pixels).not.toEqual(before);
    fire.trace([]);
    fire.update(1 / 60);
    expect(alpha(fire)).toBe(false);
    fire.reset();
    expect(fire.visible).toBe(false);
  });

  it('finishes a successful cast independently of the closed drawing surface', () => {
    const fire = new RiteFire();
    fire.trace(mark);
    fire.finish(mark, 'full');
    advance(fire, 0.8);
    expect(fire.finishing).toBe(true);
    expect(alpha(fire)).toBe(true);
    advance(fire, 1.2);
    expect(fire.visible).toBe(false);
    expect(alpha(fire)).toBe(false);
  });

  it('ends on wall time even when the browser misses frames', () => {
    const fire = new RiteFire();
    fire.finish(mark, 'full');
    fire.update(2);
    expect(fire.visible).toBe(false);
  });

  it('turns a botch to ash and removes the effect without leaving a canvas up', () => {
    const fire = new RiteFire();
    fire.finish(mark, 'botch');
    advance(fire, 0.3);
    let coloured = 0;
    for (let i = 0; i < fire.pixels.length; i += 4) {
      if (fire.pixels[i + 3]) {
        coloured++;
        expect(Math.abs(fire.pixels[i] - fire.pixels[i + 1])).toBeLessThanOrEqual(1);
      }
    }
    expect(coloured).toBeGreaterThan(0);
    advance(fire, 0.5);
    expect(fire.visible).toBe(false);
    expect(alpha(fire)).toBe(false);
  });
});
