import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { dropIntoMeleeRoom, prepare } from '../dev/melee-room';

function tick(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

/**
 * The dev pile-on: five brutes crowding the player, mid-swing, so one held
 * guard parries the first and the new immunity plus splash stagger eat the
 * rest — exactly the stacked-attack protection from the parry overhaul.
 */
describe('dev melee room', () => {
  it('crowds five brutes around the player and one parry answers the pile', () => {
    let found: World | null = null;
    for (let seed = 1; seed <= 20 && !found; seed++) {
      const state = newGame(createRng(seed));
      prepare(state);
      startRun(state, seed);
      const w = new World(state);
      dropIntoMeleeRoom(w);
      if (w.floor.enemies.length === 5) found = w;
    }
    expect(found).not.toBeNull();
    const w = found!;
    const adjacent = w.floor.enemies.filter(
      (e) => Math.abs(e.x - w.player.x) + Math.abs(e.y - w.player.y) === 1,
    );
    expect(adjacent.length).toBeGreaterThanOrEqual(3);

    const hp = w.player.hp;
    w.setBlock(true);
    tick(w, 0.2);

    // The first swing through the window is parried; the pile behind it lands
    // on immunity and splash stagger instead of on the player.
    expect(w.player.hp).toBe(hp);
    expect(w.floor.enemies.filter((e) => (e.vuln ?? 0) > 0)).toHaveLength(1);
    for (const e of adjacent) {
      if ((e.vuln ?? 0) > 0) continue;
      expect(e.ai).toBe('recover');
      expect(e.timer).toBeGreaterThan(0);
    }

    // And the rest of the second plays out the same way: blocked or denied,
    // never through.
    tick(w, 0.8);
    expect(w.player.hp).toBe(hp);
  });
});
