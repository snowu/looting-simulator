import { ItemStats, Enemy, LootDrop } from '../types';

export interface CombatResult {
  victory: boolean; // mutable — can be overridden if player dies from HP loss
  playerDamage: number;
  drops: { materialId: string; quantity: number }[];
}

export function resolveCombat(playerStats: ItemStats, enemy: Enemy): CombatResult {
  const rounds = 3 + Math.floor(Math.random() * 3);
  let playerHP = playerStats.health;
  let enemyHP = enemy.stats.health;
  let totalPlayerDamage = 0;

  for (let i = 0; i < rounds && playerHP > 0 && enemyHP > 0; i++) {
    const playerHit = Math.max(1, playerStats.attack - enemy.stats.defense * 0.4 + Math.floor(Math.random() * 6) - 3);
    enemyHP -= playerHit;

    if (enemyHP > 0) {
      const enemyHit = Math.max(1, enemy.stats.attack - playerStats.defense * 0.4 + Math.floor(Math.random() * 6) - 3);
      playerHP -= enemyHit;
      totalPlayerDamage += enemyHit;
    }
  }

  const victory = enemyHP <= 0;
  const luckBonus = Math.random() * 100 < playerStats.luck;
  const drops = victory ? rollLoot(enemy.lootTable) : [];
  if (victory && luckBonus && drops.length > 0) {
    drops[0].quantity += 1;
  }

  return { victory, playerDamage: totalPlayerDamage, drops };
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
