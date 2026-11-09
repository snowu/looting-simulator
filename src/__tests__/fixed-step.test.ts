import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { FixedClock, SIM_STEP, advance } from '../core/fixed-clock';
import { RenderInterp } from '../render/interp';
import { World } from '../world/world';
import { room, spawn, spawnAt, tick } from './harness';

/** A small fight: two monsters coming at you, one of them shooting. */
function fight(): World {
  const w = room({ seed: 7 });
  spawn(w, 'skeleton', 4);
  spawnAt(w, 'goblin_archer', w.player.x + 3, w.player.y - 5);
  return w;
}

/** The inputs, by simulation step: walk, swing, raise the guard, turn. */
function input(w: World, step: number): void {
  if (step === 5) w.press('forward');
  if (step === 40) w.release('forward');
  if (step % 25 === 0) w.attack();
  if (step === 90) w.setBlock(true);
  if (step === 130) w.setBlock(false);
  if (step === 200) w.press('turnLeft');
  if (step === 210) w.release('turnLeft');
}

/** What the run came to: enough to tell two runs apart. */
function fingerprint(w: World): string {
  return JSON.stringify({
    rng: w.rng.state,
    hp: w.player.hp,
    stamina: Math.round(w.player.stamina * 1000),
    at: [w.player.x, w.player.y, w.player.facing],
    enemies: w.floor.enemies.map((e) => [e.def, e.x, e.y, e.hp, e.ai]),
    shots: w.projectiles.length,
  });
}

/** Play the fight for exactly `steps` simulation steps, drawn at the given frame lengths, through the fixed clock. */
function playFixed(frames: () => number, steps: number): string {
  const w = fight();
  const clock = new FixedClock();
  let step = 0;
  while (step < steps) {
    advance(clock, frames(), () => {
      input(w, step++);
      w.update(SIM_STEP);
      w.drainEvents();
      return step < steps;
    });
  }
  return fingerprint(w);
}

const every = (fps: number) => () => 1 / fps;

describe('fixed simulation step', () => {
  it('plays the same seed and inputs out the same at any frame rate', () => {
    const rng = createRng(3);
    const at60 = playFixed(every(60), 360);
    expect(playFixed(every(30), 360)).toBe(at60);
    expect(playFixed(every(144), 360)).toBe(at60);
    // A display that never settles: frames between 8 and 20 ms.
    expect(playFixed(() => rng.float(0.008, 0.02), 360)).toBe(at60);
  });

  it('is what fixed it: one update per frame came out differently at 30 and 144 fps', () => {
    const old = (fps: number) => {
      const w = fight();
      let simTime = 0;
      let step = 0;
      for (let t = 0; t < 6; t += 1 / fps) {
        // Inputs land at the same sim times as the fixed run's steps.
        while (step * SIM_STEP <= simTime) input(w, step++);
        w.update(1 / fps);
        simTime += Math.min(1 / fps, 0.05);
        w.drainEvents();
      }
      return fingerprint(w);
    };
    expect(old(30)).not.toBe(old(144));
  });

  it('banks real time and pays it out in whole steps', () => {
    const clock = new FixedClock();
    let steps = 0;
    for (let i = 0; i < 144; i++) steps += advance(clock, 1 / 144, () => true);
    expect(steps).toBe(60);
    // A long hitch costs at most a tenth of a second, not a burst of catch-up.
    expect(advance(clock, 5, () => true)).toBe(6);
    // A step that opens a menu stops the stepping and drops what was left.
    expect(advance(clock, 0.1, () => false)).toBe(1);
    expect(clock.alpha).toBe(0);
  });
});

describe('drawing between steps', () => {
  it('draws a step under way part of the way from the last step to this one, and changes nothing', () => {
    const w = room();
    w.press('forward');
    tick(w, 0.05);
    const interp = new RenderInterp();
    interp.capture(w);
    w.update(SIM_STEP);
    const now = { moveT: w.anim.moveT, yaw: w.anim.yaw };
    let seen = -1;
    interp.draw(w, 0.5, () => { seen = w.anim.moveT; });
    expect(seen).toBeGreaterThan(0);
    expect(seen).toBeLessThan(now.moveT);
    expect(w.anim.moveT).toBe(now.moveT);
    expect(w.anim.yaw).toBe(now.yaw);
  });

  it('blends a bolt in flight, but not one that has just been turned around', () => {
    const w = room();
    const interp = new RenderInterp();
    const bolt = { id: 1, x: w.player.x + 0.5, y: w.player.y - 3.5, tileX: w.player.x, tileY: w.player.y - 4, dx: 0, dy: 1, speed: 6, damage: 5, type: 'pierce' as const, sprite: 'arrow', source: 'test' };
    w.projectiles.push(bolt);
    interp.capture(w);
    bolt.y += 0.1;
    let y = 0;
    interp.draw(w, 0.5, () => { y = bolt.y; });
    expect(y).toBeCloseTo(w.player.y - 3.45, 5);
    interp.capture(w);
    bolt.dy = -1;
    bolt.y -= 0.1;
    interp.draw(w, 0.5, () => { y = bolt.y; });
    expect(y).toBe(bolt.y);
  });

  it('shows the latest step as it stands when the blend has nothing to go on', () => {
    const w = room();
    const interp = new RenderInterp();
    let ran = false;
    interp.draw(w, 0.3, () => { ran = true; });
    expect(ran).toBe(true);
    // Captured on another world: a new floor or a new delve starts clean.
    interp.capture(room({ seed: 2 }));
    w.press('forward');
    tick(w, 0.05);
    const moveT = w.anim.moveT;
    let seen = -1;
    interp.draw(w, 0.5, () => { seen = w.anim.moveT; });
    expect(seen).toBe(moveT);
  });
});
