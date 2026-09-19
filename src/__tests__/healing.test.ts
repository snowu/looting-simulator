import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { BOSS_ID, enemyDef } from '../data/enemies';
import { newGame } from '../state/game-state';
import { addItem } from '../state/inventory';
import { createEnemy, FLOOR } from '../systems/dungeon';
import { makeConsumable, makeMaterial } from '../systems/items';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { migrateSave } from '../state/migrations';
import { draught } from '../systems/infusion';

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

  it('buffers a sip pressed mid-step instead of dropping it', () => {
    const w = arena(22);
    w.player.hp = 20;
    const charge = w.run.flask.charges;
    w.press('forward');
    w.update(1 / 60);
    w.release('forward');
    expect(w.moving).toBe(true);
    // Refused — but buffered, not lost.
    expect(w.sipFlask()).toBe(false);
    expect(w.anim.sip).toBeNull();
    tick(w, 0.3);
    expect(w.moving).toBe(false);
    expect(w.anim.sip).not.toBeNull();
    tick(w, 0.6);
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

  it('a flash scroll blinds only an alerted enemy looking at the player', () => {
    const w = arena(3);
    addItem(w.run.backpack, makeConsumable('scroll_flash', 2));
    const use = (): void => {
      w.use(w.run.backpack.items.find((i) => i.ref === 'scroll_flash')!.uid);
    };
    const t = w.frontTile(2);
    const e = createEnemy(enemyDef('skeleton'), t.x, t.y, turnAround(w.player.facing), 'watcher', 1);
    e.alert = 5;
    w.floor.enemies.push(e);
    use();
    expect(e.blind).toBe(2);
    // A second scroll on the same floor: each use spends a scroll, nothing else.
    e.blind = 0;
    use();
    expect(e.blind).toBe(2);
    expect(w.run.backpack.items.some((i) => i.ref === 'scroll_flash')).toBe(false);
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

  it('a quick draught shortens the sip and a thick one heals more', () => {
    const quick = arena(13);
    quick.state.flask.infusion = 'starwood';
    quick.player.hp = 20;
    expect(quick.sipFlask()).toBe(true);
    expect(quick.anim.sip).toBeCloseTo(0.2);

    const heal = (ref: string | null): number => {
      const w = arena(13);
      w.state.flask.infusion = ref;
      w.player.hp = 10;
      w.sipFlask();
      tick(w, 0.6);
      return w.player.hp - 10;
    };
    expect(heal('rat_hide')).toBeGreaterThan(heal(null));
    expect(heal('timber')).toBeLessThan(heal(null));
  });

  it('an iron draught blunts the next blow once', () => {
    const w = arena(14);
    w.state.flask.infusion = 'star_iron';
    w.player.hp = 20;
    w.sipFlask();
    tick(w, 0.6);
    expect(w.anim.draught?.kind).toBe('iron');
    const hp = w.player.hp;
    const t = w.frontTile(1);
    (w as unknown as { damagePlayer: (a: number, t: string, x: number, y: number, s: string) => void }).damagePlayer(10, 'slash', t.x, t.y, 'Test');
    expect(w.player.hp).toBe(hp);
    expect(w.anim.draught).toBeNull();
  });

  it('a marrow draught doubles the next landed strike and staggers it', () => {
    const strike = (ref: string | null): { dealt: number; ai: string; left: unknown } => {
      const w = arena(15);
      w.state.flask.infusion = ref;
      w.player.hp = 20;
      w.sipFlask();
      tick(w, 0.6);
      const t = w.frontTile(1);
      const e = createEnemy(enemyDef('skeleton'), t.x, t.y, turnAround(w.player.facing), 'striker', 1);
      e.hp = e.maxHp = 9999;
      e.ai = 'windup'; e.timer = 1;
      w.floor.enemies.push(e);
      (w as unknown as { rng: unknown }).rng = createRng(7);
      (w as unknown as { hitEnemy: (e: unknown) => void }).hitEnemy(e);
      return { dealt: 9999 - e.hp, ai: e.ai, left: w.anim.draught };
    };
    const plain = strike(null);
    const marrow = strike('titan_bone');
    expect(marrow.dealt).toBeGreaterThanOrEqual(plain.dealt * 2 - 1);
    expect(marrow.ai).toBe('recover');
    expect(marrow.left).toBeNull();
  });

  it('a kindled draught lends the gem its catalyst for a while, without touching attack', () => {
    const w = arena(16);
    const base = w.derived.attack;
    const baseLeech = w.derived.stats.leech;
    w.state.flask.infusion = 'shadow_essence';
    w.player.hp = 20;
    w.sipFlask();
    tick(w, 0.6);
    expect(w.derived.stats.leech - baseLeech).toBeGreaterThan(0);
    expect(w.derived.attack - base).toBe(0);
    tick(w, 8.1);
    expect(w.derived.stats.leech).toBe(baseLeech);
  });

  it('gives back a stat gem that can no longer sit in the flask', () => {
    const state = newGame(createRng(17));
    state.flask.infusion = 'emerald';
    (state as { revision?: number }).revision = 23;
    const out = migrateSave(state);
    expect(out.flask.infusion).toBeNull();
    expect(out.stash.items.some((it) => it.ref === 'emerald')).toBe(true);
    expect(draught('emerald')).toBeNull();
    expect(draught('flame_shard')?.kind).toBe('kindled');
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

  it('refuses scroll use once the run is over', () => {
    const w = arena(17);
    addItem(w.run.backpack, makeConsumable('scroll_backstep'));
    w.run.outcome = 'dead';
    w.use(w.run.backpack.items.find((i) => i.ref === 'scroll_backstep')!.uid);
    expect(w.run.backpack.items.some((i) => i.ref === 'scroll_backstep')).toBe(true);
  });

  it('a flash scroll blinds and washes the screen white', () => {
    const w = arena(18);
    addItem(w.run.backpack, makeConsumable('scroll_flash'));
    const t = w.frontTile(2);
    const e = createEnemy(enemyDef('skeleton'), t.x, t.y, turnAround(w.player.facing), 'lit', 1);
    e.alert = 5;
    w.floor.enemies.push(e);
    w.drainEvents();
    w.use(w.run.backpack.items.find((i) => i.ref === 'scroll_flash')!.uid);
    expect(e.blind).toBe(2);
    expect(w.run.backpack.items.some((i) => i.ref === 'scroll_flash')).toBe(false);
    const flash = w.drainEvents().find((ev) => ev.type === 'sigil');
    expect(flash).toMatchObject({ r: 1.0, g: 0.97, b: 0.88 });
    expect((flash as { strength: number }).strength).toBeGreaterThan(0.6);
  });

  it('a flash scroll burns on a whiff instead of being refused', () => {
    const w = arena(19);
    addItem(w.run.backpack, makeConsumable('scroll_flash'));
    // Nobody ahead, nobody looking: the flash still goes off, into nothing.
    w.drainEvents();
    w.use(w.run.backpack.items.find((i) => i.ref === 'scroll_flash')!.uid);
    expect(w.run.backpack.items.some((i) => i.ref === 'scroll_flash')).toBe(false);
    expect(w.drainEvents().some((ev) => ev.type === 'sigil')).toBe(true);
  });

  it('a backstep scroll returns along the trail', () => {
    const w = arena(20);
    addItem(w.run.backpack, makeConsumable('scroll_backstep'));
    // The arena helper teleports in, leaving a stale trail entry behind: let
    // it age out first so the trail only holds genuinely walked tiles.
    tick(w, 2.2);
    w.press('forward');
    const visited: { x: number; y: number }[] = [];
    for (let i = 0; i < 40 && visited.length < 2; i++) {
      w.update(1 / 60);
      const at = { x: w.player.x, y: w.player.y };
      if (!visited.some((v) => v.x === at.x && v.y === at.y)) visited.push(at);
    }
    expect(visited.length).toBe(2);
    w.use(w.run.backpack.items.find((i) => i.ref === 'scroll_backstep')!.uid);
    // The oldest recorded tile on the trail: the first tile genuinely arrived
    // at, which is where a real delve's path begins too.
    expect({ x: w.player.x, y: w.player.y }).toEqual(visited[0]);
    expect(w.run.backpack.items.some((i) => i.ref === 'scroll_backstep')).toBe(false);
  });

  it('a backstep scroll burns while standing still', () => {
    const w = arena(21);
    addItem(w.run.backpack, makeConsumable('scroll_backstep'));
    tick(w, 2.2);
    const at = { x: w.player.x, y: w.player.y };
    w.use(w.run.backpack.items.find((i) => i.ref === 'scroll_backstep')!.uid);
    expect(w.run.backpack.items.some((i) => i.ref === 'scroll_backstep')).toBe(false);
    expect({ x: w.player.x, y: w.player.y }).toEqual(at);
  });
  it('holds a held walk for a buffered sip so the sip lands between steps', () => {
    const w = arena(23);
    w.player.hp = 20;
    w.press('forward');
    w.update(1 / 60);
    expect(w.moving).toBe(true);
    expect(w.sipFlask()).toBe(false);
    tick(w, 0.3);
    // Still holding forward, but the landed step gave way to the sip.
    expect(w.anim.sip).not.toBeNull();
    w.release('forward');
  });

  it('searches a pile before eating the food under it, and eats once the pile is gone', () => {
    const w = arena(24);
    w.player.hp = 20;
    w.floor.pickups.push({ id: 'pile', x: w.player.x, y: w.player.y, items: [makeMaterial('copper', 1)], gold: 0 });
    w.floor.morsels = [{ id: 'm', kind: 'cut', x: w.player.x, y: w.player.y, remaining: 0.125, droppedAt: 0 }];
    w.drainEvents();
    expect(w.interactionHint()).toBe('Search');
    w.interact();
    expect(w.anim.chew).toBeNull();
    expect(w.drainEvents().some((ev) => ev.type === 'loot')).toBe(true);
    // The loot window's Eat button reaches the food without emptying the pile.
    expect(w.eatMorsel()).toBe(true);
    expect(w.anim.chew).not.toBeNull();
    tick(w, 1.3);
    w.floor.pickups = w.floor.pickups.filter((p) => p.id !== 'pile');
    w.floor.morsels = [{ id: 'm2', kind: 'scrap', x: w.player.x, y: w.player.y, remaining: 0.1, droppedAt: 0 }];
    expect(w.interactionHint()).toContain('Eat the scrap');
    w.interact();
    expect(w.anim.chew).not.toBeNull();
  });

  it('a flash scroll does nothing to the Ashen King but still burns', () => {
    const w = arena(25);
    addItem(w.run.backpack, makeConsumable('scroll_flash'));
    const t = w.frontTile(2);
    const king = createEnemy(enemyDef(BOSS_ID), t.x, t.y, turnAround(w.player.facing), 'king', 1);
    king.alert = 5;
    king.ai = 'windup';
    w.floor.enemies.push(king);
    w.use(w.run.backpack.items.find((i) => i.ref === 'scroll_flash')!.uid);
    expect(king.blind ?? 0).toBe(0);
    expect(king.ai).toBe('windup');
    expect(w.run.backpack.items.some((i) => i.ref === 'scroll_flash')).toBe(false);
  });
});
