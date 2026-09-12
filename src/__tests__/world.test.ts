import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, Dir, turnAround } from '../core/dir';
import { newGame } from '../state/game-state';
import { startRun, endRun } from '../systems/run';
import { World } from '../world/world';
import { FLOOR, createEnemy, stairsFront } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { addItem } from '../state/inventory';
import { makeMaterial } from '../systems/items';

function tick(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

/** A world with no enemies, the player on a tile with a free 4-tile run ahead. */
function arena(seed = 1): World {
  const state = newGame(createRng(seed));
  startRun(state, seed);
  const w = new World(state);
  const f = w.floor;
  f.enemies = [];
  f.props = f.props.filter((p) => !p.blocking);
  const free = (x: number, y: number) =>
    f.tiles[y * f.width + x] === FLOOR && !f.doors.some((d) => d.x === x && d.y === y) && !f.stairs.some((s) => s.x === x && s.y === y);
  for (let y = 2; y < f.height - 6; y++) for (let x = 2; x < f.width - 6; x++) {
    for (const d of DIRS) {
      let ok = free(x, y) && free(x - DX[d], y - DY[d]);
      for (let k = 1; k <= 4 && ok; k++) ok = free(x + DX[d] * k, y + DY[d] * k);
      if (ok) {
        Object.assign(w.player, { x, y, facing: d });
        Object.assign(w.anim, { fromX: x, fromY: y, yaw: d * Math.PI / 2, yawTo: d * Math.PI / 2 });
        return w;
      }
    }
  }
  throw new Error('no arena');
}

function spawn(w: World, id: string, dist: number) {
  const t = w.frontTile(dist);
  const e = createEnemy(enemyDef(id), t.x, t.y, turnAround(w.player.facing), `t${id}${dist}`, 1);
  w.floor.enemies.push(e);
  return e;
}

describe('World', () => {
  it('steps and turns on the grid', () => {
    const w = arena();
    const { x, y, facing } = w.player;
    w.press('forward');
    w.release('forward');
    tick(w, 0.5);
    expect(w.player.x).toBe(x + DX[facing]);
    expect(w.player.y).toBe(y + DY[facing]);
    w.press('turnRight');
    w.release('turnRight');
    tick(w, 0.3);
    expect(w.player.facing).toBe(((facing + 1) % 4) as Dir);
  });

  it('a skeleton next to you winds up and hits', () => {
    const w = arena(2);
    spawn(w, 'skeleton', 1);
    const hp = w.player.hp;
    tick(w, 3);
    expect(w.player.hp).toBeLessThan(hp);
  });

  it('blocking with a shield takes the sting out', () => {
    const lost = (block: boolean) => {
      const w = arena(3);
      spawn(w, 'ghoul', 1);
      if (block) w.setBlock(true);
      const hp = w.player.hp;
      tick(w, 4);
      return hp - w.player.hp;
    };
    expect(lost(true)).toBeLessThan(lost(false));
  });

  it('stepping away from a telegraphed attack dodges it', () => {
    const w = arena(4);
    const e = spawn(w, 'ghoul', 1);
    // Let it notice us and start winding up, then back off.
    for (let i = 0; i < 200 && e.ai !== 'windup'; i++) w.update(1 / 60);
    expect(e.ai).toBe('windup');
    const hp = w.player.hp;
    w.press('back');
    w.release('back');
    for (let i = 0; i < 60 && e.ai === 'windup'; i++) w.update(1 / 60);
    expect(w.player.hp).toBe(hp);
  });

  it('swinging kills a rat and drops loot', () => {
    const w = arena(5);
    spawn(w, 'rat', 1);
    for (let i = 0; i < 12 && w.run.stats.kills === 0; i++) {
      w.attack();
      tick(w, 0.7);
    }
    expect(w.run.stats.kills).toBe(1);
  });

  it('archers shoot along the row and the bolt hurts', () => {
    const w = arena(6);
    spawn(w, 'skeleton_archer', 4);
    const hp = w.player.hp;
    tick(w, 4);
    expect(w.player.hp).toBeLessThan(hp);
  });

  it('the one-button action swings at enemies, urns and air, and loots otherwise', () => {
    const w = arena(10);
    expect(w.contextAction().kind).toBe('attack');
    const t = w.frontTile();
    w.floor.pickups.push({ id: 'tp', x: t.x, y: t.y, items: [makeMaterial('silver', 1)], gold: 0 });
    expect(w.contextAction()).toEqual({ kind: 'interact', label: 'Loot' });
    spawn(w, 'rat', 1);
    expect(w.contextAction().kind).toBe('attack');
    w.floor.enemies = [];
    w.floor.pickups = [];
    w.floor.props.push({ id: 'tu', kind: 'urn', x: t.x, y: t.y, used: false, tier: 'urn', blocking: true });
    expect(w.contextAction().kind).toBe('attack');
    w.floor.props = [{ id: 'tc', kind: 'chest', x: t.x, y: t.y, used: false, tier: 'chest', blocking: true }];
    expect(w.contextAction()).toEqual({ kind: 'interact', label: 'Open' });
  });

  it('walking into the down stairs moves you a floor deeper', () => {
    const state = newGame(createRng(7));
    startRun(state, 7);
    const w = new World(state);
    w.floor.enemies = [];
    const down = w.floor.stairs.find((s) => s.down)!;
    const front = stairsFront(down);
    Object.assign(w.player, { x: front.x, y: front.y, facing: down.dir });
    w.press('forward');
    w.release('forward');
    tick(w, 1.5);
    expect(w.run.depth).toBe(2);
    expect(w.run.floors[1]).toBeTruthy();
  });

  it('leaving by the entrance banks the backpack', () => {
    const state = newGame(createRng(8));
    startRun(state, 8);
    const w = new World(state);
    w.floor.enemies = [];
    addItem(w.run.backpack, makeMaterial('silver', 3));
    const up = w.floor.stairs.find((s) => !s.down)!;
    Object.assign(w.player, { facing: up.dir });
    w.press('forward');
    w.release('forward');
    tick(w, 0.6);
    expect(w.run.outcome).toBe('extracted');
    const day = state.market.day;
    const summary = endRun(state, 'extracted');
    // Your haul banks, but turning round at the entrance earns no renown —
    // otherwise a single step in and out farms the whole upgrade tree.
    expect(summary.renown).toBe(0);
    expect(state.stash.items.some((i) => i.ref === 'silver')).toBe(true);
    // Nor does the day turn: in and out would otherwise reroll the market free.
    expect(state.market.day).toBe(day);
    expect(state.run).toBeNull();
  });

  it('dying loses the backpack', () => {
    const w = arena(9);
    addItem(w.run.backpack, makeMaterial('gold', 2));
    w.player.hp = 1;
    spawn(w, 'ghoul', 1);
    tick(w, 4);
    expect(w.run.outcome).toBe('dead');
    const summary = endRun(w.state, 'dead');
    expect(summary.lost.some((i) => i.ref === 'gold')).toBe(true);
    expect(w.state.stash.items.some((i) => i.ref === 'gold')).toBe(false);
  });
});
