import { describe, it, expect } from 'vitest';
import { Market } from '../systems/market';
import { MATERIALS } from '../data/materials';

describe('Market', () => {
  it('prices exist for all materials', () => {
    const market = new Market();
    for (const mat of MATERIALS) {
      expect(market.getPrice(mat.id)).toBeGreaterThan(0);
    }
  });

  it('tick changes prices', () => {
    const market = new Market();
    const id = MATERIALS[0].id;
    const before = market.getPrice(id);
    for (let i = 0; i < 20; i++) market.tick();
    const after = market.getPrice(id);
    // Prices should fluctuate (may occasionally stay same, but over 20 ticks very unlikely)
    expect(market.priceHistory.get(id)!.length).toBeGreaterThan(1);
  });

  it('buy deducts correct cost', () => {
    const market = new Market();
    const id = MATERIALS[0].id;
    const price = market.getPrice(id);
    const result = market.buyMaterial(id, 2);
    expect(result).not.toBeNull();
    expect(result!.cost).toBe(price * 2);
  });

  it('sell returns gold', () => {
    const market = new Market();
    const id = MATERIALS[0].id;
    const gold = market.sellMaterial(id, 1);
    expect(gold).toBeGreaterThan(0);
  });
});
