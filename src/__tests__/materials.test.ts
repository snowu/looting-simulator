import { describe, expect, it } from 'vitest';
import { catalystAffixBonus, material } from '../data/materials';
import { Rarity } from '../types';

describe('Wardstone', () => {
  it('provides focus and guarantees of the Vigil', () => {
    const wardstone = material('wardstone');
    expect(wardstone).toEqual({
      id: 'wardstone',
      name: 'Wardstone',
      category: 'gem',
      tier: 3,
      rarity: Rarity.Rare,
      value: 98,
      icon: 'ic_gem',
      ramp: ['#1a0a2e', '#3e1a6a', '#7040b0', '#c8a0f0'],
      mods: { focus: 4 },
      catalystAffix: 'vigil',
      description: 'Catalyst: grants of the Vigil (+Spell Focus).',
    });
    expect(catalystAffixBonus(wardstone)).toBe(2);
  });
});
