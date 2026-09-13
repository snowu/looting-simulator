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

function arena(seed = 1, difficulty: 'normal' | 'hard' = 'hard'): World {
  const state = newGame(createRng(seed));
  state.difficulty = difficulty;
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

/** Put an adjacent melee enemy into its wind-up, aimed at where you stand. */
function windUp(w: World, e: EnemyState): void {
  e.ai = 'windup';
  e.timer = 0.12;
  e.alert = 6;
  e.lastSeenX = w.player.x;
  e.lastSeenY = w.player.y;
}

describe('parrying a melee attack', () => {
  it('denies the hit outright when the guard goes up in time', () => {
    const w = arena(2);
    const e = spawn(w, 'skeleton', 1);
    windUp(w, e);
    const hp = w.player.hp;
    w.setBlock(true);
    tick(w, 0.2);
    expect(w.player.hp).toBe(hp);
  });

  it('leaves the attacker reeling and open', () => {
    const w = arena(3);
    const e = spawn(w, 'skeleton', 1);
    windUp(w, e);
    w.setBlock(true);
    tick(w, 0.2);
    expect(e.ai).toBe('recover');
    expect(e.vuln).toBeGreaterThan(0);
  });

  it('briefly protects the player and staggers other adjacent enemies', () => {
    const w = arena(16);
    const attacker = spawn(w, 'skeleton', 1);
    const t = w.frontTile(-1);
    const other = createEnemy(enemyDef('rat'), t.x, t.y, w.player.facing, 'other', 1);
    w.floor.enemies.push(other);
    windUp(w, attacker);
    windUp(w, other);
    w.setBlock(true);
    tick(w, 0.15);

    expect(attacker.vuln).toBeGreaterThan(0);
    expect(other.ai).toBe('recover');
    expect(other.timer).toBeGreaterThan(0);
    expect(other.vuln ?? 0).toBe(0);

    const hp = w.player.hp;
    const front = w.frontTile();
    w.projectiles.push({
      id: 999, x: front.x + 0.5, y: front.y + 0.5,
      dx: -DX[w.player.facing], dy: -DY[w.player.facing], speed: 12,
      damage: 100, type: 'pierce', sprite: 'proj_arrow',
      tileX: front.x, tileY: front.y, source: 'a second attack',
    });
    tick(w, 0.06);
    expect(w.player.hp).toBe(hp);
  });

  it('extends melee parry immunity on Normal', () => {
    const hard = arena(18, 'hard');
    const normal = arena(18, 'normal');
    for (const w of [hard, normal]) {
      const e = spawn(w, 'skeleton', 1);
      windUp(w, e);
      e.timer = 0.01;
      w.setBlock(true);
      w.update(1 / 60);
    }

    expect(hard.anim.parryInvulnT).toBeCloseTo(0.75);
    expect(normal.anim.parryInvulnT).toBeCloseTo(1.25);
  });

  it('doubles what you land while the opening lasts', () => {
    const plain = arena(4);
    const a = spawn(plain, 'skeleton', 1);
    a.hp = 999;
    plain.attack();
    tick(plain, 1.2);
    const normal = 999 - a.hp;

    const parried = arena(4);
    const b = spawn(parried, 'skeleton', 1);
    b.hp = 999;
    windUp(parried, b);
    parried.setBlock(true);
    tick(parried, 0.2);
    parried.setBlock(false);
    const before = b.hp;
    parried.attack();
    tick(parried, 0.4);
    const boosted = before - b.hp;

    expect(normal).toBeGreaterThan(0);
    expect(boosted).toBeGreaterThan(normal * 1.5);
  });

  it('is a plain block, not a parry, if you were already turtling', () => {
    const w = arena(5);
    const e = spawn(w, 'skeleton', 1);
    w.setBlock(true);
    tick(w, 1.5); // guard up long before the swing
    windUp(w, e);
    const hp = w.player.hp;
    tick(w, 0.2);
    expect(w.player.hp).toBeLessThan(hp); // absorbed, not denied
    expect(e.vuln ?? 0).toBe(0);
  });

  it('cannot be re-armed by mashing block', () => {
    const w = arena(6);
    // Tap block repeatedly for a second; the window must not stay open.
    let open = 0;
    let frames = 0;
    for (let i = 0; i < 60; i++) {
      w.setBlock(i % 6 < 3);
      w.update(1 / 60);
      frames++;
      if (w.parryWindow) open++;
    }
    expect(open / frames).toBeLessThan(0.45);
  });

  it('does not parry a blow from behind', () => {
    const w = arena(7);
    const t = w.frontTile(-1);
    const e = createEnemy(enemyDef('skeleton'), t.x, t.y, w.player.facing, 'behind', 1);
    w.floor.enemies.push(e);
    windUp(w, e);
    const hp = w.player.hp;
    w.setBlock(true);
    tick(w, 0.2);
    expect(w.player.hp).toBeLessThan(hp);
  });
});

describe('parrying a projectile', () => {
  /** An archer lined up down the corridor, with a bolt already in flight. */
  function incoming(w: World, id = 'skeleton_archer'): EnemyState {
    const e = spawn(w, id, 4);
    e.ai = 'windup';
    e.timer = 0.01;
    e.alert = 6;
    e.lastSeenX = w.player.x;
    e.lastSeenY = w.player.y;
    return e;
  }

  it('sends the bolt back instead of taking it', () => {
    const w = arena(11);
    incoming(w);
    tick(w, 0.1);
    expect(w.projectiles.length).toBeGreaterThan(0);
    const hp = w.player.hp;
    // Wait until it is one tile out, then raise the guard.
    for (let i = 0; i < 200 && w.projectiles.length; i++) {
      const pr = w.projectiles[0];
      if (Math.abs(pr.tileX - w.player.x) + Math.abs(pr.tileY - w.player.y) <= 1) break;
      w.update(1 / 60);
    }
    w.setBlock(true);
    tick(w, 0.2);
    expect(w.player.hp).toBe(hp);
    const back = w.projectiles.find((p) => p.reflected);
    expect(back).toBeTruthy();
  });

  it('parries one additional bolt stacked behind the first', () => {
    const w = arena(17);
    incoming(w);
    tick(w, 0.1);
    for (let i = 0; i < 200 && w.projectiles.length; i++) {
      const pr = w.projectiles[0];
      if (Math.abs(pr.tileX - w.player.x) + Math.abs(pr.tileY - w.player.y) <= 1) break;
      w.update(1 / 60);
    }
    w.projectiles.push({ ...w.projectiles[0], id: 999 });
    const hp = w.player.hp;
    w.setBlock(true);
    tick(w, 0.2);

    expect(w.player.hp).toBe(hp);
    expect(w.projectiles.filter((p) => p.reflected)).toHaveLength(2);
  });

  it('extends the ranged follow-up window on Normal', () => {
    const hard = arena(19, 'hard');
    const normal = arena(19, 'normal');
    for (const w of [hard, normal]) {
      const t = w.frontTile();
      w.projectiles.push({
        id: 999, x: t.x + 0.5, y: t.y + 0.5,
        dx: -DX[w.player.facing], dy: -DY[w.player.facing], speed: 60,
        damage: 1, type: 'pierce', sprite: 'proj_arrow',
        tileX: t.x, tileY: t.y, source: 'an arrow',
      });
      w.setBlock(true);
      w.update(1 / 60);
    }

    expect(hard.anim.rangedParryT).toBeCloseTo(0.75);
    expect(normal.anim.rangedParryT).toBeCloseTo(1.25);
  });

  it('buries the reflected bolt in whatever is in its path', () => {
    const w = arena(12);
    const archer = incoming(w);
    const hp = archer.hp;
    tick(w, 0.1);
    for (let i = 0; i < 200 && w.projectiles.length; i++) {
      const pr = w.projectiles[0];
      if (Math.abs(pr.tileX - w.player.x) + Math.abs(pr.tileY - w.player.y) <= 1) break;
      w.update(1 / 60);
    }
    w.setBlock(true);
    tick(w, 0.2);
    expect(w.projectiles.some((p) => p.reflected)).toBe(true);
    tick(w, 2);
    expect(archer.hp).toBeLessThan(hp);
  });

  it('hits a monster standing right next to you, not just distant ones', () => {
    const w = arena(15);
    incoming(w);
    const adjacent = spawn(w, 'rat', 1);
    adjacent.ai = 'recover';
    adjacent.timer = 99;
    adjacent.hp = 200;
    const before = adjacent.hp;
    tick(w, 0.1);
    for (let i = 0; i < 200 && w.projectiles.length; i++) {
      const pr = w.projectiles[0];
      if (Math.abs(pr.tileX - w.player.x) + Math.abs(pr.tileY - w.player.y) <= 1) break;
      w.update(1 / 60);
    }
    w.setBlock(true);
    tick(w, 0.2);
    tick(w, 1);
    expect(adjacent.hp).toBeLessThan(before);
  });

  it('lets an incoming bolt pass through monsters on the way in', () => {
    const w = arena(13);
    incoming(w);
    // A second monster standing between the archer and you.
    const shield = spawn(w, 'rat', 2);
    shield.ai = 'idle';
    const shieldHp = shield.hp;
    tick(w, 0.1);
    const hp = w.player.hp;
    tick(w, 2);
    expect(shield.hp).toBe(shieldHp);
    expect(w.player.hp).toBeLessThan(hp);
  });

  it('turns an element back on something that fears it', () => {
    const w = arena(14);
    // A frost wisp's own bolt does nothing to it; a flame wraith's burns it.
    const wisp = incoming(w, 'flame_wraith');
    const target = spawn(w, 'frost_wisp', 3);
    target.ai = 'idle';
    const before = target.hp;
    tick(w, 0.1);
    for (let i = 0; i < 200 && w.projectiles.length; i++) {
      const pr = w.projectiles[0];
      if (Math.abs(pr.tileX - w.player.x) + Math.abs(pr.tileY - w.player.y) <= 1) break;
      w.update(1 / 60);
    }
    w.setBlock(true);
    tick(w, 0.2);
    tick(w, 2);
    expect(wisp).toBeTruthy();
    // The frost wisp stood between you and the wraith, so it eats the fire.
    expect(target.hp).toBeLessThan(before);
  });
});
