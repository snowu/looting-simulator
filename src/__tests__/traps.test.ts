import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { World, TRAPS } from '../world/world';
import { EnemyState, FLOOR, Trap, TrapKind, createEnemy, generateFloor, trapAt } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { BASE_LIGHT_RADIUS, lightIntensity, lightRadius } from '../systems/meta';

function tick(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

/** The player on a tile with a clear run ahead, and no traps but the one we plant. */
function arena(seed = 1): World {
  const state = newGame(createRng(seed));
  startRun(state, seed);
  const w = new World(state);
  const f = w.floor;
  f.enemies = [];
  f.traps = [];
  f.props = f.props.filter((p) => !p.blocking);
  const free = (x: number, y: number) =>
    f.tiles[y * f.width + x] === FLOOR && !f.doors.some((d) => d.x === x && d.y === y) && !f.stairs.some((s) => s.x === x && s.y === y);
  for (let y = 2; y < f.height - 6; y++) for (let x = 2; x < f.width - 6; x++) {
    for (const d of DIRS) {
      let ok = free(x, y) && free(x - DX[d], y - DY[d]);
      for (let k = 1; k <= 4 && ok; k++) ok = free(x + DX[d] * k, y + DY[d] * k);
      if (ok) {
        Object.assign(w.player, { x, y, facing: d });
        Object.assign(w.anim, { fromX: x, fromY: y, yaw: (d * Math.PI) / 2, yawTo: (d * Math.PI) / 2 });
        return w;
      }
    }
  }
  throw new Error('no arena');
}

/** Plant a trap `dist` tiles in front of the player, unspotted. */
function plant(w: World, kind: TrapKind, dist = 1): Trap {
  const t = w.frontTile(dist);
  const trap: Trap = { id: `x${kind}${dist}`, kind, x: t.x, y: t.y, armed: true, found: false, dir: 0 };
  w.floor.traps.push(trap);
  return trap;
}

function stepForward(w: World): void {
  w.press('forward');
  w.release('forward');
  tick(w, 0.5);
}

describe('traps', () => {
  it('spots the tile ahead before you step on it', () => {
    const w = arena();
    const trap = plant(w, 'spikes', 1);
    expect(trap.found).toBe(false);
    w.press('turnLeft');
    w.release('turnLeft');
    tick(w, 0.4);
    w.press('turnRight');
    w.release('turnRight');
    tick(w, 0.4);
    expect(trap.found).toBe(true);
    expect(trap.armed).toBe(true);
  });

  it('hurts you when you walk onto an armed one', () => {
    const w = arena();
    const trap = plant(w, 'spikes', 1);
    const hp = w.player.hp;
    stepForward(w);
    expect(w.player.hp).toBeLessThan(hp);
    expect(trap.armed).toBe(false);
    expect(trap.found).toBe(true);
  });

  it('only fires once', () => {
    const w = arena();
    plant(w, 'spikes', 1);
    stepForward(w);
    const hp = w.player.hp;
    // Step off and back on.
    w.press('back');
    w.release('back');
    tick(w, 0.5);
    stepForward(w);
    expect(w.player.hp).toBe(hp);
  });

  it('does no damage from a disarmed trap', () => {
    const w = arena();
    const trap = plant(w, 'spikes', 1);
    w.update(1 / 60);
    trap.found = true;
    expect(w.interactionHint()).toContain('Disarm');
    w.interact();
    expect(trap.armed).toBe(false);
    const hp = w.player.hp;
    stepForward(w);
    expect(w.player.hp).toBe(hp);
  });

  it('gets deadlier with depth', () => {
    const shallow = TRAPS.spikes.base + TRAPS.spikes.perDepth * 1;
    const deep = TRAPS.spikes.base + TRAPS.spikes.perDepth * 6;
    expect(deep).toBeGreaterThan(shallow * 2);
  });

  it('wakes the floor with an alarm ward instead of hurting you', () => {
    const w = arena();
    plant(w, 'alarm', 1);
    const t = w.frontTile(4);
    const e = createEnemy(enemyDef('rat'), t.x, t.y, turnAround(w.player.facing), 'sleeper', 1);
    e.alert = 0;
    w.floor.enemies.push(e);
    const hp = w.player.hp;
    stepForward(w);
    expect(w.player.hp).toBe(hp);
    expect(e.alert).toBeGreaterThan(0);
  });

  it('catches monsters that walk over it', () => {
    const w = arena();
    const trap = plant(w, 'spikes', 2);
    const e = createEnemy(enemyDef('rat'), trap.x, trap.y, turnAround(w.player.facing), 'walker', 1);
    const hp = e.hp;
    // Nudge it onto the plate the way the AI would.
    w.floor.enemies.push(e);
    e.x = trap.x + 1;
    e.y = trap.y;
    (w as unknown as { stepEnemy(en: EnemyState, x: number, y: number): void }).stepEnemy(e, trap.x, trap.y);
    expect(e.hp).toBeLessThan(hp);
    expect(trap.armed).toBe(false);
  });

  it('never dies to its own trap tile on arrival', () => {
    // Traps are kept clear of the tile you arrive on and its neighbours.
    for (let depth = 1; depth <= 6; depth++) {
      const f = generateFloor(4242, depth);
      const up = f.stairs.find((s) => !s.down)!;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        expect(trapAt(f, up.x + dx, up.y + dy)).toBeUndefined();
      }
    }
  });
});

describe('trap generation', () => {
  it('puts traps on every floor, more of them deeper', () => {
    let shallow = 0;
    let deep = 0;
    for (let seed = 0; seed < 12; seed++) {
      shallow += generateFloor(seed, 1).traps.length;
      deep += generateFloor(seed, 6).traps.length;
    }
    expect(shallow).toBeGreaterThan(0);
    expect(deep).toBeGreaterThan(shallow);
  });

  it('never blocks a floor or lands on furniture', () => {
    for (let seed = 0; seed < 8; seed++) {
      for (const depth of [1, 3, 6]) {
        const f = generateFloor(seed, depth);
        for (const t of f.traps) {
          expect(f.tiles[t.y * f.width + t.x]).toBe(FLOOR);
          expect(f.doors.some((d) => d.x === t.x && d.y === t.y)).toBe(false);
          expect(f.stairs.some((s) => s.x === t.x && s.y === t.y)).toBe(false);
          expect(f.props.some((p) => p.x === t.x && p.y === t.y && p.blocking)).toBe(false);
          expect(f.pickups.some((p) => p.x === t.x && p.y === t.y)).toBe(false);
        }
      }
    }
  });

  it('starts every trap hidden and armed', () => {
    for (const t of generateFloor(9, 4).traps) {
      expect(t.found).toBe(false);
      expect(t.armed).toBe(true);
    }
  });

  it('keeps them spread out', () => {
    for (let seed = 0; seed < 8; seed++) {
      const traps = generateFloor(seed, 5).traps;
      for (let i = 0; i < traps.length; i++) {
        for (let j = i + 1; j < traps.length; j++) {
          const d = Math.abs(traps[i].x - traps[j].x) + Math.abs(traps[i].y - traps[j].y);
          expect(d).toBeGreaterThan(0);
        }
      }
    }
  });

  it('is reproducible from the seed', () => {
    const a = generateFloor(77, 3).traps;
    const b = generateFloor(77, 3).traps;
    expect(a).toEqual(b);
  });
});

describe('the lantern', () => {
  function plantAhead(w: World, dist: number): Trap {
    const t = w.frontTile(dist);
    const trap: Trap = { id: `l${dist}`, kind: 'spikes', x: t.x, y: t.y, armed: true, found: false, dir: 0 };
    w.floor.traps.push(trap);
    return trap;
  }
  /** Force a look without moving: a turn away and back runs the spot pass. */
  function look(w: World): void {
    w.press('turnLeft');
    w.release('turnLeft');
    tick(w, 0.4);
    w.press('turnRight');
    w.release('turnRight');
    tick(w, 0.4);
  }

  it('reads the floor two tiles ahead without one', () => {
    const w = arena();
    const near = plantAhead(w, 2);
    const far = plantAhead(w, 3);
    look(w);
    expect(near.found).toBe(true);
    expect(far.found).toBe(false);
  });

  it('buys a third tile of warning at level 1', () => {
    const w = arena();
    w.state.meta.lantern = 1;
    const far = plantAhead(w, 3);
    look(w);
    expect(far.found).toBe(true);
  });

  it('throws light further with every level', () => {
    expect(lightRadius({})).toBe(BASE_LIGHT_RADIUS);
    expect(lightRadius({ lantern: 1 })).toBeGreaterThan(lightRadius({}));
    expect(lightRadius({ lantern: 3 })).toBeGreaterThan(lightRadius({ lantern: 1 }));
    // Still well inside the fog, so the dark stays the point.
    expect(lightRadius({ lantern: 3 })).toBeLessThan(18);
    expect(lightIntensity({ lantern: 3 })).toBeGreaterThan(lightIntensity({}));
  });
});
