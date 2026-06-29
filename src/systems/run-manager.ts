import { GameState, RunState, NodeType } from '../state/game-state';
import { resolveCombat, CombatResult } from './combat';
import { Inventory } from '../state/inventory';
import { ENEMIES } from '../data/enemies';
import { MATERIALS } from '../data/materials';
import { ItemStats, Enemy } from '../types';
import {
  generateMaze,
  Dir,
  DIR_DELTA,
  turnLeft,
  turnRight,
  isWalkable,
  tileAt,
  TileKind,
} from './maze';

const FINAL_DEPTH = 4;

export type NodeOutcome =
  | { type: 'none' }
  | { type: 'loot'; materials: { materialId: string; quantity: number }[] }
  | { type: 'combat'; result: CombatResult }
  | { type: 'shop' }
  | { type: 'trap'; damage: number }
  | { type: 'event'; text: string }
  | { type: 'descend'; depth: number }
  | { type: 'boss'; result: CombatResult; metaReward: number };

export type MoveAction =
  | 'forward'
  | 'back'
  | 'turnLeft'
  | 'turnRight';

export class RunManager {
  startRun(state: GameState): void {
    // Floor 1 is never the boss floor (FINAL_DEPTH > 1).
    const maze = generateMaze(1, false);
    const maxHP = this.aggregatePlayerStats(state).health;
    state.runState = {
      maze,
      playerX: maze.startX,
      playerY: maze.startY,
      facing: Dir.North,
      runInventory: new Inventory(),
      isActive: true,
      playerHP: maxHP,
      playerMaxHP: maxHP,
      depth: 1,
    };
    this.markSeen(state.runState);
  }

  /** Apply a movement action. Returns the encounter outcome if a tile triggered one. */
  move(state: GameState, action: MoveAction): NodeOutcome {
    const run = state.runState;
    if (!run || !run.isActive) return { type: 'none' };

    if (action === 'turnLeft') {
      run.facing = turnLeft(run.facing);
      this.markSeen(run);
      return { type: 'none' };
    }
    if (action === 'turnRight') {
      run.facing = turnRight(run.facing);
      this.markSeen(run);
      return { type: 'none' };
    }

    const moveDir = this.dirForAction(run.facing, action);
    const { dx, dy } = DIR_DELTA[moveDir];
    const nx = run.playerX + dx;
    const ny = run.playerY + dy;

    if (!isWalkable(run.maze, nx, ny)) return { type: 'none' };

    run.playerX = nx;
    run.playerY = ny;
    this.markSeen(run);

    return this.resolveTile(state);
  }

  private dirForAction(facing: Dir, action: MoveAction): Dir {
    switch (action) {
      case 'forward':
        return facing;
      case 'back':
        return ((facing + 2) % 4) as Dir;
      default:
        return facing;
    }
  }

  private resolveTile(state: GameState): NodeOutcome {
    const run = state.runState!;
    const tile = tileAt(run.maze, run.playerX, run.playerY)!;

    if (tile.kind === TileKind.Stairs) {
      return this.descend(state);
    }

    if (tile.kind !== TileKind.Encounter || tile.visited) {
      return { type: 'none' };
    }

    tile.visited = true;
    const playerStats = this.aggregatePlayerStats(state);

    switch (tile.encounter) {
      case NodeType.Treasure: {
        const drops = this.generateTreasure(run.depth);
        for (const d of drops) run.runInventory.addMaterial(d.materialId, d.quantity);
        return { type: 'loot', materials: drops };
      }
      case NodeType.Combat: {
        const enemy = this.pickEnemy(run.depth);
        const result = resolveCombat(playerStats, enemy);
        run.playerHP -= result.playerDamage;
        if (result.victory && run.playerHP > 0) {
          for (const d of result.drops) run.runInventory.addMaterial(d.materialId, d.quantity);
        }
        if (!result.victory || run.playerHP <= 0) {
          run.playerHP = 0;
          result.victory = false;
          this.die(state);
        }
        return { type: 'combat', result };
      }
      case NodeType.Boss: {
        const boss = ENEMIES[ENEMIES.length - 1];
        const result = resolveCombat(playerStats, boss);
        run.playerHP -= result.playerDamage;
        const metaReward = result.victory && run.playerHP > 0 ? 10 : 0;
        if (result.victory && run.playerHP > 0) {
          state.meta.metaCurrency += metaReward;
          for (const d of result.drops) run.runInventory.addMaterial(d.materialId, d.quantity);
          // Boss defeated = run won, auto-extract.
          this.extractRun(state);
        } else {
          run.playerHP = 0;
          result.victory = false;
          this.die(state);
        }
        return { type: 'boss', result, metaReward };
      }
      case NodeType.Shop:
        return { type: 'shop' };
      case NodeType.Trap: {
        const damage = 5 + run.depth * 3;
        run.playerHP -= damage;
        if (run.playerHP <= 0) {
          run.playerHP = 0;
          this.die(state);
        }
        return { type: 'trap', damage };
      }
      case NodeType.Event:
        return { type: 'event', text: 'You found a mysterious shrine...' };
      default:
        return { type: 'none' };
    }
  }

  private descend(state: GameState): NodeOutcome {
    const run = state.runState!;
    const nextDepth = run.depth + 1;
    const isBoss = nextDepth >= FINAL_DEPTH;
    const maze = generateMaze(nextDepth, isBoss);
    run.maze = maze;
    run.depth = nextDepth;
    run.playerX = maze.startX;
    run.playerY = maze.startY;
    run.facing = Dir.North;
    this.markSeen(run);
    return { type: 'descend', depth: nextDepth };
  }

  extractRun(state: GameState): void {
    const run = state.runState!;
    for (const [id, qty] of run.runInventory.materials) {
      state.stash.addMaterial(id, qty);
    }
    for (const item of run.runInventory.items) {
      state.stash.addItem(item);
    }
    run.isActive = false;
  }

  abandonRun(state: GameState): void {
    state.runState = null;
  }

  private die(state: GameState): void {
    const goldLost = Math.floor(state.gold * 0.25);
    state.gold -= goldLost;
    state.runState!.isActive = false;
  }

  /** Mark the player's tile and orthogonal neighbors as seen for the minimap. */
  private markSeen(run: RunState): void {
    const { playerX: x, playerY: y, maze } = run;
    const around = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of around) {
      const t = tileAt(maze, x + dx, y + dy);
      if (t) t.seen = true;
    }
  }

  private aggregatePlayerStats(state: GameState): ItemStats {
    const playerStats: ItemStats = { attack: 10, defense: 10, health: 50, luck: 0 };
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
