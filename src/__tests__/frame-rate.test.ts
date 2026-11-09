import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { turnAround } from '../core/dir';
import { World } from '../world/world';
import { createEnemy } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { room } from './harness';
import * as Combat from '../world/combat';

/**
 * The world runs on whatever dt the display gives it. A rule that rolls once
 * per tick instead of once per second plays differently on a 144 Hz monitor
 * than on a phone at 30 fps. These pin rules that must not.
 */

const arena = (seed: number): World => room({ seed, difficulty: 'hard' });

/**
 * Share of trials in which a badly hurt skittish monster, standing beside you
 * between swings, turns to flee within `window` seconds. Standing still is
 * where it decides every tick; mid-step it decides once per step.
 */
function fleeRate(dt: number, trials: number, window = 0.5): number {
  // One floor for every trial: generating 300 of them is what made this slow.
  // You never move or get hit (the monster's swing is 5s away), so each trial
  // only needs a fresh monster and a fresh stream.
  const w = arena(1);
  let fled = 0;
  for (let i = 0; i < trials; i++) {
    w.floor.enemies = [];
    w.rng = createRng(9000 + i);
    const t = w.frontTile(1);
    const e = createEnemy(enemyDef('spore_hunter'), t.x, t.y, turnAround(w.player.facing), `fr${i}`, 3);
    e.hp = Math.floor(e.maxHp * 0.2);
    e.alert = 8;
    e.attackCd = 5;
    w.floor.enemies.push(e);
    for (let s = 0; s < window && e.ai !== 'flee'; s += dt) w.update(dt);
    if (e.ai === 'flee') fled++;
  }
  return fled / trials;
}

/** How many draws took `rng` from state `from` to state `to`. */
function drawsBetween(from: number, to: number): number {
  const r = createRng(from);
  for (let n = 0; n <= 16; n++) {
    if (r.state === to) return n;
    r.next();
  }
  return -1;
}

describe('the gameplay stream', () => {
  /** Strike a dummy of `id` 60 times; the draws each blow took from the gameplay stream, and what it said. */
  function strike(id: string): { draws: Set<number>; said: string[] } {
    const w = arena(3);
    const t = w.frontTile(1);
    const e = createEnemy(enemyDef(id), t.x, t.y, turnAround(w.player.facing), id, 1);
    e.hp = e.maxHp = 1_000_000;
    w.floor.enemies.push(e);
    const draws = new Set<number>();
    const said: string[] = [];
    for (let i = 0; i < 60; i++) {
      const before = w.rng.state;
      Combat.hitEnemy(w, e);
      draws.add(drawsBetween(before, w.rng.state));
      for (const ev of w.drainEvents()) if (ev.type === 'msg') said.push(ev.text);
    }
    return { draws, said };
  }

  it('a cosmetic message never draws from the stream that decides shrines, coffers and moves', () => {
    // The starting short sword is slash: Drowned Bones shrug it off, Your Shade takes it plainly.
    const resisted = strike('drowned_bones');
    const plain = strike('shade');
    expect(resisted.said.some((t) => t.includes('shrugs off'))).toBe(true);
    expect(plain.said.some((t) => t.includes('shrugs off'))).toBe(false);
    // A blow costs the stream its damage and crit rolls, and nothing for the flavour.
    expect([...resisted.draws]).toEqual([...plain.draws]);
    expect(plain.draws.size).toBe(1);
  });
});

describe('frame-rate independence', () => {
  it('a wounded skittish monster beside you flees at the same rate at 30 and 144 fps', () => {
    // Tuned at 60 fps: 2% a tick there is 1 - 0.98^30, about 45%, over half a second.
    const slow = fleeRate(1 / 30, 300);
    const fast = fleeRate(1 / 144, 300);
    expect(slow).toBeGreaterThan(0.33);
    expect(slow).toBeLessThan(0.58);
    expect(fast).toBeGreaterThan(0.33);
    expect(fast).toBeLessThan(0.58);
    expect(Math.abs(fast - slow)).toBeLessThan(0.12);
  });
});
