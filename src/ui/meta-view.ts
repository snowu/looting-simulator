import { GameState } from '../state/game-state';
import { META_UPGRADES } from '../systems/meta';

export class MetaView {
  private container: HTMLElement;
  private metaContent: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.metaContent = document.createElement('div');
    this.metaContent.className = 'meta-view';
    this.metaContent.innerHTML = '';
    this.container.appendChild(this.metaContent);
  }

  update(
    state: GameState,
    onPurchase: (upgradeId: string) => void
  ): void {
    const currentLevel = (upgradeId: string): number => {
      return state.meta.upgradeLevels[upgradeId] ?? 0;
    };

    const canAfford = (cost: number): boolean => {
      return state.meta.metaCurrency >= cost;
    };

    const isMaxed = (upgradeId: string, maxLevel: number): boolean => {
      return currentLevel(upgradeId) >= maxLevel;
    };

    const upgradesHtml = META_UPGRADES.map((upgrade) => {
      const level = currentLevel(upgrade.id);
      const maxed = isMaxed(upgrade.id, upgrade.maxLevel);
      const affordable = canAfford(upgrade.cost);
      const btnDisabled = maxed || !affordable;

      return `
        <div class="upgrade-item">
          <div class="upgrade-header">
            <h4>${upgrade.name}</h4>
            <span class="upgrade-level">${level}/${upgrade.maxLevel}</span>
          </div>
          <p class="upgrade-description">${upgrade.description}</p>
          <div class="upgrade-footer">
            <span class="upgrade-cost">${upgrade.cost} meta</span>
            <button
              class="btn-buy-upgrade"
              data-upgrade-id="${upgrade.id}"
              ${btnDisabled ? 'disabled' : ''}
            >
              ${maxed ? 'MAXED' : 'BUY'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.metaContent.innerHTML = `
      <div class="meta-wrapper">
        <h2>Meta Progression</h2>
        <div class="meta-currency-display">
          <span>Meta Currency:</span>
          <span class="meta-currency-value">${state.meta.metaCurrency}</span>
        </div>
        <div class="upgrades-grid">
          ${upgradesHtml}
        </div>
        <button id="btn-continue" class="btn-continue">Continue</button>
      </div>
    `;

    this.metaContent.querySelectorAll('.btn-buy-upgrade').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const upgradeId = (e.target as HTMLElement).dataset.upgradeId;
        if (upgradeId) {
          onPurchase(upgradeId);
          this.update(state, onPurchase);
        }
      });
    });
  }

  show(): void {
    this.metaContent.style.display = 'flex';
  }

  hide(): void {
    this.metaContent.style.display = 'none';
  }
}
