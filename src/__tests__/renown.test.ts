import { describe, it, expect } from 'vitest';
import { renownForRun } from '../systems/meta';
import { newGame } from '../state/game-state';
import { createRng } from '../core/rng';
import { startRun, endRun } from '../systems/run';
import { World } from '../world/world';
import { stairsFront } from '../systems/dungeon';

describe('renown', () => {
  it('pays nothing for stepping straight back out', () => {
    expect(renownForRun(1, true, false)).toBe(0);
  });

  it('still pays for going down', () => {
    expect(renownForRun(2, true, false)).toBe(6);
    expect(renownForRun(6, true, false)).toBe(14);
    expect(renownForRun(6, true, true)).toBe(39);
  });

  it('pays a little for dying deep and nothing for dying at the door', () => {
    expect(renownForRun(1, false, false)).toBe(0);
    expect(renownForRun(4, false, false)).toBe(3);
  });

  it('does not turn the day for a delve that never went down', () => {
    const state = newGame(createRng(11));
    const day = state.market.day;
    startRun(state, 11);
    endRun(state, 'extracted');
    expect(state.market.day).toBe(day);
  });

  it('turns the day for a delve that did go down', () => {
    const state = newGame(createRng(12));
    const day = state.market.day;
    startRun(state, 12);
    state.run!.stats.deepest = 2;
    endRun(state, 'extracted');
    expect(state.market.day).toBe(day + 1);
  });

  it('cannot be farmed by entering and leaving a run', () => {
    const state = newGame(createRng(9));
    const before = state.renown;
    const day = state.market.day;
    for (let i = 0; i < 5; i++) {
      startRun(state, 100 + i);
      // Walk into the up-stairs you spawned next to — the whole exploit.
      const w = new World(state);
      const up = w.floor.stairs.find((s) => !s.down)!;
      const spot = stairsFront(up);
      expect(w.player.x).toBe(spot.x);
      expect(w.player.y).toBe(spot.y);
      // You spawn facing away from the way out, so: about turn, one step.
      for (const turn of ['turnLeft', 'turnLeft'] as const) {
        w.press(turn);
        w.release(turn);
        for (let t = 0; t < 30; t++) w.update(1 / 60);
      }
      w.press('forward');
      w.release('forward');
      for (let t = 0; t < 60; t++) w.update(1 / 60);
      expect(w.run.outcome).toBe('extracted');
      endRun(state, 'extracted');
    }
    expect(state.renown).toBe(before);
    // ...and it is not a way to skip days either.
    expect(state.market.day).toBe(day);
  });
});
