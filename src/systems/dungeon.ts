import { DungeonNode, NodeType } from '../state/game-state';

const ROOM_TYPES = [NodeType.Treasure, NodeType.Combat, NodeType.Shop, NodeType.Trap, NodeType.Event];

export function generateDungeon(depth: number): DungeonNode[] {
  const nodes: DungeonNode[] = [];
  const layers: DungeonNode[][] = [];

  const start: DungeonNode = { id: 'node-0-0', type: NodeType.Start, depth: 0, connections: [], completed: false };
  nodes.push(start);
  layers.push([start]);

  for (let d = 1; d < depth; d++) {
    const count = 2 + Math.floor(Math.random() * 2); // 2-3
    const layer: DungeonNode[] = [];
    for (let i = 0; i < count; i++) {
      const type = ROOM_TYPES[Math.floor(Math.random() * ROOM_TYPES.length)];
      const node: DungeonNode = { id: `node-${d}-${i}`, type, depth: d, connections: [], completed: false };
      nodes.push(node);
      layer.push(node);
    }
    layers.push(layer);
  }

  const boss: DungeonNode = { id: `node-${depth}-0`, type: NodeType.Boss, depth, connections: [], completed: false };
  nodes.push(boss);
  layers.push([boss]);

  // Connect layers: each node in layer connects to 1-2 in next layer
  // Ensure every node in next layer has at least one incoming connection
  for (let d = 0; d < layers.length - 1; d++) {
    const current = layers[d];
    const next = layers[d + 1];
    const connected = new Set<string>();

    for (const node of current) {
      const targetCount = 1 + Math.floor(Math.random() * Math.min(2, next.length));
      const shuffled = [...next].sort(() => Math.random() - 0.5);
      for (let i = 0; i < targetCount; i++) {
        node.connections.push(shuffled[i].id);
        connected.add(shuffled[i].id);
      }
    }

    // Ensure all next-layer nodes are connected
    for (const node of next) {
      if (!connected.has(node.id)) {
        const parent = current[Math.floor(Math.random() * current.length)];
        parent.connections.push(node.id);
      }
    }
  }

  return nodes;
}

export function getReachableNodes(nodes: DungeonNode[], currentId: string): DungeonNode[] {
  const current = nodes.find(n => n.id === currentId);
  if (!current) return [];
  return current.connections
    .map(id => nodes.find(n => n.id === id)!)
    .filter(Boolean);
}
