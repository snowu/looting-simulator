import { GameState } from '../state/game-state';
import { Item, RARITY_COLORS } from '../types';
import { MATERIALS } from '../data/materials';

export class InventoryView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  update(state: GameState, onSelectItem: (item: Item) => void): void {
    const items = state.stash.items;
    const materials = state.stash.materials;

    let html = '<div class="inventory-view"><h3>Inventory</h3>';

    // Items
    html += '<div class="inv-section"><h4>Items</h4>';
    if (items.length === 0) {
      html += '<div class="inv-empty">No items</div>';
    } else {
      html += '<ul class="inv-list">';
      for (const item of items) {
        const color = RARITY_COLORS[item.rarity];
        html += `<li class="inv-item" data-item-id="${item.id}" style="color:${color};cursor:pointer">${item.name} <span class="item-type">(${item.baseType})</span></li>`;
      }
      html += '</ul>';
    }
    html += '</div>';

    // Materials
    html += '<div class="inv-section"><h4>Materials</h4>';
    if (materials.size === 0) {
      html += '<div class="inv-empty">No materials</div>';
    } else {
      html += '<ul class="inv-list">';
      for (const [id, count] of materials) {
        const mat = MATERIALS.find(m => m.id === id);
        const name = mat ? mat.name : id;
        const color = mat ? RARITY_COLORS[mat.rarity] : '#eee';
        html += `<li style="color:${color}">${name}: ${count}</li>`;
      }
      html += '</ul>';
    }
    html += '</div></div>';

    this.container.innerHTML = html;

    // Attach click handlers
    const itemEls = this.container.querySelectorAll('.inv-item');
    itemEls.forEach(el => {
      el.addEventListener('click', () => {
        const id = (el as HTMLElement).dataset.itemId!;
        const item = items.find(i => i.id === id);
        if (item) onSelectItem(item);
      });
    });
  }
}
