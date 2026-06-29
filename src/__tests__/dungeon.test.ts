import { generateDungeon, getReachableNodes } from '../systems/dungeon';
import { NodeType } from '../state/game-state';

test('generated dungeon has start and boss', () => {
  const nodes = generateDungeon(5);
  expect(nodes.some(n => n.type === NodeType.Start)).toBe(true);
  expect(nodes.some(n => n.type === NodeType.Boss)).toBe(true);
});

test('start node at depth 0, boss at max depth', () => {
  const nodes = generateDungeon(5);
  const start = nodes.find(n => n.type === NodeType.Start)!;
  const boss = nodes.find(n => n.type === NodeType.Boss)!;
  expect(start.depth).toBe(0);
  expect(boss.depth).toBe(5);
});

test('all nodes reachable from start', () => {
  const nodes = generateDungeon(5);
  const start = nodes.find(n => n.type === NodeType.Start)!;
  const visited = new Set<string>();
  const queue = [start.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = nodes.find(n => n.id === id)!;
    queue.push(...node.connections);
  }
  expect(visited.size).toBe(nodes.length);
});

test('each depth layer has 2-3 nodes (except start/boss)', () => {
  const nodes = generateDungeon(5);
  for (let d = 1; d < 5; d++) {
    const count = nodes.filter(n => n.depth === d).length;
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(3);
  }
});
