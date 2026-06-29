import { Market } from '../systems/market';
import { GameState } from '../state/game-state';
import { MATERIALS } from '../data/materials';
import { RARITY_COLORS } from '../types';

export class MarketView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  update(
    market: Market,
    state: GameState,
    onBuy: (materialId: string) => void,
    onSell: (materialId: string) => void,
  ): void {
    let html = '<div class="market-view"><h3>Market</h3>';

    if (market.activeEvent) {
      html += `<div class="market-event">${market.activeEvent.name} (${market.activeEvent.remaining} ticks)</div>`;
    }

    html += '<ul class="market-list">';
    for (const mat of MATERIALS) {
      const price = market.getPrice(mat.id);
      const history = market.priceHistory.get(mat.id) ?? [];
      const trend = this.getTrend(history);
      const color = RARITY_COLORS[mat.rarity];
      const owned = state.stash.getMaterialCount(mat.id);

      html += `<li class="market-item">
        <span style="color:${color}">${mat.name}</span>
        <span class="market-price">${price}g ${trend}</span>
        <span class="market-owned">(${owned})</span>
        <button class="btn-buy" data-mat="${mat.id}">Buy</button>
        <button class="btn-sell" data-mat="${mat.id}" ${owned <= 0 ? 'disabled' : ''}>Sell</button>
      </li>`;
    }
    html += '</ul></div>';

    this.container.innerHTML = html;

    this.container.querySelectorAll('.btn-buy').forEach(btn => {
      btn.addEventListener('click', () => {
        onBuy((btn as HTMLElement).dataset.mat!);
      });
    });
    this.container.querySelectorAll('.btn-sell').forEach(btn => {
      btn.addEventListener('click', () => {
        onSell((btn as HTMLElement).dataset.mat!);
      });
    });
  }

  private getTrend(history: number[]): string {
    if (history.length < 2) return '→';
    const recent = history.slice(-3);
    const first = recent[0];
    const last = recent[recent.length - 1];
    if (last > first) return '↑';
    if (last < first) return '↓';
    return '→';
  }
}
