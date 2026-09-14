import { describe, expect, it } from 'vitest';
import { blueprintDropWeight, recipe } from '../data/recipes';

const CATALYST = { label: 'Catalyst', categories: ['gem'], qty: 1, optional: true };

describe('weapon recipes', () => {
  it.each([
    ['r_halberd', 'halberd', false, 240, 0.16, [{ label: 'Head', categories: ['metal'], qty: 4 }, { label: 'Shaft', categories: ['wood'], qty: 4 }, CATALYST]],
    ['r_great_maul', 'great_maul', false, 250, 0.16, [{ label: 'Head', categories: ['metal', 'wood'], qty: 5 }, { label: 'Haft', categories: ['wood'], qty: 4 }, CATALYST]],
    ['r_greatsword', 'greatsword', false, 340, 0.16, [{ label: 'Blade', categories: ['metal'], qty: 7 }, { label: 'Grip', categories: ['wood', 'hide'], qty: 2 }, CATALYST]],
    ['r_throwing_knives', 'throwing_knives', true, 0, undefined, [{ label: 'Blades', categories: ['metal'], qty: 2 }, { label: 'Bandolier', categories: ['hide', 'cloth'], qty: 1 }, CATALYST]],
    ['r_throwing_axes', 'throwing_axes', false, 130, undefined, [{ label: 'Heads', categories: ['metal', 'wood'], qty: 3 }, { label: 'Hafts', categories: ['wood'], qty: 2 }, CATALYST]],
    ['r_javelins', 'javelins', false, 210, undefined, [{ label: 'Heads', categories: ['metal'], qty: 3 }, { label: 'Shafts', categories: ['wood'], qty: 4 }, CATALYST]],
  ])('defines %s exactly', (id, baseId, starter, value, blueprintWeight, slots) => {
    const actual = recipe(id as string);
    expect(actual).toMatchObject({ baseId, starter, value, slots });
    expect(actual.blueprintWeight).toBe(blueprintWeight);
  });

  it('uses explicit scarcity for singleton two-handed blueprints', () => {
    expect(blueprintDropWeight(recipe('r_halberd'))).toBe(0.16);
    expect(blueprintDropWeight(recipe('r_great_maul'))).toBe(0.16);
    expect(blueprintDropWeight(recipe('r_greatsword'))).toBe(0.16);
    expect(blueprintDropWeight(recipe('r_throwing_knives'))).toBe(1);
    expect(blueprintDropWeight(recipe('r_throwing_axes'))).toBe(0.4);
    expect(blueprintDropWeight(recipe('r_javelins'))).toBeCloseTo(0.16);
  });
});
