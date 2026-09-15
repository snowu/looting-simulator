import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { dropIntoArcherRoom, prepare } from '../dev/archer-room';

function tick(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

/** The dev firing squad: five living archers, aware, opening fire promptly. */
describe('dev archer room', () => {
  it('lines up five ranged archers facing the player on some seed', () => {
    let found: World | null = null;
    for (let seed = 1; seed <= 20 && !found; seed++) {
      const state = newGame(createRng(seed));
      prepare(state);
      startRun(state, seed);
      const w = new World(state);
      const at = dropIntoArcherRoom(w);
      // Denser floors often leave wanderers outside the cleared room, so look
      // for the 5-archer squad itself rather than an empty rest of the floor.
      if (w.floor.enemies.filter((e) => e.id.startsWith('archer')).length === 5) found = w;
      else expect(at).toContain('archers');
    }
    expect(found).not.toBeNull();
    const w = found!;
    const squad = w.floor.enemies.filter((e) => e.id.startsWith('archer'));
    expect(squad).toHaveLength(5);
    for (const e of squad) {
      expect(e.ai).not.toBe('dead');
      expect(e.lastSeenX).toBe(w.player.x);
      expect(e.lastSeenY).toBe(w.player.y);
    }
    // The volley starts without the player doing anything.
    tick(w, 6);
    const acted = squad.some((e) => e.ai === 'windup' || e.ai === 'recover')
      || w.projectiles.length > 0;
    expect(acted).toBe(true);
  });
});
