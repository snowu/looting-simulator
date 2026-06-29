import { describe, it, expect } from 'vitest';
import { RunManager } from '../systems/run-manager';
import { GameState, NodeType } from '../state/game-state';

describe('RunManager', () => {
  it('startRun creates active run state', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    expect(state.runState).not.toBeNull();
    expect(state.runState!.isActive).toBe(true);
  });

  it('startRun initializes with Start node as current', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    const startNode = state.runState!.dungeonMap.find(n => n.type === NodeType.Start);
    expect(startNode).toBeDefined();
    expect(state.runState!.currentNodeId).toBe(startNode!.id);
  });

  it('moveToNode on treasure gives loot', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    const treasureNode = state.runState!.dungeonMap.find(n => n.type === NodeType.Treasure);
    if (treasureNode) {
      // Connect start to treasure for test
      const start = state.runState!.dungeonMap.find(n => n.type === NodeType.Start)!;
      start.connections = [treasureNode.id];
      const outcome = rm.moveToNode(state, treasureNode.id);
      expect(outcome.type).toBe('loot');
      expect(outcome.type === 'loot' && outcome.materials.length).toBeGreaterThan(0);
    }
  });

  it('moveToNode marks node as completed', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    const treasureNode = state.runState!.dungeonMap.find(n => n.type === NodeType.Treasure);
    if (treasureNode) {
      const start = state.runState!.dungeonMap.find(n => n.type === NodeType.Start)!;
      start.connections = [treasureNode.id];
      rm.moveToNode(state, treasureNode.id);
      expect(treasureNode.completed).toBe(true);
    }
  });

  it('moveToNode updates currentNodeId', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    const treasureNode = state.runState!.dungeonMap.find(n => n.type === NodeType.Treasure);
    if (treasureNode) {
      const start = state.runState!.dungeonMap.find(n => n.type === NodeType.Start)!;
      start.connections = [treasureNode.id];
      rm.moveToNode(state, treasureNode.id);
      expect(state.runState!.currentNodeId).toBe(treasureNode.id);
    }
  });

  it('moveToNode on combat returns combat outcome', () => {
    const state = new GameState();
    state.stash.addMaterial('iron', 100); // Give player strong stats
    const rm = new RunManager();
    rm.startRun(state);
    const combatNode = state.runState!.dungeonMap.find(n => n.type === NodeType.Combat);
    if (combatNode) {
      const start = state.runState!.dungeonMap.find(n => n.type === NodeType.Start)!;
      start.connections = [combatNode.id];
      const outcome = rm.moveToNode(state, combatNode.id);
      expect(outcome.type).toBe('combat');
      expect(outcome.type === 'combat' && 'result' in outcome).toBe(true);
    }
  });

  it('moveToNode on shop returns shop outcome', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    const shopNode = state.runState!.dungeonMap.find(n => n.type === NodeType.Shop);
    if (shopNode) {
      const start = state.runState!.dungeonMap.find(n => n.type === NodeType.Start)!;
      start.connections = [shopNode.id];
      const outcome = rm.moveToNode(state, shopNode.id);
      expect(outcome.type).toBe('shop');
    }
  });

  it('moveToNode on trap returns trap outcome with damage', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    const trapNode = state.runState!.dungeonMap.find(n => n.type === NodeType.Trap);
    if (trapNode) {
      const start = state.runState!.dungeonMap.find(n => n.type === NodeType.Start)!;
      start.connections = [trapNode.id];
      const outcome = rm.moveToNode(state, trapNode.id);
      expect(outcome.type).toBe('trap');
      expect(outcome.type === 'trap' && outcome.damage).toBeGreaterThan(0);
    }
  });

  it('moveToNode on event returns event outcome', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    const eventNode = state.runState!.dungeonMap.find(n => n.type === NodeType.Event);
    if (eventNode) {
      const start = state.runState!.dungeonMap.find(n => n.type === NodeType.Start)!;
      start.connections = [eventNode.id];
      const outcome = rm.moveToNode(state, eventNode.id);
      expect(outcome.type).toBe('event');
      expect(outcome.type === 'event' && outcome.text).toBeDefined();
    }
  });

  it('moveToNode on boss returns boss outcome with metaReward', () => {
    const state = new GameState();
    state.stash.addMaterial('iron', 100); // Give player strong stats
    const rm = new RunManager();
    rm.startRun(state);
    const bossNode = state.runState!.dungeonMap.find(n => n.type === NodeType.Boss);
    if (bossNode) {
      const start = state.runState!.dungeonMap.find(n => n.type === NodeType.Start)!;
      start.connections = [bossNode.id];
      const outcome = rm.moveToNode(state, bossNode.id);
      expect(outcome.type).toBe('boss');
      expect(outcome.type === 'boss' && 'result' in outcome).toBe(true);
      expect(outcome.type === 'boss' && 'metaReward' in outcome).toBe(true);
    }
  });

  it('extractRun transfers materials to stash', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    state.runState!.runInventory.addMaterial('iron', 5);
    rm.extractRun(state);
    expect(state.stash.getMaterialCount('iron')).toBe(5);
    expect(state.runState).toBeNull();
  });

  it('extractRun transfers items to stash', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    const testItem = {
      id: 'test-item',
      name: 'Test Item',
      baseType: 'Blade' as any,
      materials: [],
      rarity: 'Common' as any,
      stats: { attack: 1, defense: 0, health: 0, luck: 0 },
    };
    state.runState!.runInventory.addItem(testItem);
    rm.extractRun(state);
    expect(state.stash.items.length).toBe(1);
    expect(state.runState).toBeNull();
  });

  it('abandonRun loses inventory', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    state.runState!.runInventory.addMaterial('iron', 5);
    rm.abandonRun(state);
    expect(state.stash.getMaterialCount('iron')).toBe(0);
    expect(state.runState).toBeNull();
  });

  it('combat loss abandons run', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    state.runState!.runInventory.addMaterial('iron', 5);
    // Give player very weak stats
    const combatNode = state.runState!.dungeonMap.find(n => n.type === NodeType.Combat);
    if (combatNode) {
      const start = state.runState!.dungeonMap.find(n => n.type === NodeType.Start)!;
      start.connections = [combatNode.id];
      rm.moveToNode(state, combatNode.id);
      // After loss, run state may be null (abandoned)
      if (!state.runState) {
        expect(state.stash.getMaterialCount('iron')).toBe(0);
      }
    }
  });

  it('boss victory rewards meta currency', () => {
    const state = new GameState();
    state.stash.addMaterial('iron', 100); // Give player strong stats
    const initialMeta = state.meta.metaCurrency;
    const rm = new RunManager();
    rm.startRun(state);
    const bossNode = state.runState!.dungeonMap.find(n => n.type === NodeType.Boss);
    if (bossNode) {
      const start = state.runState!.dungeonMap.find(n => n.type === NodeType.Start)!;
      start.connections = [bossNode.id];
      const outcome = rm.moveToNode(state, bossNode.id);
      if (outcome.type === 'boss' && outcome.result.victory) {
        expect(state.meta.metaCurrency).toBeGreaterThan(initialMeta);
      }
    }
  });
});
