import { describe, expect, it } from 'vitest';
import { getArt } from '../art/registry';
import { rasterize } from '../art/raster';
import { enemyDef } from '../data/enemies';
import { findMaterial } from '../data/materials';
import { SHADE_ID } from '../systems/grave';
import { SHADE_HANDS, composeShade, shadeKey } from '../render/shade';

const opaque = (d: Uint8ClampedArray) => d.filter((_, i) => i % 4 === 3 && d[i] > 0).length;

describe('your Shade', () => {
  it('has a body of its own, not the Hollow Knight', () => {
    expect(enemyDef(SHADE_ID).sprite).toBe('shade');
    expect(getArt('shade_0')).toBeDefined();
    expect(getArt('shade_atk')).toBeDefined();
  });

  it('with nothing equipped is just the dark figure', () => {
    expect(composeShade('0').data).toEqual(rasterize(getArt('shade_0')!).data);
  });

  it('holds your weapon at its hand and your shield on its arm, in their materials', () => {
    const bare = composeShade('0');
    const sword = { icon: 'ic_long_sword', ramp: findMaterial('iron')!.ramp };
    const buckler = { icon: 'ic_buckler', ramp: findMaterial('timber')!.ramp };
    const kitted = composeShade('0', sword, buckler);
    expect(opaque(kitted.data)).toBeGreaterThan(opaque(bare.data) + 40);
    // The material shows: the iron ramp's light end is on the blade.
    const light = findMaterial('iron')!.ramp[3].slice(1);
    const hex = (i: number) => [0, 1, 2].map((k) => kitted.data[i + k].toString(16).padStart(2, '0')).join('');
    let found = false;
    for (let i = 0; i < kitted.data.length; i += 4) if (hex(i) === light) found = true;
    expect(found).toBe(true);
    // The fist closes over the grip.
    const [hx, hy] = SHADE_HANDS['0'].weapon;
    expect(kitted.data[(hy * kitted.w + hx) * 4 + 3]).toBeGreaterThan(0);
    expect(kitted.data[(hy * kitted.w + hx) * 4]).toBe(0x0c);
  });

  it('keys its textures by frame and by kit', () => {
    const a = shadeKey('0', { icon: 'ic_mace', ramp: findMaterial('iron')!.ramp });
    const b = shadeKey('0', { icon: 'ic_mace', ramp: findMaterial('gold')!.ramp });
    expect(a).not.toBe(b);
    expect(shadeKey('atk')).not.toBe(shadeKey('0'));
  });
});
