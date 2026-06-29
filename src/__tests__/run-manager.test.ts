import { describe, it, expect } from 'vitest';
import { RunManager, NodeOutcome } from '../systems/run-manager';
import { GameState, NodeType } from '../state/game-state';
import { Dir, TileKind, isWalkable, MazeFloor } from '../systems/maze';

/**
 * Find an encounter tile of the given type, place the player on a walkable
 * orthogonal neighbor facing it, then move forward onto it. Returns the
 * outcome, or null if no such tile exists in this random maze.
 */
function stepOntoEncounter(
  rm: RunManager,
  state: GameState,
  type: NodeType
): NodeOutcome | null {
  const maze = state.runState!.maze;
  const target = findEncounter(maze, type);
  if (!target) return null;
  if (!placeFacing(state, maze, target.x, target.y)) return null;
  return rm.move(state, 'forward');
}

function findEncounter(maze: MazeFloor, type: NodeType): { x: number; y: number } | null {
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const t = maze.tiles[y * maze.width + x];
      if (t.kind === TileKind.Encounter && t.encounter === type && !t.visited) {
        return { x, y };
      }
    }
  }
  return null;
}

function findTile(maze: MazeFloor, kind: TileKind): { x: number; y: number } | null {
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      if (maze.tiles[y * maze.width + x].kind === kind) return { x, y };
    }
  }
  return null;
}

/** Place player on a walkable neighbor of (tx,ty) facing it. */
function placeFacing(state: GameState, maze: MazeFloor, tx: number, ty: number): boolean {
  const neighbors: { x: number; y: number; dir: Dir }[] = [
    { x: tx, y: ty + 1, dir: Dir.North }, // stand south, face north
    { x: tx, y: ty - 1, dir: Dir.South },
    { x: tx - 1, y: ty, dir: Dir.East },
    { x: tx + 1, y: ty, dir: Dir.West },
  ];
  for (const n of neighbors) {
    if (isWalkable(maze, n.x, n.y)) {
      state.runState!.playerX = n.x;
      state.runState!.playerY = n.y;
      state.runState!.facing = n.dir;
      return true;
    }
  }
  return false;
}

describe('RunManager (maze)', () => {
  it('startRun creates active run state on a maze', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    expect(state.runState).not.toBeNull();
    expect(state.runState!.isActive).toBe(true);
    expect(state.runState!.maze.tiles.length).toBeGreaterThan(0);
  });

  it('player starts on a walkable tile', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    const r = state.runState!;
    expect(isWalkable(r.maze, r.playerX, r.playerY)).toBe(true);
  });

  it('turning changes facing but not position', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    const r = state.runState!;
    const { playerX, playerY, facing } = r;
    rm.move(state, 'turnRight');
    expect(r.facing).toBe(((facing + 1) % 4) as Dir);
    expect(r.playerX).toBe(playerX);
    expect(r.playerY).toBe(playerY);
  });

  it('moving into a wall does not change position', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    const r = state.runState!;
    // Box player in a position and aim at a wall by scanning.
    // Force a wall ahead: find any floor tile with a wall neighbor.
    for (let y = 1; y < r.maze.height - 1; y++) {
      for (let x = 1; x < r.maze.width - 1; x++) {
        if (!isWalkable(r.maze, x, y)) continue;
        if (!isWalkable(r.maze, x, y - 1)) {
          r.playerX = x;
          r.playerY = y;
          r.facing = Dir.North;
          rm.move(state, 'forward');
          expect(r.playerX).toBe(x);
          expect(r.playerY).toBe(y);
          return;
        }
      }
    }
  });

  it('stepping onto treasure gives loot', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    const outcome = stepOntoEncounter(rm, state, NodeType.Treasure);
    if (outcome) {
      expect(outcome.type).toBe('loot');
      expect(outcome.type === 'loot' && outcome.materials.length).toBeGreaterThan(0);
    }
  });

  it('stepping onto shop returns shop outcome', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    const outcome = stepOntoEncounter(rm, state, NodeType.Shop);
    if (outcome) expect(outcome.type).toBe('shop');
  });

  it('stepping onto trap deals HP damage', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    const hpBefore = state.runState!.playerHP;
    const outcome = stepOntoEncounter(rm, state, NodeType.Trap);
    if (outcome && outcome.type === 'trap') {
      expect(outcome.damage).toBeGreaterThan(0);
      expect(state.runState!.playerHP).toBeLessThan(hpBefore);
    }
  });

  it('stepping onto combat returns combat outcome', () => {
    const state = new GameState();
    state.stash.addMaterial('iron', 100);
    const rm = new RunManager();
    rm.startRun(state);
    const outcome = stepOntoEncounter(rm, state, NodeType.Combat);
    if (outcome && outcome.type === 'combat') {
      expect('result' in outcome).toBe(true);
    }
  });

  it('encounter tile is marked visited after resolving', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    const maze = state.runState!.maze;
    const target = findEncounter(maze, NodeType.Treasure);
    if (target && placeFacing(state, maze, target.x, target.y)) {
      rm.move(state, 'forward');
      expect(maze.tiles[target.y * maze.width + target.x].visited).toBe(true);
    }
  });

  it('stepping onto stairs descends to next depth', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    const maze = state.runState!.maze;
    const stairs = findTile(maze, TileKind.Stairs);
    if (stairs && placeFacing(state, maze, stairs.x, stairs.y)) {
      const outcome = rm.move(state, 'forward');
      expect(outcome.type).toBe('descend');
      expect(state.runState!.depth).toBe(2);
    }
  });

  it('extractRun transfers materials to stash and ends run', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    state.runState!.runInventory.addMaterial('iron', 5);
    rm.extractRun(state);
    expect(state.stash.getMaterialCount('iron')).toBe(5);
    expect(state.runState!.isActive).toBe(false);
  });

  it('abandonRun discards run inventory', () => {
    const state = new GameState();
    const rm = new RunManager();
    rm.startRun(state);
    state.runState!.runInventory.addMaterial('iron', 5);
    rm.abandonRun(state);
    expect(state.stash.getMaterialCount('iron')).toBe(0);
    expect(state.runState).toBeNull();
  });

  it('death from trap costs 25% of stash gold', () => {
    const state = new GameState();
    state.gold = 100;
    const rm = new RunManager();
    rm.startRun(state);
    state.runState!.playerHP = 1; // one trap kills
    const outcome = stepOntoEncounter(rm, state, NodeType.Trap);
    if (outcome && outcome.type === 'trap' && !state.runState!.isActive) {
      expect(state.gold).toBe(75);
    }
  });
});
