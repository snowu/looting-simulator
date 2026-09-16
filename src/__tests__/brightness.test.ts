import { describe, expect, it } from 'vitest';
import {
  BRIGHTNESS_DEFAULT,
  BRIGHTNESS_MAX,
  BRIGHTNESS_MIN,
  applyBrightnessGain,
  brightnessToPercent,
  percentToBrightness,
} from '../render/brightness';

describe('brightness curve', () => {
  it('is identity at the default', () => {
    expect(applyBrightnessGain(0, BRIGHTNESS_DEFAULT)).toBe(0);
    expect(applyBrightnessGain(0.25, BRIGHTNESS_DEFAULT)).toBeCloseTo(0.25, 6);
    expect(applyBrightnessGain(1, BRIGHTNESS_DEFAULT)).toBe(1);
  });

  it('pins black and white at any setting', () => {
    for (const b of [BRIGHTNESS_MIN, 1.25, BRIGHTNESS_MAX]) {
      expect(applyBrightnessGain(0, b)).toBe(0);
      expect(applyBrightnessGain(1, b)).toBe(1);
    }
  });

  it('lifts shadow mids more than highlights when turned up', () => {
    const b = 1.4;
    const shadowLift = applyBrightnessGain(0.06, b) - 0.06;
    const hiLift = applyBrightnessGain(0.8, b) - 0.8;
    expect(shadowLift).toBeGreaterThan(0);
    expect(hiLift).toBeGreaterThan(0);
    expect(shadowLift).toBeGreaterThan(hiLift);
  });

  it('darkens when turned down', () => {
    expect(applyBrightnessGain(0.25, 0.7)).toBeLessThan(0.25);
  });

  it('clamps the slider range', () => {
    expect(percentToBrightness(0)).toBe(BRIGHTNESS_MIN);
    expect(percentToBrightness(999)).toBe(BRIGHTNESS_MAX);
    expect(percentToBrightness(Number.NaN)).toBe(BRIGHTNESS_DEFAULT);
    expect(brightnessToPercent(BRIGHTNESS_MIN)).toBe(Math.round(BRIGHTNESS_MIN * 100));
    expect(brightnessToPercent(BRIGHTNESS_MAX)).toBe(Math.round(BRIGHTNESS_MAX * 100));
    expect(brightnessToPercent(1)).toBe(100);
  });
});
