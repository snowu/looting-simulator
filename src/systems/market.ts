import { Item, Rarity } from '../types';
import { MATERIALS } from '../data/materials';

const BASE_PRICES: Record<Rarity, number> = {
  [Rarity.Common]: 10,
  [Rarity.Uncommon]: 25,
  [Rarity.Rare]: 60,
  [Rarity.Epic]: 150,
  [Rarity.Legendary]: 400,
};

export interface MarketEvent {
  id: string;
  name: string;
  description: string;
  priceModifiers: Map<string, number>;
  duration: number;
  remaining: number;
}

export class Market {
  prices: Map<string, number> = new Map();
  priceHistory: Map<string, number[]> = new Map();
  activeEvent: MarketEvent | null = null;

  constructor() {
    for (const mat of MATERIALS) {
      const base = BASE_PRICES[mat.rarity];
      this.prices.set(mat.id, base);
      this.priceHistory.set(mat.id, [base]);
    }
  }

  getPrice(materialId: string): number {
    return this.prices.get(materialId) ?? 0;
  }

  tick(): void {
    for (const mat of MATERIALS) {
      const base = BASE_PRICES[mat.rarity];
      const current = this.prices.get(mat.id)!;
      const drift = (Math.random() - 0.5) * base * 0.2;
      const eventMod = this.activeEvent?.priceModifiers.get(mat.id) ?? 1;
      const newPrice = Math.max(1, Math.round((current + drift) * eventMod));
      this.prices.set(mat.id, newPrice);
      this.priceHistory.get(mat.id)!.push(newPrice);
    }
    if (this.activeEvent) {
      this.activeEvent.remaining--;
      if (this.activeEvent.remaining <= 0) this.activeEvent = null;
    }
  }

  buyMaterial(id: string, qty: number): { cost: number } | null {
    const price = this.prices.get(id);
    if (price === undefined) return null;
    return { cost: price * qty };
  }

  sellMaterial(id: string, qty: number): number {
    const price = this.prices.get(id) ?? 0;
    return Math.round(price * qty * 0.8);
  }

  sellItem(item: Item): number {
    const baseValue = BASE_PRICES[item.rarity];
    const statSum = item.stats.attack + item.stats.defense + item.stats.health + item.stats.luck;
    return Math.round(baseValue + statSum * 2);
  }
}
