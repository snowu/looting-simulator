import { RunState, DungeonNode, NodeType } from '../state/game-state';
import { getReachableNodes } from '../systems/dungeon';

const NODE_ICONS: Record<NodeType, string> = {
  [NodeType.Start]: 'S',
  [NodeType.Treasure]: 'T',
  [NodeType.Combat]: 'C',
  [NodeType.Shop]: '$',
  [NodeType.Trap]: '!',
  [NodeType.Event]: '?',
  [NodeType.Boss]: 'B',
};

export class DungeonMapView {
  private container: HTMLElement;
  private el: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.el = document.createElement('div');
    this.el.className = 'dungeon-map';
    this.container.appendChild(this.el);
  }

  update(runState: RunState, onMoveToNode: (nodeId: string) => void): void {
    const nodes = runState.dungeonMap;
    const currentId = runState.currentNodeId;
    const reachable = getReachableNodes(nodes, currentId);
    const reachableIds = new Set(reachable.map(n => n.id));

    // Group nodes by depth
    const layers = new Map<number, DungeonNode[]>();
    for (const node of nodes) {
      if (!layers.has(node.depth)) layers.set(node.depth, []);
      layers.get(node.depth)!.push(node);
    }

    const maxDepth = Math.max(...layers.keys());
    const layerHeight = 60;
    const svgHeight = (maxDepth + 1) * layerHeight + 40;
    const svgWidth = this.container.clientWidth - 20 || 400;

    // Build node positions
    const positions = new Map<string, { x: number; y: number }>();
    for (const [depth, layerNodes] of layers) {
      const count = layerNodes.length;
      const spacing = svgWidth / (count + 1);
      for (let i = 0; i < count; i++) {
        positions.set(layerNodes[i].id, { x: spacing * (i + 1), y: depth * layerHeight + 30 });
      }
    }

    // SVG lines
    let lines = '';
    for (const node of nodes) {
      const from = positions.get(node.id)!;
      for (const connId of node.connections) {
        const to = positions.get(connId);
        if (to) {
          lines += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#444" stroke-width="2"/>`;
        }
      }
    }

    // SVG nodes
    let circles = '';
    for (const node of nodes) {
      const pos = positions.get(node.id)!;
      const isCurrent = node.id === currentId;
      const isReachable = reachableIds.has(node.id);
      let fill = '#333';
      let stroke = '#666';
      let opacity = '1';
      let cursor = 'default';

      if (isCurrent) { fill = '#4a9eff'; stroke = '#7bb8ff'; }
      else if (node.completed) { fill = '#222'; stroke = '#444'; opacity = '0.5'; }
      else if (isReachable) { fill = '#2a5a3a'; stroke = '#4a9a5a'; cursor = 'pointer'; }

      circles += `<g class="map-node" data-node-id="${node.id}" style="cursor:${cursor};opacity:${opacity}">`;
      circles += `<circle cx="${pos.x}" cy="${pos.y}" r="18" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
      circles += `<text x="${pos.x}" y="${pos.y + 5}" text-anchor="middle" fill="#eee" font-size="12" font-family="monospace">${NODE_ICONS[node.type]}</text>`;
      circles += '</g>';
    }

    this.el.innerHTML = `
      <svg width="${svgWidth}" height="${svgHeight}" class="dungeon-svg">
        ${lines}
        ${circles}
      </svg>
      <div class="map-legend">
        <span>S=Start T=Treasure C=Combat $=Shop !=Trap ?=Event B=Boss</span>
      </div>
    `;

    // Attach click handlers for reachable nodes
    const nodeEls = this.el.querySelectorAll('.map-node');
    nodeEls.forEach(el => {
      const id = (el as SVGElement).dataset.nodeId!;
      if (reachableIds.has(id)) {
        el.addEventListener('click', () => onMoveToNode(id));
      }
    });
  }

  show(): void {
    this.el.style.display = '';
  }

  hide(): void {
    this.el.style.display = 'none';
  }
}
