import { describe, it, expect } from 'vitest';
import { turnAround } from '../core/dir';
import { World } from '../world/world';
import { EnemyState, createEnemy } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { room, tick } from './harness';

// The left half of a phone screen both guards and walks. A touch there is a
// pending guard until the finger taps, holds or drags (see World.guardPending).


const arena = (seed = 1): World => room({ seed, difficulty: 'hard' });

function spawnWindingUp(w: World): EnemyState {
  const t = w.frontTile(1);
  const e = createEnemy(enemyDef('skeleton'), t.x, t.y, turnAround(w.player.facing), 'sk', 1);
  w.floor.enemies.push(e);
  Object.assign(e, { ai: 'windup', timer: 0.12, alert: 6, lastSeenX: w.player.x, lastSeenY: w.player.y });
  return e;
}

describe('a pending touch guard', () => {
  it('that turns into a walk raises nothing and spends no parry', () => {
    const w = arena(2);
    w.guardPending(true);
    tick(w, 0.08);
    expect(w.anim.blockRaise).toBe(0);
    w.guardPending(false);
    tick(w, 0.2);
    expect(w.held.has('block')).toBe(false);
    expect(w.anim.blockRaise).toBe(0);
    expect(w.anim.parryCd).toBe(0);
  });

  it('parries a blow that lands before the finger decides', () => {
    const w = arena(2);
    const e = spawnWindingUp(w);
    const hp = w.player.hp;
    w.guardPending(true);
    tick(w, 0.2);
    expect(w.player.hp).toBe(hp);
    expect(e.ai).toBe('recover');
    expect(e.vuln).toBeGreaterThan(0);
  });

  it('confirmed later, is backdated to the touch: the window and cooldown run from then', () => {
    const w = arena(3);
    w.guardPending(true);
    tick(w, 0.15);
    w.setBlock(true);
    expect(w.anim.parryArmed).toBe(true);
    expect(w.anim.blockT).toBeCloseTo(0.15, 1);
    expect(w.anim.parryCd).toBeCloseTo(0.75 - 0.15, 1);
    expect(w.anim.blockRaise).toBe(1);
    expect(w.parryWindow).toBe(true);
    tick(w, 0.1);
    // 0.25s after the touch: past the 0.22s window, still blocking.
    expect(w.parryWindow).toBe(false);
    expect(w.anim.blockRaise).toBe(1);
  });

  it('confirmed past the window still blocks, but no longer parries', () => {
    const w = arena(4);
    w.guardPending(true);
    tick(w, 0.3);
    w.setBlock(true);
    expect(w.parryWindow).toBe(false);
    tick(w, 0.05);
    expect(w.held.has('block')).toBe(true);
    expect(w.anim.blockRaise).toBe(1);
  });

  it('settled by a blow, still comes down when the finger then drags away', () => {
    const w = arena(2);
    spawnWindingUp(w);
    w.guardPending(true);
    tick(w, 0.2);
    expect(w.held.has('block')).toBe(true);
    w.guardPending(false);
    expect(w.held.has('block')).toBe(false);
  });

  it('left over from a touch the page never saw lift is not a guard', () => {
    const w = arena(2);
    w.guardPending(true);
    tick(w, 0.6);
    const e = spawnWindingUp(w);
    const hp = w.player.hp;
    tick(w, 0.2);
    expect(w.player.hp).toBeLessThan(hp);
    expect(e.vuln ?? 0).toBe(0);
  });

  it('respects the parry cooldown the touch landed in', () => {
    const w = arena(5);
    w.setBlock(true);
    tick(w, 0.05);
    w.setBlock(false);
    tick(w, 0.05);
    expect(w.anim.parryCd).toBeGreaterThan(0);
    w.guardPending(true);
    tick(w, 0.1);
    w.setBlock(true);
    expect(w.anim.parryArmed).toBe(false);
  });
});
