import { Inventory } from './inventory';
import { MazeFloor, Dir } from '../systems/maze';

export interface MetaProgress {
  metaCurrency: number;
  discoveredRecipes: string[];
  unlockedBiomes: string[];
  startingGearTier: number;
  marketPerks: string[];
  upgradeLevels: Record<string, number>;
}

export class GameState {
  stash: Inventory = new Inventory();
  gold: number = 100;
  meta: MetaProgress = {
    metaCurrency: 0,
    discoveredRecipes: [],
    unlockedBiomes: ['caverns'],
    startingGearTier: 0,
    marketPerks: [],
    upgradeLevels: {},
  };
  runState: RunState | null = null;
}

export interface RunState {
  maze: MazeFloor;
  playerX: number;
  playerY: number;
  facing: Dir;
  runInventory: Inventory;
  isActive: boolean;
  playerHP: number;
  playerMaxHP: number;
  depth: number;
}

export interface DungeonNode {
  id: string;
  type: NodeType;
  depth: number;
  connections: string[];
  completed: boolean;
}

export enum NodeType {
  Treasure = 'Treasure',
  Combat = 'Combat',
  Shop = 'Shop',
  Trap = 'Trap',
  Event = 'Event',
  Boss = 'Boss',
  Start = 'Start',
}
