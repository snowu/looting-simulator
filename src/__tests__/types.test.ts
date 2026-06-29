import { Rarity, RARITY_COLORS, RARITY_ORDER } from '../types';

test('all rarities have colors', () => {
  for (const r of Object.values(Rarity)) {
    expect(RARITY_COLORS[r]).toBeDefined();
  }
});

test('rarity order is ascending', () => {
  expect(RARITY_ORDER[Rarity.Common]).toBeLessThan(RARITY_ORDER[Rarity.Legendary]);
});
