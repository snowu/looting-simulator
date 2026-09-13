import { describe, expect, it } from 'vitest';
import { PoseInput, enemyPose } from '../render/enemy-pose';

const base: PoseInput = {
  ai: 'chase', timer: 0, sinceStrike: Infinity, hasShield: false, ranged: false, windup: 0.6, recovery: 1,
};

describe('enemy pose', () => {
  it('raises the weapon partway through the wind-up and keeps it up', () => {
    expect(enemyPose({ ...base, ai: 'windup', timer: 0.6 }).frame).toBe('0');
    expect(enemyPose({ ...base, ai: 'windup', timer: 0.3 }).frame).toBe('atk');
    expect(enemyPose({ ...base, ai: 'windup', timer: 0.01 }).frame).toBe('atk');
  });

  it('gathers the lean late in the wind-up, then throws it at the blow', () => {
    const early = enemyPose({ ...base, ai: 'windup', timer: 0.45 }).lunge;
    const late = enemyPose({ ...base, ai: 'windup', timer: 0.05 }).lunge;
    expect(early).toBeLessThan(late);
    const blow = enemyPose({ ...base, ai: 'recover', timer: 1, sinceStrike: 0.07 }).lunge;
    expect(blow).toBeGreaterThan(late);
  });

  it('lets the body settle back before the creature can swing again', () => {
    const settled = enemyPose({ ...base, ai: 'recover', timer: 0.2, sinceStrike: 0.8 });
    expect(settled.lunge).toBe(0);
    expect(settled.frame).toBe('0');
  });

  it('never leaves the weapon raised once the blow has landed', () => {
    expect(enemyPose({ ...base, ai: 'recover', timer: 0.99, sinceStrike: 0.01 }).frame).toBe('0');
  });

  /**
   * The bug this model exists to kill: a stagger, a parry and a broken boss
   * phase all park a creature in `recover`, and the old renderer read that as
   * "it just hit you" and replayed the swing it had been knocked out of.
   */
  it('does not play a follow-through for a blow that never landed', () => {
    const staggered = enemyPose({ ...base, ai: 'recover', timer: 0.5, sinceStrike: Infinity });
    expect(staggered.frame).toBe('0');
    expect(staggered.lunge).toBe(0);
  });

  it('braces an archer back instead of leaning it in, and rocks it off the string', () => {
    const drawing = enemyPose({ ...base, ranged: true, ai: 'windup', timer: 0.05 });
    expect(drawing.frame).toBe('atk');
    expect(drawing.lunge).toBeLessThan(0);
    expect(enemyPose({ ...base, ranged: true, ai: 'recover', timer: 1, sinceStrike: 0.05 }).lunge).toBeLessThan(0);
  });

  it('holds the guard frame whenever the shield is up and the weapon is not', () => {
    const up = { ...base, hasShield: true, guard: 'up' as const };
    expect(enemyPose(up).frame).toBe('block');
    expect(enemyPose({ ...up, guard: 'raising' })).toMatchObject({ frame: 'block' });
    expect(enemyPose({ ...up, guard: 'down' }).frame).toBe('0');
    // A swing outranks the guard: the shield arm is busy.
    expect(enemyPose({ ...up, ai: 'windup', timer: 0.1 }).frame).toBe('atk');
  });

  it('stands a corpse still', () => {
    expect(enemyPose({ ...base, ai: 'dead', sinceStrike: 0.01 })).toEqual({ frame: '0', lunge: 0 });
  });
});
