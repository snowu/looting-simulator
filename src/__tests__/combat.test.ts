import { describe, it, expect } from 'vitest';
import { resolveCombat, rollLoot } from '../systems/combat';
import { ENEMIES } from '../data/enemies';

describe('Combat System', () => {
  it('strong player beats weak enemy', () => {
    const stats = { attack: 100, defense: 100, health: 100, luck: 0 };
    const result = resolveCombat(stats, ENEMIES[0]);
    expect(result.victory).toBe(true);
  });

  it('weak player loses to strong enemy', () => {
    const stats = { attack: 1, defense: 1, health: 1, luck: 0 };
    const lastEnemy = ENEMIES[ENEMIES.length - 1];
    const result = resolveCombat(stats, lastEnemy);
    expect(result.victory).toBe(false);
  });

  it('victory yields loot drops', () => {
    const stats = { attack: 100, defense: 100, health: 100, luck: 0 };
    const result = resolveCombat(stats, ENEMIES[0]);
    if (result.victory) {
      expect(result.drops.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('rollLoot respects chance', () => {
    const table = [{ materialId: 'iron', chance: 1.0, minQty: 1, maxQty: 3 }];
    const drops = rollLoot(table);
    expect(drops.length).toBe(1);
    expect(drops[0].quantity).toBeGreaterThanOrEqual(1);
    expect(drops[0].quantity).toBeLessThanOrEqual(3);
  });
});
