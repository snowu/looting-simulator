import { ItemStats, Enemy, LootDrop } from '../types';

export interface CombatResult {
  victory: boolean;
  playerDamage: number;
  drops: { materialId: string; quantity: number }[];
}

export function resolveCombat(playerStats: ItemStats, enemy: Enemy): CombatResult {
  const playerPower = playerStats.attack + playerStats.defense + playerStats.health;
  const enemyPower = enemy.stats.attack + enemy.stats.defense + enemy.stats.health;

  const playerDamage = Math.max(0, enemy.stats.attack - playerStats.defense * 0.5);
  const victory = playerPower > enemyPower * 0.7;

  const drops = victory ? rollLoot(enemy.lootTable) : [];

  return { victory, playerDamage, drops };
}

export function rollLoot(lootTable: LootDrop[]): { materialId: string; quantity: number }[] {
  const drops: { materialId: string; quantity: number }[] = [];
  for (const drop of lootTable) {
    if (Math.random() <= drop.chance) {
      const quantity = drop.minQty + Math.floor(Math.random() * (drop.maxQty - drop.minQty + 1));
      drops.push({ materialId: drop.materialId, quantity });
    }
  }
  return drops;
}
