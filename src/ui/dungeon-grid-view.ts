import { RunState, NodeType } from '../state/game-state';
import {
  Dir,
  DIR_DELTA,
  turnRight,
  tileAt,
  TileKind,
  MazeFloor,
  Tile,
} from '../systems/maze';
import { MoveAction } from '../systems/run-manager';

const VIEW_DEPTH = 5; // how many tiles ahead we render

// Sprite glyph + color per encounter type.
const ENCOUNTER_SPRITE: Partial<Record<NodeType, { glyph: string; color: string }>> = {
  [NodeType.Treasure]: { glyph: '$', color: '#ffd700' },
  [NodeType.Combat]: { glyph: '!', color: '#ff4444' },
  [NodeType.Boss]: { glyph: 'X', color: '#cc22ff' },
  [NodeType.Shop]: { glyph: 'S', color: '#44aaff' },
  [NodeType.Trap]: { glyph: '^', color: '#ff8800' },
  [NodeType.Event]: { glyph: '*', color: '#44ff88' },
};

const PAL = {
  ceiling: '#15151f',
  floor: '#2c2418',
  wallNear: 200,
  wallFar: 40,
  void: '#000',
};

export class DungeonGridView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private el: HTMLElement;
  private container: HTMLElement;
  private visible = false;
  private animId = 0;
  private frame = 0;

  private run: RunState | null = null;
  private onMove: ((a: MoveAction) => void) | null = null;
  private ro: ResizeObserver;
  private keyHandler: (e: KeyboardEvent) => void;

  constructor(container: HTMLElement) {
    this.container = container;

    this.el = document.createElement('div');
    this.el.className = 'dungeon-grid';
    this.el.style.position = 'relative';
    this.el.style.width = '100%';
    this.el.style.height = '100%';
    this.el.style.overflow = 'hidden';

    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.imageRendering = 'pixelated';
    this.el.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;
    this.container.appendChild(this.el);

    this.ro = new ResizeObserver(() => {
      if (this.visible) this.resizeCanvas();
    });
    this.ro.observe(this.el);

    this.keyHandler = (e) => this.handleKey(e);
    window.addEventListener('keydown', this.keyHandler);

    // Prevent listener pileup across Vite HMR reloads (which would multiply
    // each keypress into 2+ turns).
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        window.removeEventListener('keydown', this.keyHandler);
        cancelAnimationFrame(this.animId);
        this.ro.disconnect();
      });
    }
  }

  /** Bind state + move callback. Called whenever the run updates. */
  update(run: RunState, onMove: (a: MoveAction) => void): void {
    this.run = run;
    this.onMove = onMove;
    this.resizeCanvas();
    cancelAnimationFrame(this.animId);
    this.animate();
  }

  private resizeCanvas(): void {
    const rect = this.el.getBoundingClientRect();
    const w = Math.round(rect.width) || 400;
    const h = Math.round(rect.height) || 400;
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  private animate = (): void => {
    this.frame++;
    this.resizeCanvas(); // self-heal if layout settled after first paint
    this.render();
    this.animId = requestAnimationFrame(this.animate);
  };

  // --- Geometry helpers ---------------------------------------------------

  /**
   * Cross-section rectangle of the corridor at a depth-boundary plane `d` tiles
   * ahead of the eye. d=0 is the plane at the player (fills/overflows the
   * screen so the immediately adjacent walls are visible at the edges). Larger
   * d shrinks toward the vanishing point at screen center.
   *
   * Uses a pinhole projection: proj = focal / (focal + d).
   */
  private plane(d: number, w: number, h: number) {
    const cx = w / 2;
    const cy = h / 2;
    const focal = 0.9;
    const proj = focal / (focal + d);
    // Half-extents at d=0 chosen so the near walls slightly overflow the frame.
    const halfW = w * 0.85 * proj;
    const halfH = h * 0.92 * proj;
    return {
      left: cx - halfW,
      right: cx + halfW,
      top: cy - halfH,
      bottom: cy + halfH,
      proj,
    };
  }

  // Direction-relative neighbor lookup: from player facing, get the tile that is
  // `forward` steps ahead and `side` steps to the right.
  private cellAhead(maze: MazeFloor, px: number, py: number, facing: Dir, forward: number, side: number): Tile | null {
    const fwd = DIR_DELTA[facing];
    const rightDir = turnRight(facing);
    const rgt = DIR_DELTA[rightDir];
    const x = px + fwd.dx * forward + rgt.dx * side;
    const y = py + fwd.dy * forward + rgt.dy * side;
    return tileAt(maze, x, y);
  }

  private isWall(t: Tile | null): boolean {
    return !t || t.kind === TileKind.Wall;
  }

  /** World coords of the cell `forward`/`side` from the player, given facing. */
  private cellCoord(px: number, py: number, facing: Dir, forward: number, side: number): { x: number; y: number } {
    const fwd = DIR_DELTA[facing];
    const rgt = DIR_DELTA[turnRight(facing)];
    return { x: px + fwd.dx * forward + rgt.dx * side, y: py + fwd.dy * forward + rgt.dy * side };
  }

  /** Stable per-tile flag: is this wall ruined (cracks)? Brick is the base for all. */
  private isRuined(x: number, y: number): boolean {
    const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    return h % 100 < 28; // ~28% ruined; rest are clean brick
  }

  /**
   * Overlay brick texture onto a wall quad (the base look for EVERY wall), plus
   * cracks/crumble for ruined tiles. `corners` = near-top, far-top, far-bottom,
   * near-bottom. Clipped to the quad.
   */
  private drawWallTexture(
    ctx: CanvasRenderingContext2D,
    corners: [number, number][],
    x: number,
    y: number,
    z: number
  ): void {
    const ruined = this.isRuined(x, y);

    const t = Math.min(1, z / VIEW_DEPTH);
    const detail = 1 - t * 0.7; // fade detail with distance
    if (detail <= 0.12) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i][0], corners[i][1]);
    ctx.closePath();
    ctx.clip();

    const [nt, ft, fb, nb] = corners;
    // Helper: point along top edge (a) and bottom edge (b) at fraction u (0=near,1=far).
    const top = (u: number): [number, number] => [nt[0] + (ft[0] - nt[0]) * u, nt[1] + (ft[1] - nt[1]) * u];
    const bot = (u: number): [number, number] => [nb[0] + (fb[0] - nb[0]) * u, nb[1] + (fb[1] - nb[1]) * u];

    {
      // BRICK base — horizontal courses (include r=0 so the TOP row has a joint)
      // + staggered vertical joints. Drawn on every wall.
      ctx.strokeStyle = `rgba(0,0,0,${0.35 * detail})`;
      ctx.lineWidth = 1;
      const courses = 6;
      for (let r = 0; r < courses; r++) {
        const v = r / courses;
        const a: [number, number] = [nt[0] + (nb[0] - nt[0]) * v, nt[1] + (nb[1] - nt[1]) * v];
        const b: [number, number] = [ft[0] + (fb[0] - ft[0]) * v, ft[1] + (fb[1] - ft[1]) * v];
        if (r > 0) {
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
          ctx.stroke();
        }
        // vertical joints for the course BELOW this line, staggered per row
        const cols = 5;
        for (let c = 0; c < cols; c++) {
          const u = (c + (r % 2 ? 0.5 : 0)) / cols;
          if (u <= 0.02 || u >= 0.98) continue;
          const pT = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
          const vNext = (r + 1) / courses;
          const a2: [number, number] = [nt[0] + (nb[0] - nt[0]) * vNext, nt[1] + (nb[1] - nt[1]) * vNext];
          const b2: [number, number] = [ft[0] + (fb[0] - ft[0]) * vNext, ft[1] + (fb[1] - ft[1]) * vNext];
          const pB = [a2[0] + (b2[0] - a2[0]) * u, a2[1] + (b2[1] - a2[1]) * u];
          ctx.beginPath();
          ctx.moveTo(pT[0], pT[1]);
          ctx.lineTo(pB[0], pB[1]);
          ctx.stroke();
        }
      }
    }

    if (ruined) {
      // RUINED: irregular cracks + a few missing-stone dark patches over brick.
      const seed = ((x * 12345) ^ (y * 6789)) >>> 0;
      const rnd = (n: number) => ((Math.sin(seed * 9.13 + n * 2.7) * 43758.5) % 1 + 1) % 1;
      ctx.strokeStyle = `rgba(0,0,0,${0.5 * detail})`;
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        const u0 = rnd(k), u1 = u0 + (rnd(k + 9) - 0.5) * 0.3;
        const p0 = top(Math.max(0, Math.min(1, u0)));
        const mid = bot(Math.max(0, Math.min(1, (u0 + u1) / 2)));
        const p1 = bot(Math.max(0, Math.min(1, u1)));
        ctx.beginPath();
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(mid[0] + (rnd(k + 3) - 0.5) * 20, mid[1]);
        ctx.lineTo(p1[0], p1[1]);
        ctx.stroke();
      }
      // dark crumbled patches
      ctx.fillStyle = `rgba(0,0,0,${0.4 * detail})`;
      for (let k = 0; k < 2; k++) {
        const u = rnd(k + 20);
        const a = top(u), b = bot(u);
        const py2 = a[1] + (b[1] - a[1]) * (0.3 + rnd(k + 30) * 0.5);
        const px2 = a[0] + (b[0] - a[0]) * (0.3 + rnd(k + 31) * 0.4);
        ctx.beginPath();
        ctx.ellipse(px2, py2, 6 * detail, 8 * detail, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private wallShade(z: number, side: 'front' | 'left' | 'right'): string {
    const t = Math.min(1, z / VIEW_DEPTH);
    let v = PAL.wallNear - (PAL.wallNear - PAL.wallFar) * t;
    if (side === 'left') v *= 0.82;
    if (side === 'right') v *= 0.7;
    v = Math.max(10, Math.floor(v));
    const b = Math.floor(v * 1.08);
    return `rgb(${v},${v},${b})`;
  }

  private floorShade(z: number): string {
    const t = Math.min(1, z / VIEW_DEPTH);
    const v = Math.max(14, Math.floor(64 - 40 * t));
    return `rgb(${v},${Math.floor(v * 0.78)},${Math.floor(v * 0.5)})`;
  }

  private ceilShade(z: number): string {
    const t = Math.min(1, z / VIEW_DEPTH);
    const v = Math.max(8, Math.floor(34 - 22 * t));
    return `rgb(${v},${v},${Math.floor(v * 1.3)})`;
  }

  // --- Render -------------------------------------------------------------

  private render(): void {
    const ctx = this.ctx;
    const run = this.run;
    if (!run) return;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Solid wall-toned backdrop so any unpainted gap reads as distant wall,
    // never as a black void. Ceiling + floor split drawn over it.
    ctx.fillStyle = '#1c1c24';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = PAL.ceiling;
    ctx.fillRect(0, 0, w, h / 2);
    ctx.fillStyle = PAL.floor;
    ctx.fillRect(0, h / 2, w, h / 2);

    const maze = run.maze;
    const { playerX: px, playerY: py, facing } = run;

    type Sprite = { z: number; tile: Tile; size: number };
    const sprites: Sprite[] = [];

    // Painter's algorithm: draw the farthest visible cell first, then nearer
    // cells over it. Each cell z occupies the depth band [z, z+1].
    // We render up to the first wall OR closed door ahead (can't see past it).
    let maxVisible = VIEW_DEPTH;
    let frontDoorZ = -1;
    for (let z = 0; z <= VIEW_DEPTH; z++) {
      const c = this.cellAhead(maze, px, py, facing, z, 0);
      if (this.isWall(c)) {
        maxVisible = z;
        break;
      }
      if (c && c.door && !c.door.open) {
        maxVisible = z; // closed door blocks the view at this depth
        frontDoorZ = z;
        break;
      }
    }

    for (let z = maxVisible; z >= 0; z--) {
      const near = this.plane(z, w, h);
      const far = this.plane(z + 1, w, h);
      const center = this.cellAhead(maze, px, py, facing, z, 0);

      if (this.isWall(center)) {
        // Solid wall facing us: fill the FAR plane (the back face of this band),
        // which is the flat wall surface at distance z+ (we project its front
        // face at the near plane edge so it reads as a wall straight ahead).
        ctx.fillStyle = this.wallShade(z, 'front');
        ctx.fillRect(near.left, near.top, near.right - near.left, near.bottom - near.top);
        {
          const c = this.cellCoord(px, py, facing, z, 0);
          this.drawWallTexture(
            ctx,
            [[near.left, near.top], [near.right, near.top], [near.right, near.bottom], [near.left, near.bottom]],
            c.x, c.y, z
          );
        }
        this.outline(ctx, near.left, near.top, near.right, near.bottom, z);
        continue;
      }

      // Open floor cell: draw floor + ceiling bands, then side walls.
      // Floor band (between near.bottom and far.bottom).
      ctx.fillStyle = this.floorShade(z);
      ctx.beginPath();
      ctx.moveTo(near.left, near.bottom);
      ctx.lineTo(near.right, near.bottom);
      ctx.lineTo(far.right, far.bottom);
      ctx.lineTo(far.left, far.bottom);
      ctx.closePath();
      ctx.fill();

      // Ceiling band.
      ctx.fillStyle = this.ceilShade(z);
      ctx.beginPath();
      ctx.moveTo(near.left, near.top);
      ctx.lineTo(near.right, near.top);
      ctx.lineTo(far.right, far.top);
      ctx.lineTo(far.left, far.top);
      ctx.closePath();
      ctx.fill();

      const leftCell = this.cellAhead(maze, px, py, facing, z, -1);
      const rightCell = this.cellAhead(maze, px, py, facing, z, 1);

      // LEFT side: always a solid wall (you only move forward/back, so side
      // openings are never walked into). A true 1-tile doorway gets an arch
      // overlay; wide room-edges just stay wall so doors stay rare.
      {
        ctx.fillStyle = this.wallShade(z, 'left');
        ctx.beginPath();
        ctx.moveTo(near.left, near.top);
        ctx.lineTo(far.left, far.top);
        ctx.lineTo(far.left, far.bottom);
        ctx.lineTo(near.left, near.bottom);
        ctx.closePath();
        ctx.fill();
        const c = this.cellCoord(px, py, facing, z, -1);
        this.drawWallTexture(
          ctx,
          [[near.left, near.top], [far.left, far.top], [far.left, far.bottom], [near.left, near.bottom]],
          c.x, c.y, z
        );
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (leftCell?.door) {
          if (leftCell.door.open) this.drawSidePortal(ctx, near, far, 'left', leftCell, z);
          else this.drawWoodenDoorSide(ctx, near, far, 'left', z);
        }
        this.maybeTorch(ctx, near, far, 'left', z);
      }

      // RIGHT side (same rule as left).
      {
        ctx.fillStyle = this.wallShade(z, 'right');
        ctx.beginPath();
        ctx.moveTo(near.right, near.top);
        ctx.lineTo(far.right, far.top);
        ctx.lineTo(far.right, far.bottom);
        ctx.lineTo(near.right, near.bottom);
        ctx.closePath();
        ctx.fill();
        const c = this.cellCoord(px, py, facing, z, 1);
        this.drawWallTexture(
          ctx,
          [[near.right, near.top], [far.right, far.top], [far.right, far.bottom], [near.right, near.bottom]],
          c.x, c.y, z
        );
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (rightCell?.door) {
          if (rightCell.door.open) this.drawSidePortal(ctx, near, far, 'right', rightCell, z);
          else this.drawWoodenDoorSide(ctx, near, far, 'right', z);
        }
        this.maybeTorch(ctx, near, far, 'right', z);
      }

      // Closed door directly ahead: a wooden door fills the passage at this band.
      if (z === frontDoorZ) {
        this.drawWoodenDoorFront(ctx, near);
      }

      // Sprite sitting on this floor cell (centered in the band).
      if (center && z >= 1) {
        if (center.kind === TileKind.Encounter && !center.visited) {
          sprites.push({ z, tile: center, size: (near.bottom - near.top) * 0.32 });
        } else if (center.kind === TileKind.Stairs) {
          sprites.push({ z, tile: center, size: (near.bottom - near.top) * 0.35 });
        }
      }
    }

    // Draw sprites far-to-near.
    sprites.sort((a, b) => b.z - a.z);
    for (const s of sprites) {
      const band = this.plane(s.z + 0.5, w, h);
      // Rest the sprite on the floor of its band.
      const cy = band.bottom - s.size * 0.55;
      this.drawSprite(ctx, s.tile, w / 2, cy, s.size);
    }

    this.drawArms(ctx, w, h);
    this.drawMinimap(ctx, w, h, run);
    this.drawHUD(ctx, w, h, run);
  }

  /**
   * First-person stick arms at the bottom of the frame: left arm holds a torch,
   * right arm holds a sword. Bob gently with a walk cycle.
   */
  private drawArms(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const bob = Math.sin(this.frame * 0.05) * h * 0.012;
    const s = h / 360; // scale to canvas height

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // ---- Left arm + torch ----
    const lx = w * 0.2;
    const ly = h + bob;
    const ltipX = w * 0.32;
    const ltipY = h * 0.58 + bob;
    ctx.strokeStyle = '#d9b38c';
    ctx.lineWidth = 10 * s;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + (ltipX - lx) * 0.5, ly - (ly - ltipY) * 0.65);
    ctx.lineTo(ltipX, ltipY + 14 * s);
    ctx.stroke();

    // Torch handle.
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 7 * s;
    ctx.beginPath();
    ctx.moveTo(ltipX, ltipY + 22 * s);
    ctx.lineTo(ltipX, ltipY - 4 * s);
    ctx.stroke();

    // Torch flame + glow lighting the view from below-left.
    const flick = Math.sin(this.frame * 0.2) * 3 + Math.sin(this.frame * 0.37) * 2;
    const glow = ctx.createRadialGradient(ltipX, ltipY, 2, ltipX, ltipY, 130 * s);
    glow.addColorStop(0, 'rgba(255,170,60,0.30)');
    glow.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(ltipX - 130 * s, ltipY - 130 * s, 260 * s, 260 * s);

    ctx.fillStyle = '#ff8a1f';
    ctx.beginPath();
    ctx.ellipse(ltipX, ltipY - 8 * s, 8 * s, (16 + flick) * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    ctx.ellipse(ltipX, ltipY - 6 * s, 4 * s, (9 + flick * 0.5) * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // ---- Right arm + sword ----
    const rx = w * 0.8;
    const ry = h + bob * 0.8;
    const rtipX = w * 0.66;
    const rtipY = h * 0.62 + bob * 0.8;
    ctx.strokeStyle = '#d9b38c';
    ctx.lineWidth = 11 * s;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + (rtipX - rx) * 0.45, ry - (ry - rtipY) * 0.6);
    ctx.lineTo(rtipX, rtipY + 10 * s);
    ctx.stroke();

    // Sword: crossguard + blade pointing up.
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = 6 * s;
    ctx.beginPath();
    ctx.moveTo(rtipX - 16 * s, rtipY);
    ctx.lineTo(rtipX + 16 * s, rtipY);
    ctx.stroke();

    ctx.strokeStyle = '#c8ccd8';
    ctx.lineWidth = 7 * s;
    ctx.beginPath();
    ctx.moveTo(rtipX, rtipY);
    ctx.lineTo(rtipX, rtipY - 120 * s);
    ctx.stroke();
    // Blade highlight.
    ctx.strokeStyle = '#eef2ff';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(rtipX - 1.5 * s, rtipY - 4 * s);
    ctx.lineTo(rtipX - 1.5 * s, rtipY - 116 * s);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Mount a flickering torch on a solid side wall at certain depths, giving
   * the corridor light reference points. Placed at the mid-depth of the band.
   */
  private maybeTorch(
    ctx: CanvasRenderingContext2D,
    near: { left: number; right: number; top: number; bottom: number },
    far: { left: number; right: number; top: number; bottom: number },
    side: 'left' | 'right',
    z: number
  ): void {
    if (z < 1 || z > 3) return; // only near/mid depth, where it's legible

    // Position at the wall's mid-depth, upper third.
    const mx = side === 'left' ? (near.left + far.left) / 2 : (near.right + far.right) / 2;
    const midTop = (near.top + far.top) / 2;
    const midBot = (near.bottom + far.bottom) / 2;
    const wy = midTop + (midBot - midTop) * 0.32;
    const scale = (near.bottom - near.top) / 360; // size relative to band height
    const flick = Math.sin(this.frame * 0.18 + z * 2) * 2 + Math.sin(this.frame * 0.31) * 1.5;

    // Warm glow pool on the wall.
    const glow = ctx.createRadialGradient(mx, wy, 1, mx, wy, 70 * scale);
    glow.addColorStop(0, 'rgba(255,170,60,0.35)');
    glow.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(mx - 70 * scale, wy - 70 * scale, 140 * scale, 140 * scale);

    // Bracket.
    ctx.fillStyle = '#3a2c1a';
    ctx.fillRect(mx - 2 * scale, wy, 4 * scale, 16 * scale);

    // Flame.
    ctx.fillStyle = '#ff8a1f';
    ctx.beginPath();
    ctx.ellipse(mx, wy - 4 * scale + flick * 0.3 * scale, 5 * scale, (10 + flick) * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    ctx.ellipse(mx, wy - 2 * scale + flick * 0.3 * scale, 2.5 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * An open side neighbor is rendered as a DOOR cut into the full side wall —
   * never a wide opening. We draw the complete side wall (same trapezoid as a
   * solid wall), then carve a single door-shaped recess centered in the band,
   * leaving wall margins on all four sides so it reads as "a door in a wall."
   */
  private drawSidePortal(
    ctx: CanvasRenderingContext2D,
    near: { left: number; right: number; top: number; bottom: number },
    far: { left: number; right: number; top: number; bottom: number },
    side: 'left' | 'right',
    sideCell: Tile | null,
    z: number
  ): void {
    // 1) Full solid side wall.
    const nx = side === 'left' ? near.left : near.right;
    const fx = side === 'left' ? far.left : far.right;
    ctx.fillStyle = this.wallShade(z, side);
    ctx.beginPath();
    ctx.moveTo(nx, near.top);
    ctx.lineTo(fx, far.top);
    ctx.lineTo(fx, far.bottom);
    ctx.lineTo(nx, near.bottom);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 2) Arched door cut into the wall. Bottom sits on the floor edge of the
    //    wall (no threshold); top is an arch.
    const lerpTop = (x: number) => near.top + ((x - nx) / (fx - nx)) * (far.top - near.top);
    const lerpBot = (x: number) => near.bottom + ((x - nx) / (fx - nx)) * (far.bottom - near.bottom);

    // Door jambs span most of the wall band in depth (bigger, wider door).
    const dnx = nx + (fx - nx) * 0.08;
    const dfx = nx + (fx - nx) * 0.9;
    const nFloor = lerpBot(dnx); // door foot on near jamb = wall floor line
    const fFloor = lerpBot(dfx);
    const nCeil = lerpTop(dnx);
    const fCeil = lerpTop(dfx);
    // Tall door: springline ~62% up, arch apex near the ceiling.
    const nSpring = nFloor + (nCeil - nFloor) * 0.62;
    const fSpring = fFloor + (fCeil - fFloor) * 0.62;
    const nApex = nFloor + (nCeil - nFloor) * 0.92;
    const fApex = fFloor + (fCeil - fFloor) * 0.92;
    const midApexX = (dnx + dfx) / 2;
    const midApexY = (nApex + fApex) / 2;

    // Build the arched-door outline (frame), filled with lighter stone.
    const archDoor = (nxA: number, fxA: number, nFoot: number, fFoot: number,
                      nSp: number, fSp: number, apexX: number, apexY: number) => {
      ctx.beginPath();
      ctx.moveTo(nxA, nFoot);           // near foot on floor
      ctx.lineTo(nxA, nSp);             // up near jamb to springline
      ctx.quadraticCurveTo(apexX, apexY, fxA, fSp); // arch over to far jamb
      ctx.lineTo(fxA, fFoot);           // down far jamb to floor
      ctx.closePath();                  // floor edge back to near foot
    };

    ctx.fillStyle = 'rgb(120,104,76)';
    archDoor(dnx, dfx, nFloor, fFloor, nSpring, fSpring, midApexX, midApexY);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Recessed dark opening inside the frame (same arch, inset).
    const fw = (dfx - dnx) * 0.14;
    const t = Math.min(1, z / VIEW_DEPTH);
    const v = Math.max(8, Math.floor(24 - 15 * t));
    ctx.fillStyle = `rgb(${v},${v},${Math.floor(v * 1.25)})`;
    const inNx = dnx + fw, inFx = dfx - fw * 0.6;
    const inNFoot = nFloor, inFFoot = fFloor; // still to the floor
    const inNSp = nSpring + (nFloor - nSpring) * 0.08;
    const inFSp = fSpring + (fFloor - fSpring) * 0.08;
    const inApexY = midApexY + (((nFloor + fFloor) / 2) - midApexY) * 0.12;
    archDoor(inNx, inFx, inNFoot, inFFoot, inNSp, inFSp, (inNx + inFx) / 2, inApexY);
    ctx.fill();

    void sideCell;
  }

  /** Draw a closed wooden door inside an axis-aligned arched opening rect. */
  private drawWoodenDoorRect(
    ctx: CanvasRenderingContext2D,
    left: number, right: number, top: number, bottom: number
  ): void {
    const wDoor = right - left;
    const archTop = top + (bottom - top) * 0.18; // springline of the arch
    ctx.save();
    // Door silhouette (arched): straight jambs up to springline, arc over top.
    ctx.beginPath();
    ctx.moveTo(left, bottom);
    ctx.lineTo(left, archTop);
    ctx.quadraticCurveTo(left, top, (left + right) / 2, top);
    ctx.quadraticCurveTo(right, top, right, archTop);
    ctx.lineTo(right, bottom);
    ctx.closePath();
    ctx.clip();

    // Wood base.
    ctx.fillStyle = '#5a3a1c';
    ctx.fillRect(left, top, wDoor, bottom - top);

    // Vertical planks.
    const planks = 4;
    for (let i = 0; i < planks; i++) {
      const x = left + (wDoor * i) / planks;
      ctx.fillStyle = i % 2 ? '#623f1f' : '#553719';
      ctx.fillRect(x, top, wDoor / planks, bottom - top);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
    }

    // Iron bands (horizontal).
    ctx.fillStyle = '#2a2a30';
    const bandH = (bottom - top) * 0.06;
    for (const fy of [0.28, 0.72]) {
      ctx.fillRect(left, top + (bottom - top) * fy, wDoor, bandH);
    }

    // Iron ring handle.
    ctx.strokeStyle = '#1a1a1f';
    ctx.lineWidth = Math.max(2, wDoor * 0.04);
    ctx.beginPath();
    ctx.arc(right - wDoor * 0.2, (top + bottom) / 2, wDoor * 0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Frame outline.
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, bottom);
    ctx.lineTo(left, archTop);
    ctx.quadraticCurveTo(left, top, (left + right) / 2, top);
    ctx.quadraticCurveTo(right, top, right, archTop);
    ctx.lineTo(right, bottom);
    ctx.stroke();
  }

  /** Closed wooden door blocking the corridor straight ahead (front plane). */
  private drawWoodenDoorFront(
    ctx: CanvasRenderingContext2D,
    near: { left: number; right: number; top: number; bottom: number }
  ): void {
    const cx = (near.left + near.right) / 2;
    const halfW = (near.right - near.left) * 0.34;
    const top = near.top + (near.bottom - near.top) * 0.1;
    this.drawWoodenDoorRect(ctx, cx - halfW, cx + halfW, top, near.bottom);
  }

  /** Closed wooden door set into a side wall (uses the side trapezoid). */
  private drawWoodenDoorSide(
    ctx: CanvasRenderingContext2D,
    near: { left: number; right: number; top: number; bottom: number },
    far: { left: number; right: number; top: number; bottom: number },
    side: 'left' | 'right',
    z: number
  ): void {
    const nx = side === 'left' ? near.left : near.right;
    const fx = side === 'left' ? far.left : far.right;
    const lerpTop = (x: number) => near.top + ((x - nx) / (fx - nx)) * (far.top - near.top);
    const lerpBot = (x: number) => near.bottom + ((x - nx) / (fx - nx)) * (far.bottom - near.bottom);
    const dnx = nx + (fx - nx) * 0.12;
    const dfx = nx + (fx - nx) * 0.88;
    const left = Math.min(dnx, dfx);
    const right = Math.max(dnx, dfx);
    const midX = (dnx + dfx) / 2;
    // Vertical extent from the wall's ceiling/floor at the door's mid-depth.
    const top = lerpTop(midX) + (lerpBot(midX) - lerpTop(midX)) * 0.08;
    const bottom = lerpBot(midX);
    this.drawWoodenDoorRect(ctx, left, right, top, bottom);
    void z;
  }

  private outline(ctx: CanvasRenderingContext2D, l: number, t: number, r: number, b: number, z: number): void {
    ctx.strokeStyle = `rgba(0,0,0,${0.3 + z * 0.05})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(l, t, r - l, b - t);
  }

  private drawSprite(ctx: CanvasRenderingContext2D, tile: Tile, cx: number, cy: number, size: number): void {
    if (tile.kind === TileKind.Stairs) {
      // Draw descending stairs glyph.
      ctx.fillStyle = '#aaa';
      const steps = 4;
      const sw = size;
      for (let i = 0; i < steps; i++) {
        const sh = size / steps;
        const y = cy - size / 2 + i * sh;
        const inset = (i / steps) * sw * 0.3;
        ctx.fillStyle = `rgb(${130 - i * 20},${130 - i * 20},${140 - i * 20})`;
        ctx.fillRect(cx - sw / 2 + inset, y, sw - inset * 2, sh - 1);
      }
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.floor(size * 0.25)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('DOWN', cx, cy - size / 2 - 2);
      return;
    }

    const spr = tile.encounter ? ENCOUNTER_SPRITE[tile.encounter] : undefined;
    if (!spr) return;

    const bob = Math.sin(this.frame * 0.06) * size * 0.05;
    // Glow.
    const glow = ctx.createRadialGradient(cx, cy + bob, 2, cx, cy + bob, size * 0.9);
    glow.addColorStop(0, spr.color + '55');
    glow.addColorStop(1, spr.color + '00');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - size, cy - size + bob, size * 2, size * 2);

    // Pedestal.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + size * 0.5, size * 0.4, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glyph token.
    ctx.fillStyle = spr.color;
    ctx.beginPath();
    ctx.arc(cx, cy + bob, size * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = `bold ${Math.floor(size * 0.55)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spr.glyph, cx, cy + bob);
  }

  // --- Minimap ------------------------------------------------------------

  private drawMinimap(ctx: CanvasRenderingContext2D, w: number, _h: number, run: RunState): void {
    const maze = run.maze;
    const cell = 4;
    const mw = maze.width * cell;
    const mh = maze.height * cell;
    const ox = w - mw - 10;
    const oy = 10;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(ox - 2, oy - 2, mw + 4, mh + 4);

    for (let y = 0; y < maze.height; y++) {
      for (let x = 0; x < maze.width; x++) {
        const t = maze.tiles[y * maze.width + x];
        if (!t.seen) continue;
        let c = '#444';
        if (t.kind === TileKind.Wall) c = '#222';
        else if (t.door && !t.door.open) c = '#8a5a2a'; // closed door
        else if (t.kind === TileKind.Encounter && !t.visited) c = '#aa7722';
        else if (t.kind === TileKind.Stairs) c = '#22aaaa';
        else c = '#556';
        ctx.fillStyle = c;
        ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
      }
    }

    // Player marker (triangle pointing in facing dir).
    const pxs = ox + run.playerX * cell + cell / 2;
    const pys = oy + run.playerY * cell + cell / 2;
    ctx.fillStyle = '#ffcc00';
    ctx.save();
    ctx.translate(pxs, pys);
    ctx.rotate((run.facing * Math.PI) / 2);
    ctx.beginPath();
    ctx.moveTo(0, -cell);
    ctx.lineTo(cell * 0.7, cell * 0.7);
    ctx.lineTo(-cell * 0.7, cell * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawHUD(ctx: CanvasRenderingContext2D, w: number, h: number, run: RunState): void {
    // HP bar.
    const barW = w * 0.28;
    const barH = 12;
    const bx = 10;
    const by = 10;
    const ratio = run.playerHP / run.playerMaxHP;
    ctx.fillStyle = '#222';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = ratio > 0.6 ? '#4a9a5a' : ratio > 0.3 ? '#ffaa00' : '#ff4444';
    ctx.fillRect(bx, by, barW * Math.max(0, ratio), barH);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, barW, barH);
    ctx.fillStyle = '#fff';
    ctx.font = '15px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`HP ${run.playerHP}/${run.playerMaxHP}`, bx + 4, by + 10);

    ctx.fillStyle = '#888';
    ctx.font = '17px monospace';
    ctx.fillText(`Depth ${run.depth}`, bx, by + 30);

    ctx.fillStyle = '#555';
    ctx.font = '16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('W/S move · A/D turn · E open door', w / 2, h - 10);
  }

  // --- Input --------------------------------------------------------------

  private handleKey(e: KeyboardEvent): void {
    if (e.repeat) return; // ignore auto-repeat while a key is held
    if (!this.visible || !this.run || !this.run.isActive || !this.onMove) return;
    let action: MoveAction | null = null;
    switch (e.key) {
      case 'w':
      case 'W':
      case 'ArrowUp':
        action = 'forward';
        break;
      case 's':
      case 'S':
      case 'ArrowDown':
        action = 'back';
        break;
      case 'a':
      case 'A':
      case 'ArrowLeft':
        action = 'turnLeft';
        break;
      case 'd':
      case 'D':
      case 'ArrowRight':
        action = 'turnRight';
        break;
      case 'e':
      case 'E':
        action = 'interact';
        break;
      default:
        return;
    }
    e.preventDefault();
    this.onMove(action);
  }

  show(): void {
    this.visible = true;
    this.el.style.display = '';
    this.resizeCanvas();
    if (this.run) {
      cancelAnimationFrame(this.animId);
      this.animate();
    }
  }

  hide(): void {
    this.visible = false;
    this.el.style.display = 'none';
    cancelAnimationFrame(this.animId);
  }
}
