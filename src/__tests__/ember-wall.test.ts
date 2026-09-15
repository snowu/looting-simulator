import { expect, it } from 'vitest';
import { emberWallTexture } from '../render/ember-wall';

it('keeps recessed furnaces rare and separated by at least two wall panels', () => {
  let vents = 0;
  for (let side = 0; side < 4; side++) for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
    if (emberWallTexture(x, y, side) !== 'wall_emberworks_grate') continue;
    vents++;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if ((!dx && !dy) || Math.abs(dx) + Math.abs(dy) > 2) continue;
      expect(emberWallTexture(x + dx, y + dy, side)).not.toBe('wall_emberworks_grate');
    }
  }
  expect(vents).toBeGreaterThan(0);
  expect(vents / (4 * 40 * 40)).toBeLessThan(0.10);
});
