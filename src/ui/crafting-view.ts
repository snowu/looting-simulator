import { GameState } from '../state/game-state';
import { Recipe, RARITY_COLORS } from '../types';
import { MATERIALS } from '../data/materials';

export class CraftingView {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  update(
    state: GameState,
    recipes: Recipe[],
    onCraft: (recipe: Recipe) => void,
  ): void {
    const discovered = recipes.filter(r => r.discovered);

    let html = '<div class="crafting-view"><h3>Crafting</h3>';

    if (discovered.length === 0) {
      html += '<div class="inv-empty">No recipes discovered</div>';
    } else {
      html += '<ul class="recipe-list">';
      for (const recipe of discovered) {
        const canCraft = state.stash.hasMaterials(recipe.ingredients);
        let ingredientsHtml = '';
        for (const ing of recipe.ingredients) {
          const mat = MATERIALS.find(m => m.id === ing.materialId);
          const name = mat ? mat.name : ing.materialId;
          const have = state.stash.getMaterialCount(ing.materialId);
          const color = have >= ing.quantity ? '#4a9a5a' : '#a33';
          ingredientsHtml += `<span style="color:${color}">${name} ${have}/${ing.quantity}</span> `;
        }

        html += `<li class="recipe-item">
          <div class="recipe-name">${recipe.name} (${recipe.baseType})</div>
          <div class="recipe-ingredients">${ingredientsHtml}</div>
          <button class="btn-craft" data-recipe="${recipe.id}" ${canCraft ? '' : 'disabled'}>Craft</button>
        </li>`;
      }
      html += '</ul>';
    }
    html += '</div>';

    this.container.innerHTML = html;

    this.container.querySelectorAll('.btn-craft').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.recipe!;
        const recipe = recipes.find(r => r.id === id);
        if (recipe) onCraft(recipe);
      });
    });
  }
}
