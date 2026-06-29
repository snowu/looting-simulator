import { GameState } from '../state/game-state';

export class HUD {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  update(state: GameState): void {
    const phase = state.runState?.isActive ? 'In Dungeon' : 'Idle';
    this.container.innerHTML = `
      <div class="hud">
        <h3>Status</h3>
        <div class="hud-row"><span>Gold:</span> <span class="gold-value">${state.gold}</span></div>
        <div class="hud-row"><span>Meta Currency:</span> <span>${state.meta.metaCurrency}</span></div>
        <div class="hud-row"><span>Phase:</span> <span>${phase}</span></div>
        <div class="hud-row"><span>Gear Tier:</span> <span>${state.meta.startingGearTier}</span></div>
      </div>
    `;
  }
}
