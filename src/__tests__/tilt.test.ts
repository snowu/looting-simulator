import { describe, expect, it } from 'vitest';
import { TILT_OFF_DEG, TILT_ON_DEG, tiltDir, tiltRoll } from '../ui/tilt';
import { sideMove } from '../ui/touch-prefs';

describe('tilt roll', () => {
  it('reads zero when the phone is level, in every orientation', () => {
    for (const angle of [0, 90, 180, 270]) expect(tiltRoll(0, 0, angle)).toBeCloseTo(0, 6);
  });

  it('portrait: right edge down (gamma > 0) is a roll to the right', () => {
    expect(tiltRoll(0, 30, 0)).toBeCloseTo(30, 4);
    expect(tiltRoll(0, -30, 0)).toBeCloseTo(-30, 4);
  });

  it('landscape steers on the other axis, and the two landscapes run opposite ways', () => {
    // Rotated 90° counter-clockwise, the device's bottom is the screen's right edge.
    expect(tiltRoll(30, 0, 90)).toBeCloseTo(30, 4);
    expect(tiltRoll(30, 0, 270)).toBeCloseTo(-30, 4);
    // Gamma is the pitch axis in landscape, so it steers nothing.
    expect(tiltRoll(0, 30, 90)).toBeCloseTo(0, 4);
  });

  it('ignores how far the phone is pitched towards you', () => {
    // Portrait, held up at various angles, rolled 25° right.
    const flat = tiltRoll(0, 25, 0);
    for (const beta of [20, 45, 60]) expect(Math.sign(tiltRoll(beta, 25, 0))).toBe(Math.sign(flat));
    expect(tiltRoll(60, 0, 0)).toBeCloseTo(0, 6);
  });
});

describe('tilt direction', () => {
  it('needs a clear roll to start and holds until it comes back well inside', () => {
    expect(tiltDir(TILT_ON_DEG - 1, null)).toBe(null);
    expect(tiltDir(TILT_ON_DEG, null)).toBe('right');
    expect(tiltDir(-TILT_ON_DEG, null)).toBe('left');
    expect(tiltDir(TILT_OFF_DEG + 1, 'right')).toBe('right');
    expect(tiltDir(TILT_OFF_DEG, 'right')).toBe(null);
  });

  it('a hard roll the other way switches sides at once', () => {
    expect(tiltDir(-TILT_ON_DEG, 'right')).toBe('left');
  });
});

describe('side moves', () => {
  it('the pad turns and the extras strafe by default', () => {
    expect(sideMove('left', 'pad', 'turn')).toBe('turnLeft');
    expect(sideMove('right', 'extra', 'turn')).toBe('right');
  });

  it('swapped, the pad strafes and the extras turn', () => {
    expect(sideMove('left', 'pad', 'strafe')).toBe('left');
    expect(sideMove('right', 'extra', 'strafe')).toBe('turnRight');
  });
});
