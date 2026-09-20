import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { EnemyState, FLOOR, createEnemy } from '../systems/dungeon';
import { ENEMIES, enemyDef } from '../data/enemies';
import { BASIC, MOVES, MOVE_SETS, chooseMove, meleeReach, moveById, relativeDps } from '../data/attacks';

function tick(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

function arena(seed = 1): World {
  const state = newGame(createRng(seed));
  state.difficulty = 'hard';
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
      for (let k = 1; k <= 5 && ok; k++) ok = free(x + DX[d] * k, y + DY[d] * k);
      if (ok) {
        Object.assign(w.player, { x, y, facing: d });
        Object.assign(w.anim, { fromX: x, fromY: y, yaw: (d * Math.PI) / 2, yawTo: (d * Math.PI) / 2 });
        return w;
      }
    }
  }
  throw new Error('no arena');
}

function spawn(w: World, id: string, dist: number): EnemyState {
  const t = w.frontTile(dist);
  const e = createEnemy(enemyDef(id), t.x, t.y, turnAround(w.player.facing), `e${id}${dist}`, 1);
  w.floor.enemies.push(e);
  return e;
}

/** Put an enemy into a wind-up on a named move, aimed at where you stand. */
function windUp(w: World, e: EnemyState, move?: string): void {
  e.ai = 'windup';
  e.timer = 0.12;
  e.alert = 6;
  e.move = move;
  e.lastSeenX = w.player.x;
  e.lastSeenY = w.player.y;
}

describe('the move table', () => {
  it('keeps the plain blow as the identity: every multiplier is exactly 1', () => {
    // The whole safety of this feature rests on this. A creature with no move
    // set runs BASIC, and BASIC must be indistinguishable from the single beat
    // every monster had before move sets existed.
    expect(BASIC.windup).toBe(1);
    expect(BASIC.recovery).toBe(1);
    expect(BASIC.power).toBe(1);
    expect(BASIC.reach).toBe(1);
    expect(BASIC.sweep).toBeUndefined();
    expect(BASIC.combo).toBeUndefined();
    expect(BASIC.feint).toBeUndefined();
    expect(relativeDps(BASIC)).toBe(1);
  });

  it('prices every move within a tenth of the plain blow', () => {
    // Variety, not difficulty. A move that reaches further, hits harder or
    // strikes twice pays for it in wind-up or recovery. `sweep` is the one
    // deliberate exception and is allowed to sit low, because what it really
    // sells is taking a sidestep away.
    for (const move of Object.values(MOVES)) {
      const rel = relativeDps(move);
      expect(rel, `${move.id} damage over time vs a plain blow`).toBeGreaterThan(0.89);
      expect(rel, `${move.id} damage over time vs a plain blow`).toBeLessThan(1.1);
    }
  });

  it('gives every move a distinct tell colour, so two attacks never read alike', () => {
    const tells = Object.values(MOVES).map((m) => m.tell);
    expect(new Set(tells).size).toBe(tells.length);
  });

  it('names only moves that exist, in every set and on every creature', () => {
    for (const [name, set] of Object.entries(MOVE_SETS)) {
      for (const m of set) {
        expect(MOVES[m.id], `move set ${name} names ${m.id}`).toBeDefined();
        expect(m.weight).toBeGreaterThan(0);
      }
    }
    for (const def of ENEMIES) {
      for (const m of def.moves ?? []) {
        expect(MOVES[m.id], `${def.id} names ${m.id}`).toBeDefined();
      }
    }
  });

  it('leaves the King to his own script', () => {
    // Bosses run authored phases. A rolled move set on top of that would fight
    // the choreography rather than add to it.
    expect(ENEMIES.find((e) => e.behavior === 'boss')?.moves).toBeUndefined();
  });
});

describe('choosing a move', () => {
  it('falls back to the plain blow with no set, an empty set or no weight', () => {
    expect(chooseMove(undefined, () => 0).id).toBe('basic');
    expect(chooseMove([], () => 0).id).toBe('basic');
    expect(chooseMove([{ id: 'slam', weight: 0 }], () => 0).id).toBe('basic');
  });

  it('walks the weights in order', () => {
    const set = [{ id: 'jab', weight: 1 }, { id: 'slam', weight: 3 }];
    expect(chooseMove(set, () => 0.5).id).toBe('jab');
    expect(chooseMove(set, () => 1.5).id).toBe('slam');
    expect(chooseMove(set, (total) => total).id).toBe('slam');
  });

  it('reads an unknown move as a plain blow rather than throwing', () => {
    // Old saves hold an enemy mid-wind-up by move id. A build that renamed one
    // has to load that save, not crash on it.
    expect(moveById('no_such_move').id).toBe('basic');
    expect(moveById(undefined).id).toBe('basic');
  });

  it('reports the furthest reach in a set', () => {
    expect(meleeReach({})).toBe(1);
    expect(meleeReach({ moves: MOVE_SETS.vermin })).toBe(1);
    expect(meleeReach({ moves: MOVE_SETS.reaching })).toBe(2);
  });
});

describe('what a move does in the dungeon', () => {
  it('lands a plain blow exactly where it always did', () => {
    const w = arena(2);
    const e = spawn(w, 'skeleton', 1);
    windUp(w, e);
    const hp = w.player.hp;
    tick(w, 0.3);
    expect(w.player.hp).toBeLessThan(hp);
  });

  it('cannot reach you two tiles away with a plain blow', () => {
    const w = arena(3);
    const e = spawn(w, 'skeleton', 2);
    windUp(w, e);
    const hp = w.player.hp;
    tick(w, 0.3);
    expect(w.player.hp).toBe(hp);
  });

  it('reaches you two tiles away with a thrust', () => {
    const w = arena(3);
    const e = spawn(w, 'skeleton', 2);
    windUp(w, e, 'thrust');
    const hp = w.player.hp;
    tick(w, 0.3);
    expect(w.player.hp).toBeLessThan(hp);
  });

  it('will not thrust through a wall', () => {
    const w = arena(4);
    const e = spawn(w, 'skeleton', 2);
    // Brick up the tile between them: reach is a longer arm, not a spear
    // through stone.
    const mid = w.frontTile(1);
    w.floor.tiles[mid.y * w.floor.width + mid.x] = 0;
    windUp(w, e, 'thrust');
    const hp = w.player.hp;
    tick(w, 0.3);
    expect(w.player.hp).toBe(hp);
  });

  it('lands a flurry as several separate blows', () => {
    const w = arena(5);
    const e = spawn(w, 'skeleton', 1);
    windUp(w, e, 'flurry');
    let hits = 0;
    let hp = w.player.hp;
    for (let t = 0; t < 1.5; t += 1 / 60) {
      w.update(1 / 60);
      if (w.player.hp < hp) {
        hits++;
        hp = w.player.hp;
      }
    }
    expect(hits).toBe(1 + MOVES.flurry.combo!);
  });

  it('drops the rest of a flurry when the first blow is punished', () => {
    const w = arena(6);
    const e = spawn(w, 'skeleton', 1);
    windUp(w, e, 'flurry');
    tick(w, 0.3);
    // Opened up the way a parry opens one up: the follow-ups are the price.
    e.vuln = 1;
    const hp = w.player.hp;
    tick(w, 1);
    expect(w.player.hp).toBe(hp);
    expect(e.comboLeft).toBeUndefined();
  });

  it('holds a feint mid-lean, then throws the blow for real', () => {
    const w = arena(7);
    const e = spawn(w, 'skeleton', 1);
    const def = enemyDef('skeleton');
    e.ai = 'windup';
    e.alert = 6;
    e.move = 'feint';
    e.timer = def.windup * MOVES.feint.windup;
    e.lastSeenX = w.player.x;
    e.lastSeenY = w.player.y;
    const hp = w.player.hp;
    let held = 0;
    let struck = 0;
    for (let t = 0; t < 3; t += 1 / 60) {
      w.update(1 / 60);
      if ((e.feintT ?? 0) > 0) held += 1 / 60;
      if (!struck && w.player.hp < hp) struck = t;
    }
    // The lean froze for about the authored hold...
    expect(held).toBeGreaterThan(0.1);
    // ...and the blow still landed. A feint is a real attack, not a bluff,
    // which is what makes spending a parry on the stall cost something.
    expect(struck).toBeGreaterThan(def.windup * MOVES.feint.windup);
  });

  it('catches a sidestep with a sweep, which a plain blow does not', () => {
    for (const [move, expected] of [['basic', false], ['sweep', true]] as const) {
      const w = arena(8);
      const e = spawn(w, 'skeleton', 1);
      windUp(w, e, move === 'basic' ? undefined : move);
      // Step aside into the flank of the tile it is swinging through.
      const d = w.player.facing;
      w.player.x += DY[d];
      w.player.y += DX[d];
      const hp = w.player.hp;
      tick(w, 0.3);
      expect(w.player.hp < hp, `${move} against a sidestep`).toBe(expected);
    }
  });
});
