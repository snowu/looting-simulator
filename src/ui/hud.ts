import { GameState } from '../state/game-state';

export class HUD {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  update(state: GameState): void {
    const run = state.runState;
    const phase = run?.isActive ? 'In Dungeon' : 'Idle';
    const hpBar = run?.isActive
      ? `<div class="hud-row"><span>HP:</span> <span style="color:${run.playerHP < run.playerMaxHP * 0.3 ? '#ff4444' : run.playerHP < run.playerMaxHP * 0.6 ? '#ffaa00' : '#4a9a5a'}">${run.playerHP} / ${run.playerMaxHP}</span></div>`
      : '';
    this.container.innerHTML = `
      <div class="hud">
        <h3>Status</h3>
        <div class="hud-row"><span>Gold:</span> <span class="gold-value">${state.gold}</span></div>
        ${hpBar}
        <div class="hud-row"><span>Meta Currency:</span> <span>${state.meta.metaCurrency}</span></div>
        <div class="hud-row"><span>Phase:</span> <span>${phase}</span></div>
      </div>
    `;
  }
}
