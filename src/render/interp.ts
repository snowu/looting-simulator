/**
 * Drawing between simulation steps.
 *
 * The world steps 60 times a second (src/core/fixed-clock.ts); a display can
 * draw more often than that. Drawing the last step as it stands would make a
 * 144 Hz screen show each step two or three times, so the picture would move
 * at 60 fps however fast the monitor. Instead the frame is drawn a fraction
 * `alpha` of the way from the step before to the latest one.
 *
 * Rather than teach the renderer about two states, this blends the handful of
 * fields that motion is drawn from, writes them onto the world for the length
 * of the draw, and puts the real values back afterwards:
 *
 *   the player:  moveT (the step under way), yaw (the turn), attackT (the swing),
 *                blockRaise (the guard)
 *   monsters:    moveT
 *   projectiles: x, y
 *
 * A field only blends while it is still on the same segment as one step ago:
 * the same step between the same two tiles, the same swing phase, a bolt
 * still flying the same way. Across a boundary (a step landing, a swing
 * turning to recovery, a bolt reflected, a new floor) it shows the latest
 * value. At those moments the two states are a hair apart anyway.
 *
 * Nothing here changes the simulation: the world is exactly as it was after
 * the draw.
 */
import type { EnemyState } from '../systems/dungeon';
import type { Projectile, World } from '../world/world';

interface PlayerSnap {
  fromX: number; fromY: number; x: number; y: number; moveT: number;
  yaw: number;
  attack: string; attackDur: number; attackT: number;
  blockRaise: number;
}
interface EnemySnap { fromX: number; fromY: number; x: number; y: number; moveT: number }
interface ShotSnap { x: number; y: number; dx: number; dy: number }

interface Snap {
  world: World;
  player: PlayerSnap;
  enemies: Map<EnemyState, EnemySnap>;
  shots: Map<Projectile, ShotSnap>;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export class RenderInterp {
  private prev: Snap | null = null;

  /** Remember the world as it stands. Call just before each simulation step. */
  capture(w: World): void {
    const a = w.anim;
    const enemies = new Map<EnemyState, EnemySnap>();
    for (const e of w.floor.enemies) enemies.set(e, { fromX: e.fromX, fromY: e.fromY, x: e.x, y: e.y, moveT: e.moveT });
    const shots = new Map<Projectile, ShotSnap>();
    for (const pr of w.projectiles) shots.set(pr, { x: pr.x, y: pr.y, dx: pr.dx, dy: pr.dy });
    this.prev = {
      world: w,
      player: {
        fromX: a.fromX, fromY: a.fromY, x: w.player.x, y: w.player.y, moveT: a.moveT,
        yaw: a.yaw,
        attack: a.attack, attackDur: a.attackDur, attackT: a.attackT,
        blockRaise: a.blockRaise,
      },
      enemies,
      shots,
    };
  }

  /** Forget the last step: a new world, or a jump the blend should not span. */
  reset(): void {
    this.prev = null;
  }

  /**
   * Run `draw` with the world's motion fields blended `alpha` of the way from
   * the step before the latest to the latest, then restore them.
   */
  draw(w: World, alpha: number, draw: () => void): void {
    const prev = this.prev;
    if (!prev || prev.world !== w || alpha >= 1) {
      draw();
      return;
    }
    const t = Math.max(0, alpha);
    const restore: (() => void)[] = [];
    const set = <T extends object, K extends keyof T>(o: T, k: K, v: T[K]) => {
      const was = o[k];
      restore.push(() => { o[k] = was; });
      o[k] = v;
    };
    try {
      const a = w.anim;
      const p = prev.player;
      if (p.fromX === a.fromX && p.fromY === a.fromY && p.x === w.player.x && p.y === w.player.y && p.moveT <= a.moveT) {
        set(a, 'moveT', lerp(p.moveT, a.moveT, t));
      }
      if (Math.abs(a.yaw - p.yaw) < Math.PI) set(a, 'yaw', lerp(p.yaw, a.yaw, t));
      if (p.attack === a.attack && p.attackDur === a.attackDur && p.attackT <= a.attackT) {
        set(a, 'attackT', lerp(p.attackT, a.attackT, t));
      }
      set(a, 'blockRaise', lerp(p.blockRaise, a.blockRaise, t));

      for (const e of w.floor.enemies) {
        const s = prev.enemies.get(e);
        if (s && s.fromX === e.fromX && s.fromY === e.fromY && s.x === e.x && s.y === e.y && s.moveT <= e.moveT) {
          set(e, 'moveT', lerp(s.moveT, e.moveT, t));
        }
      }
      for (const pr of w.projectiles) {
        const s = prev.shots.get(pr);
        // A bolt that turned (reflected) jumps, and so does one that moved oddly
        // far. A shaft called home turns a little every step on purpose, as it
        // steers at you, and still flies smoothly.
        const sameWay = s && ((s.dx === pr.dx && s.dy === pr.dy) || pr.returning);
        if (s && sameWay && Math.hypot(pr.x - s.x, pr.y - s.y) < 2) {
          set(pr, 'x', lerp(s.x, pr.x, t));
          set(pr, 'y', lerp(s.y, pr.y, t));
        }
      }
      draw();
    } finally {
      for (let i = restore.length - 1; i >= 0; i--) restore[i]();
    }
  }
}
