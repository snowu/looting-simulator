import { Dir } from '../core/dir';
import { Floor, FLOOR, PILLAR, WALL } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';

export interface MapView {
  /** Pixels per tile. */
  cell: number;
  /** Tile at the centre of the canvas; defaults to the map centre. */
  cx?: number;
  cy?: number;
  /** Show only tiles within this many tiles of the centre (minimap). */
  radius?: number;
  /** Enemies visible to the player right now. */
  visibleEnemies?: Set<string>;
}

const C = {
  bg: '#0a0809',
  floor: '#5a5046',
  floorDim: '#3a332c',
  wall: '#1e1a17',
  edge: '#8a7a64',
  door: '#b07840',
  locked: '#e0b040',
  up: '#e0d070',
  down: '#50d0d0',
  loot: '#ffd24a',
  chest: '#c08850',
  enemy: '#ff4a3a',
  player: '#ffe070',
  secret: '#c8a0ff',
  trap: '#ff8a3a',
  trapSpent: '#4a4038',
};

export function drawMap(canvas: HTMLCanvasElement, f: Floor, px: number, py: number, facing: Dir, view: MapView, time = 0): void {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width, H = canvas.height;
  const cell = view.cell;
  const cx = view.cx ?? f.width / 2;
  const cy = view.cy ?? f.height / 2;
  const ox = Math.round(W / 2 - (cx + 0.5) * cell);
  const oy = Math.round(H / 2 - (cy + 0.5) * cell);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const inView = (x: number, y: number) => !view.radius || (x - cx) ** 2 + (y - cy) ** 2 <= view.radius ** 2;
  const seen = (x: number, y: number) => x >= 0 && y >= 0 && x < f.width && y < f.height && f.explored[y * f.width + x] === 1;

  for (let y = 0; y < f.height; y++) {
    for (let x = 0; x < f.width; x++) {
      if (!inView(x, y)) continue;
      const t = f.tiles[y * f.width + x];
      const sx = ox + x * cell, sy = oy + y * cell;
      if (sx < -cell || sy < -cell || sx > W || sy > H) continue;
      if (t === FLOOR || t === PILLAR) {
        if (!seen(x, y)) continue;
        ctx.fillStyle = t === PILLAR ? C.wall : C.floor;
        ctx.fillRect(sx, sy, cell, cell);
      } else if (t === WALL) {
        // Draw walls only where they border explored floor, with a light edge.
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen(x + dx, y + dy) && f.tiles[(y + dy) * f.width + x + dx] !== WALL);
        if (!nb) continue;
        ctx.fillStyle = C.wall;
        ctx.fillRect(sx, sy, cell, cell);
        ctx.fillStyle = C.edge;
        if (seen(x, y + 1) && f.tiles[(y + 1) * f.width + x] !== WALL) ctx.fillRect(sx, sy + cell - 1, cell, 1);
        if (seen(x, y - 1) && f.tiles[(y - 1) * f.width + x] !== WALL) ctx.fillRect(sx, sy, cell, 1);
        if (seen(x + 1, y) && f.tiles[y * f.width + x + 1] !== WALL) ctx.fillRect(sx + cell - 1, sy, 1, cell);
        if (seen(x - 1, y) && f.tiles[y * f.width + x - 1] !== WALL) ctx.fillRect(sx, sy, 1, cell);
      }
    }
  }

  const dot = (x: number, y: number, color: string, scale = 0.5) => {
    if (!inView(x, y)) return;
    const s = Math.max(2, Math.round(cell * scale));
    ctx.fillStyle = color;
    ctx.fillRect(ox + x * cell + Math.round((cell - s) / 2), oy + y * cell + Math.round((cell - s) / 2), s, s);
  };

  for (const d of f.doors) if (seen(d.x, d.y)) dot(d.x, d.y, d.locked ? C.locked : C.door, d.open ? 0.35 : 0.7);
  for (const s of f.stairs) if (seen(s.x, s.y)) dot(s.x, s.y, s.down ? C.down : C.up, 0.9);
  for (const s of f.secrets) if (s.found) dot(s.x, s.y, C.secret, 0.5);
  for (const p of f.props) if (p.kind === 'chest' && seen(p.x, p.y)) dot(p.x, p.y, p.used ? C.floorDim : C.chest, 0.6);
  for (const p of f.props) if (p.kind === 'portal') dot(p.x, p.y, C.secret, 0.9);
  for (const p of f.pickups) if (seen(p.x, p.y)) dot(p.x, p.y, p.keyId ? C.locked : C.loot, 0.4);
  // A trap you have found stays marked, armed or not, so you can plan around it.
  for (const t of f.traps ?? []) if (t.found && seen(t.x, t.y)) dot(t.x, t.y, t.armed ? C.trap : C.trapSpent, t.armed ? 0.55 : 0.3);
  if (view.visibleEnemies) {
    for (const e of f.enemies) {
      if (e.ai === 'dead' || !view.visibleEnemies.has(e.id)) continue;
      dot(e.x, e.y, enemyDef(e.def).behavior === 'boss' ? '#c060ff' : C.enemy, 0.55);
    }
  }

  // Player arrow.
  const pcx = ox + px * cell + cell / 2, pcy = oy + py * cell + cell / 2;
  ctx.save();
  ctx.translate(pcx, pcy);
  ctx.rotate((facing * Math.PI) / 2);
  const s = Math.max(3, cell * 0.8);
  ctx.fillStyle = C.player;
  ctx.globalAlpha = 0.75 + Math.sin(time * 6) * 0.25;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.75, s * 0.7);
  ctx.lineTo(0, s * 0.3);
  ctx.lineTo(-s * 0.75, s * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
