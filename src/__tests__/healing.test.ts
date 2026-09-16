import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { enemyDef } from '../data/enemies';
import { newGame } from '../state/game-state';
import { addItem } from '../state/inventory';
import { createEnemy, FLOOR } from '../systems/dungeon';
import { makeConsumable } from '../systems/items';
import { startRun } from '../systems/run';
import { World } from '../world/world';

function tick(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

function arena(seed = 1): World {
  const state = newGame(createRng(seed));
  startRun(state, seed);
  const w = new World(state);
  w.floor.enemies = [];
  w.floor.props = w.floor.props.filter((p) => !p.blocking);
  const free = (x: number, y: number) => w.floor.tiles[y * w.floor.width + x] === FLOOR;
  for (let y = 3; y < w.floor.height - 4; y++) for (let x = 3; x < w.floor.width - 4; x++) for (const d of DIRS) {
    if (free(x, y) && free(x + DX[d], y + DY[d]) && free(x + DX[d] * 2, y + DY[d] * 2)) {
      Object.assign(w.player, { x, y, facing: d });
      Object.assign(w.anim, { fromX: x, fromY: y, yaw: d * Math.PI / 2, yawTo: d * Math.PI / 2 });
      return w;
    }
  }
  throw new Error('no arena');
}

describe('healing rework', () => {
  it('lands a flask sip only after its commitment and spends one charge', () => {
    const w = arena();
    w.player.hp = 20;
    const charge = w.run.flask.charges;
    expect(w.sipFlask()).toBe(true);
    tick(w, 0.45);
    expect(w.player.hp).toBe(20);
    expect(w.run.flask.charges).toBe(charge);
    tick(w, 0.1);
    expect(w.player.hp).toBeGreaterThan(20);
    expect(w.run.flask.charges).toBe(charge - 1);
  });

  it('eats floor food over time and sends overheal into dregs', () => {
    const w = arena(2);
    w.player.hp = w.derived.maxHp;
    w.floor.morsels = [{ id: 'm', kind: 'heart', x: w.player.x, y: w.player.y, remaining: 0.15, droppedAt: 0 }];
    expect(w.interactionHint()).toContain('you are not hurt');
    w.interact();
    tick(w, 1.3);
    expect(w.floor.morsels).toEqual([]);
    expect(w.run.flask.dregs).toBeGreaterThan(0);
  });

  it('flashes only an alerted enemy looking at the player and spends the shared floor tear', () => {
    const w = arena(3);
    addItem(w.run.backpack, makeConsumable('scroll_identify'));
    const t = w.frontTile(2);
    const e = createEnemy(enemyDef('skeleton'), t.x, t.y, turnAround(w.player.facing), 'watcher', 1);
    e.alert = 5;
    w.floor.enemies.push(e);
    expect(w.tear('scroll_identify')).toBe(true);
    expect(e.blind).toBe(2);
    expect(w.run.tornDepths).toEqual([1]);
    expect(w.tear('scroll_identify')).toBe(false);
  });

  it('lands a mid-sip blow unblocked even with the guard raised', () => {
    const stage = (sip: boolean): number => {
      const w = arena(11);
      w.player.hp = 20;
      w.setBlock(true);
      tick(w, 0.5); // guard fully up, parry window long expired
      const t = w.frontTile(1);
      const e = createEnemy(enemyDef('skeleton'), t.x, t.y, turnAround(w.player.facing), 'striker', 1);
      e.ai = 'windup'; e.timer = 0; e.alert = 6;
      e.lastSeenX = w.player.x; e.lastSeenY = w.player.y;
      w.floor.enemies.push(e);
      if (sip) expect(w.sipFlask()).toBe(true);
      for (let i = 0; i < 30 && w.player.hp >= 20; i++) w.update(1 / 60);
      return 20 - w.player.hp;
    };
    const blocked = stage(false);
    const midSip = stage(true);
    expect(blocked).toBeGreaterThan(0);
    expect(midSip).toBeGreaterThan(blocked);
  });

  it('refuses to raise the guard while sipping', () => {
    const w = arena(12);
    w.player.hp = 20;
    w.setBlock(true);
    tick(w, 0.3);
    expect(w.anim.blockRaise).toBe(1);
    expect(w.sipFlask()).toBe(true);
    w.setBlock(true);
    tick(w, 0.3);
    expect(w.anim.blockRaise).toBeLessThan(0.5);
  });

  it('grants a bone infusion attack once, not twice', () => {
    const w = arena(13);
    const base = w.derived.attack;
    const baseStats = w.derived.stats.attack;
    w.state.flask.infusion = 'bone';
    w.anim.infusionT = 6;
    w.refreshDerived();
    expect(w.derived.stats.attack - baseStats).toBe(1);
    expect(w.derived.attack - base).toBe(1);
  });

  it('grants a gem infusion as its catalyst affix without touching attack', () => {
    const w = arena(14);
    const base = w.derived.attack;
    const baseLeech = w.derived.stats.leech;
    w.state.flask.infusion = 'shadow_essence';
    w.anim.infusionT = 6;
    w.refreshDerived();
    expect(w.derived.stats.leech - baseLeech).toBeGreaterThan(0);
    expect(w.derived.attack - base).toBe(0);
  });

  it('refuses to drink fight milk and points at the forge instead', () => {
    const w = arena(15);
    addItem(w.run.backpack, makeConsumable('fight_milk'));
    const bottle = w.run.backpack.items.find((i) => i.ref === 'fight_milk')!;
    const qty = bottle.qty;
    w.use(bottle.uid);
    expect(bottle.qty).toBe(qty);
    expect(w.run.tonics ?? []).toEqual([]);
    expect(w.quickRefs()).not.toContain('fight_milk');
  });

  it('eats on F even while hunted, but the one-button tap still swings', () => {
    const w = arena(16);
    w.player.hp = 20;
    w.floor.morsels = [{ id: 'm', kind: 'scrap', x: w.player.x, y: w.player.y, remaining: 0.1, droppedAt: 0 }];
    const t = w.frontTile(1);
    const e = createEnemy(enemyDef('skeleton'), t.x, t.y, turnAround(w.player.facing), 'hunter', 1);
    e.alert = 6;
    w.floor.enemies.push(e);
    expect(w.contextAction().kind).toBe('attack');
    w.interact();
    expect(w.anim.chew).not.toBeNull();
  });

  it('refuses tears once the run is over', () => {
    const w = arena(17);
    addItem(w.run.backpack, makeConsumable('scroll_recall'));
    w.run.outcome = 'dead';
    expect(w.tear('scroll_recall')).toBe(false);
    expect(w.run.tornDepths).toEqual([]);
  });
});
