import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { EnemyState, FLOOR, createEnemy } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';

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

/** A shieldbearer one tile ahead, facing you, guard up. */
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

describe('shieldbearers', () => {
  it('turn a frontal blow, absorbing most of it', () => {
    const plain = arena(21);
    const a = bearer(plain, 'skeleton');
    a.hp = 500;
    swing(plain);
    const normal = 500 - a.hp;

    const w = arena(21);
    const e = bearer(w, 'goblin_shield');
    e.hp = 500;
    swing(w);
    const blocked = 500 - e.hp;

    expect(blocked).toBeGreaterThanOrEqual(0);
    expect(blocked).toBeLessThan(normal);
    expect(e.blocks).toBe(1);
  });

  it('take the full blow from behind', () => {
    const w = arena(22);
    const t = w.frontTile(1);
    // Facing away: same direction you face, so your swing lands in its back.
    const e = createEnemy(enemyDef('goblin_shield'), t.x, t.y, w.player.facing, 'back', 1);
    e.ai = 'chase';
    e.alert = 6;
    e.attackCd = 99;
    w.floor.enemies.push(e);
    e.hp = 500;
    swing(w);
    const dmg = 500 - e.hp;
    expect(dmg).toBeGreaterThan(0);
    expect(e.blocks ?? 0).toBe(0);
  });

  it('cannot block while reeling from your parry', () => {
    const w = arena(23);
    const e = bearer(w, 'goblin_shield');
    e.hp = 500;
    e.vuln = 1;
    swing(w);
    const dmg = 500 - e.hp;
    expect(dmg).toBeGreaterThan(2);
    expect(e.blocks ?? 0).toBe(0);
  });

  it('cannot block mid-swing, and can still be staggered out of it', () => {
    const w = arena(24);
    const e = bearer(w, 'goblin_shield');
    e.hp = 500;
    e.ai = 'windup';
    e.timer = 99; // held mid-swing: guard down
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

  /** Swing until the bash lands; the stun only lasts a second, so don't blink. */
  function bash(w: World, e: EnemyState): void {
    swing(w);
    expect(e.blocks).toBe(1);
    expect(w.anim.stunT).toBe(0);
    w.player.stamina = w.derived.maxStamina;
    w.attack();
    for (let i = 0; i < 120 && (e.blocks ?? 0) > 0; i++) w.update(1 / 60);
    // Bashed: guard dropped, stunned, bearer swinging at a helpless you.
    expect(e.blocks).toBe(0);
    expect(w.anim.stunT).toBeGreaterThan(0);
    expect(e.ai).toBe('windup');
  }

  it('bashes back after the second consecutive blocked blow', () => {
    const w = arena(25);
    const e = bearer(w, 'goblin_shield');
    e.hp = 500;
    bash(w, e);
  });

  it('lands the sure hit through a held guard', () => {
    const w = arena(26);
    const e = bearer(w, 'goblin_shield');
    e.hp = 500;
    bash(w, e);
    const hp = w.player.hp;
    w.setBlock(true); // guard stays down while stunned
    tick(w, 1.5);
    expect(w.player.hp).toBeLessThan(hp);
  });

  it('lets the count go stale if you back off', () => {
    const w = arena(27);
    const e = bearer(w, 'goblin_shield');
    e.hp = 9999;
    swing(w);
    expect(e.blocks).toBe(1);
    tick(w, 3); // longer than the block memory
    const before = e.hp;
    w.player.stamina = w.derived.maxStamina;
    w.attack();
    tick(w, 1.5);
    // Fresh count: blocked once, no bash yet.
    expect(e.blocks).toBe(1);
    expect(w.anim.stunT).toBe(0);
    expect(before - e.hp).toBeGreaterThanOrEqual(0);
  });

  it('breaks the count when one gets through', () => {
    const w = arena(28);
    const e = bearer(w, 'goblin_shield');
    e.hp = 500;
    swing(w);
    expect(e.blocks).toBe(1);
    // Circle behind for the next swing.
    e.facing = w.player.facing;
    swing(w);
    expect(e.blocks).toBe(0);
    expect(w.anim.stunT).toBe(0);
  });
});

describe('goblin archer', () => {
  it('looses arrows down a corridor like its bony cousin', () => {
    const w = arena(29);
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
