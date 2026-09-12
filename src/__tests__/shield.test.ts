import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { EnemyState, FLOOR, createEnemy } from '../systems/dungeon';
import { ENEMIES, enemyDef } from '../data/enemies';
import { getArt } from '../art/registry';

function tick(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

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

/** A shieldbearer one tile ahead, facing you, held still. */
function bearer(w: World, id = 'goblin_shield'): EnemyState {
  const t = w.frontTile(1);
  const e = createEnemy(enemyDef(id), t.x, t.y, turnAround(w.player.facing), `e${id}`, 1);
  e.ai = 'chase';
  e.alert = 6;
  e.attackCd = 99; // hold still: no swings of its own unless bashed
  w.floor.enemies.push(e);
  return e;
}

/** One full swing and its recovery. */
function swing(w: World): void {
  w.player.stamina = w.derived.maxStamina;
  w.attack();
  tick(w, 1.5);
}

describe('the guard rhythm', () => {
  it('raises while you close in, holds, then drops on its own', () => {
    const w = arena(31);
    const e = bearer(w);
    expect(e.guard ?? 'down').toBe('down');
    tick(w, 0.1); // threat near and no cooldown: guard comes straight up
    expect(e.guard).toBe('raising');
    tick(w, 0.3);
    expect(e.guard).toBe('up');
    tick(w, 1.5);
    expect(e.guard).toBe('down');
  });

  it('chips a blow into the held guard, with no stagger', () => {
    const plain = arena(32);
    const a = bearer(plain, 'skeleton');
    a.hp = 500;
    a.guard = 'down';
    a.guardT = 99; // never raises: plain comparison swing
    swing(plain);
    const normal = 500 - a.hp;

    const w = arena(32);
    const e = bearer(w, 'goblin_shield');
    e.hp = 500;
    e.guard = 'up';
    e.guardT = 99; // held: the rhythm cannot drop it mid-swing
    e.attackCd = 99;
    swing(w);
    const chipped = 500 - e.hp;

    expect(chipped).toBeGreaterThanOrEqual(0);
    expect(chipped).toBeLessThan(normal);
    expect(e.blocks).toBe(1);
    expect(e.ai).not.toBe('recover');
  });

  /** Swing into a frozen raise; the stun only lasts a second, so catch it fresh. */
  function bashed(w: World, e: EnemyState): void {
    e.guard = 'raising';
    e.guardT = 99; // frozen mid-sweep
    e.attackCd = 99; // passive until the bash starts its swing
    w.player.stamina = w.derived.maxStamina;
    w.attack();
    for (let i = 0; i < 120 && w.anim.stunT <= 0; i++) w.update(1 / 60);
    expect(e.blocks ?? 0).toBe(0);
    expect(w.anim.stunT).toBeGreaterThan(0);
    expect(e.ai).toBe('windup');
    expect(e.guard).toBe('down');
  }

  it('bashes a blow into the raise: guard drops, you reel, it swings', () => {
    const w = arena(33);
    const e = bearer(w, 'goblin_shield');
    e.hp = 500;
    bashed(w, e);
  });

  it('lands the sure hit through a held guard', () => {
    const w = arena(34);
    const e = bearer(w, 'goblin_shield');
    e.hp = 500;
    bashed(w, e);
    const hp = w.player.hp;
    w.setBlock(true); // guard stays down while stunned
    tick(w, 1.5);
    expect(w.player.hp).toBeLessThan(hp);
  });

  it('sags the guard after three consecutive chips', () => {
    const w = arena(35);
    const e = bearer(w, 'goblin_shield');
    e.hp = 9999;
    for (let i = 0; i < 3; i++) {
      e.guard = 'up';
      e.guardT = 99;
      e.attackCd = 99;
      swing(w);
    }
    expect(e.guard).toBe('down');
    expect(e.blocks).toBe(0);
    // And the opening is real: the next swing lands full.
    e.guardT = 99; // rhythm held off so nothing re-raises mid-swing
    const before = e.hp;
    swing(w);
    expect(before - e.hp).toBeGreaterThan(2);
  });

  it('takes the full blow from behind, even held', () => {
    const w = arena(36);
    const t = w.frontTile(1);
    const e = createEnemy(enemyDef('goblin_shield'), t.x, t.y, w.player.facing, 'back', 1);
    e.ai = 'chase';
    e.alert = 6;
    e.attackCd = 99;
    e.guard = 'up';
    e.guardT = 99;
    w.floor.enemies.push(e);
    e.hp = 500;
    swing(w);
    expect(500 - e.hp).toBeGreaterThan(2);
    expect(e.blocks ?? 0).toBe(0);
  });

  it('cannot guard while reeling from your parry', () => {
    const w = arena(37);
    const e = bearer(w, 'goblin_shield');
    e.hp = 500;
    e.guard = 'up';
    e.guardT = 99;
    e.vuln = 1;
    swing(w);
    expect(500 - e.hp).toBeGreaterThan(2);
    expect(e.blocks ?? 0).toBe(0);
  });

  it('cannot guard mid-swing, and can still be staggered out of it', () => {
    const w = arena(38);
    const e = bearer(w, 'goblin_shield');
    e.hp = 500;
    e.guard = 'up'; // guard means nothing once committed
    e.guardT = 99;
    e.ai = 'windup';
    e.timer = 99;
    e.alert = 6;
    e.lastSeenX = w.player.x;
    e.lastSeenY = w.player.y;
    w.player.stamina = w.derived.maxStamina;
    w.attack();
    for (let i = 0; i < 120 && e.hp === 500; i++) w.update(1 / 60);
    expect(e.hp).toBeLessThan(500);
    expect(e.blocks ?? 0).toBe(0);
    expect(e.ai).toBe('recover'); // light foe interrupted, as usual
  });

  it('drops the guard to swing: no block on the way in', () => {
    const w = arena(39);
    const e = bearer(w, 'goblin_shield');
    e.hp = 500;
    e.guard = 'up';
    e.guardT = 99;
    e.ai = 'windup';
    e.timer = 0.1; // about to land its own hit: guard already down
    e.alert = 6;
    e.lastSeenX = w.player.x;
    e.lastSeenY = w.player.y;
    // beginWindup is what a live swing goes through; take the same path.
    (w as unknown as { beginWindup(e: EnemyState, def: unknown, x: number, y: number): void })
      .beginWindup(e, enemyDef('goblin_shield'), w.player.x, w.player.y);
    expect(e.guard).toBe('down');
  });
});

describe('the hollow knight', () => {
  it('holds the same guard: chips held blows, bashes the raise', () => {
    const w = arena(41);
    const e = bearer(w, 'hollow_knight');
    e.hp = 500;
    e.guard = 'up';
    e.guardT = 99;
    e.attackCd = 99;
    w.player.stamina = w.derived.maxStamina;
    w.attack();
    tick(w, 1.5);
    expect(500 - e.hp).toBeGreaterThanOrEqual(0);
    expect(500 - e.hp).toBeLessThan(20); // chipped, not mauled
    expect(e.blocks).toBe(1);
  });
});

describe('shield art', () => {
  it('every bearer has idle, guard and attack frames registered', () => {
    for (const def of ENEMIES) {
      if (!def.shield) continue;
      for (const frame of ['0', 'block', 'atk']) {
        expect(getArt(`${def.sprite}_${frame}`), `${def.sprite}_${frame}`).toBeTruthy();
      }
    }
    expect(ENEMIES.some((d) => d.shield)).toBe(true);
  });
});

describe('goblin archer', () => {
  it('looses arrows down a corridor like its bony cousin', () => {
    const w = arena(40);
    const t = w.frontTile(4);
    const e = createEnemy(enemyDef('goblin_archer'), t.x, t.y, turnAround(w.player.facing), 'ga', 1);
    e.ai = 'windup';
    e.timer = 0.01;
    e.alert = 6;
    e.lastSeenX = w.player.x;
    e.lastSeenY = w.player.y;
    w.floor.enemies.push(e);
    tick(w, 0.2);
    expect(w.projectiles.length).toBeGreaterThan(0);
    expect(w.projectiles[0].sprite).toBe('proj_arrow');
  });
});
