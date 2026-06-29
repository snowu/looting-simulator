import { GameState, RunState, NodeType } from '../state/game-state';
import { generateDungeon } from './dungeon';
import { resolveCombat, CombatResult } from './combat';
import { Inventory } from '../state/inventory';
import { ENEMIES } from '../data/enemies';
import { MATERIALS } from '../data/materials';
import { ItemStats, Enemy } from '../types';

export type NodeOutcome =
  | { type: 'loot'; materials: { materialId: string; quantity: number }[] }
  | { type: 'combat'; result: CombatResult }
  | { type: 'shop' }
  | { type: 'trap'; damage: number }
  | { type: 'event'; text: string }
  | { type: 'boss'; result: CombatResult; metaReward: number };

export class RunManager {
  startRun(state: GameState): void {
    const dungeonMap = generateDungeon(5);
    const startNode = dungeonMap.find(n => n.type === NodeType.Start)!;
    state.runState = {
      dungeonMap,
      currentNodeId: startNode.id,
      runInventory: new Inventory(),
      isActive: true,
    };
  }

  moveToNode(state: GameState, nodeId: string): NodeOutcome {
    const run = state.runState!;
    const node = run.dungeonMap.find(n => n.id === nodeId)!;
    run.currentNodeId = nodeId;
    node.completed = true;

    const playerStats = this.aggregatePlayerStats(state);

    switch (node.type) {
      case NodeType.Treasure: {
        const drops = this.generateTreasure(node.depth);
        for (const d of drops) run.runInventory.addMaterial(d.materialId, d.quantity);
        return { type: 'loot', materials: drops };
      }
      case NodeType.Combat: {
        const enemy = this.pickEnemy(node.depth);
        const result = resolveCombat(playerStats, enemy);
        if (result.victory) {
          for (const d of result.drops) run.runInventory.addMaterial(d.materialId, d.quantity);
        } else {
          this.abandonRun(state);
        }
        return { type: 'combat', result };
      }
      case NodeType.Boss: {
        const boss = ENEMIES[ENEMIES.length - 1];
        const result = resolveCombat(playerStats, boss);
        const metaReward = result.victory ? 10 : 0;
        if (result.victory) {
          state.meta.metaCurrency += metaReward;
          for (const d of result.drops) run.runInventory.addMaterial(d.materialId, d.quantity);
        } else {
          this.abandonRun(state);
        }
        return { type: 'boss', result, metaReward };
      }
      case NodeType.Shop:
        return { type: 'shop' };
      case NodeType.Trap: {
        const damage = 5 + node.depth * 3;
        return { type: 'trap', damage };
      }
      case NodeType.Event:
        return { type: 'event', text: 'You found a mysterious shrine...' };
      default:
        return { type: 'event', text: '' };
    }
  }

  extractRun(state: GameState): void {
    const run = state.runState!;
    for (const [id, qty] of run.runInventory.materials) {
      state.stash.addMaterial(id, qty);
    }
    for (const item of run.runInventory.items) {
      state.stash.addItem(item);
    }
    state.runState = null;
  }

  abandonRun(state: GameState): void {
    state.runState = null;
  }

  private aggregatePlayerStats(state: GameState): ItemStats {
    const playerStats: ItemStats = {
      attack: 10,
      defense: 10,
      health: 50,
      luck: 0,
    };

    for (const item of state.stash.items) {
      playerStats.attack += item.stats.attack;
      playerStats.defense += item.stats.defense;
      playerStats.health += item.stats.health;
      playerStats.luck += item.stats.luck;
    }

    return playerStats;
  }

  private generateTreasure(depth: number): { materialId: string; quantity: number }[] {
    const count = 1 + Math.floor(Math.random() * 2);
    const drops: { materialId: string; quantity: number }[] = [];
    for (let i = 0; i < count; i++) {
      const mat = MATERIALS[Math.floor(Math.random() * MATERIALS.length)];
      drops.push({ materialId: mat.id, quantity: 1 + Math.floor(Math.random() * depth) });
    }
    return drops;
  }

  private pickEnemy(depth: number): Enemy {
    const index = Math.min(depth, ENEMIES.length - 1);
    return ENEMIES[Math.max(0, index - 1)];
  }
}
