import { describe, expect, it } from 'vitest';
import { META_UPGRADES, nextCost } from '../systems/meta';

describe("Warden's Vigil", () => {
  it('has the specified levels and costs', () => {
    const upgrade = META_UPGRADES.find((entry) => entry.id === 'attunement');
    expect(upgrade).toEqual({
      id: 'attunement',
      name: "Warden's Vigil",
      description: 'Each kill takes 25% more off your sigil per level.',
      costs: [6, 12, 20],
    });
    expect(nextCost(upgrade!, {})).toBe(6);
    expect(nextCost(upgrade!, { attunement: 1 })).toBe(12);
    expect(nextCost(upgrade!, { attunement: 2 })).toBe(20);
    expect(nextCost(upgrade!, { attunement: 3 })).toBeNull();
  });
});
