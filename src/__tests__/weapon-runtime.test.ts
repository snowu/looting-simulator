import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, turnAround, turnLeft, turnRight } from '../core/dir';
import { enemyDef } from '../data/enemies';
import { newGame } from '../state/game-state';
import { parseSave, serializeSave } from '../state/save-format';
import { createEnemy, EnemyState, FLOOR } from '../systems/dungeon';
import { durability, makeEquipment } from '../systems/items';
import { derivePlayer, emptyEquipment } from '../systems/player';
import { startRun } from '../systems/run';
import { Rarity } from '../types';
import { World } from '../world/world';

function weapon(baseId: string) {
  return makeEquipment({ baseId, materialId: 'iron', rarity: Rarity.Common, ilvl: 4, quality: 1 });
}

function tick(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

function arena(baseId: string, seed = 701): World {
  const state = newGame(createRng(seed));
  state.equipment.weapon = weapon(baseId);
  state.equipment.offhand = null;
  startRun(state, seed);
  const w = new World(state);
  const f = w.floor;
  f.enemies = [];
  f.traps = [];
  f.props = f.props.filter((p) => !p.blocking);
  const x = 10, y = 10, d = DIRS[0];
  const clear = [{ x, y }];
  for (const side of [d, turnLeft(d), turnRight(d)]) clear.push({ x: x + DX[side], y: y + DY[side] });
  for (let n = 1; n <= 7; n++) clear.push({ x: x + DX[d] * n, y: y + DY[d] * n });
  for (const tile of clear) f.tiles[tile.y * f.width + tile.x] = FLOOR;
  f.doors = f.doors.filter((door) => !clear.some((tile) => tile.x === door.x && tile.y === door.y));
  f.stairs = f.stairs.filter((stairs) => !clear.some((tile) => tile.x === stairs.x && tile.y === stairs.y));
  Object.assign(w.player, { x, y, facing: d });
  Object.assign(w.anim, { fromX: x, fromY: y, moveT: 1, turnT: 1, yaw: d * Math.PI / 2, yawTo: d * Math.PI / 2 });
  return w;
}

/**
 * Enough health to survive anything the player can swing.
 *
 * A cleave test measures the ratio between the main blow and the spill, and
 * `maxHp - hp` silently caps at `maxHp` once the target dies — so a weapon that
 * one-shots its target reads as a cleave doing most of the damage of a hit it
 * cannot see the true size of. Two-handers now kill a depth-1 skeleton outright,
 * which is the balance working, not the cleave misbehaving.
 */
function tanky(e: EnemyState): EnemyState {
  e.hp = e.maxHp = 100000;
  return e;
}

/** Hold an enemy exactly where it was put, through a wind-up it can see. */
function root(e: EnemyState): EnemyState {
  e.ai = 'recover';
  e.timer = 99;
  e.attackCd = 99;
  return e;
}

function at(w: World, dist: number, id = 'skeleton'): EnemyState {
  const d = w.player.facing;
  const e = createEnemy(enemyDef(id), w.player.x + DX[d] * dist, w.player.y + DY[d] * dist, turnAround(d), `${id}:${dist}`, 1);
  w.floor.enemies.push(e);
  return root(e);
}

function place(w: World, dir = w.player.facing, id = 'skeleton'): EnemyState {
  const e = createEnemy(enemyDef(id), w.player.x + DX[dir], w.player.y + DY[dir], turnAround(dir), `${id}:${dir}`, 1);
  e.attackCd = 99;
  e.alert = 6;
  w.floor.enemies.push(e);
  return e;
}

describe('two-handed runtime', () => {
  it('suppresses every offhand contribution and preserves handling fields', () => {
    const eq = emptyEquipment();
    eq.weapon = weapon('greatsword');
    eq.offhand = makeEquipment({ baseId: 'tower_shield', materialId: 'iron', rarity: Rarity.Legendary, ilvl: 9, quality: 1, affixes: [{ id: 'vital', value: 50 }] });
    const d = derivePlayer(eq, {});
    const bare = derivePlayer({ ...eq, offhand: null }, {});
    expect(d.block).toBe(0.2);
    expect(d.hasShield).toBe(false);
    expect(d.stats).toEqual(bare.stats);
    expect(d.traits).toEqual(bare.traits);
    expect(d.swing).toMatchObject({ cleave: 0.25, stagger: 0.3, chips: 2 });
  });

  it('cleaves everything touching the target for a quarter, never bashes, and wears three times', () => {
    const w = arena('great_maul');
    const front = tanky(place(w));
    // Diagonally off the target, which is beside the player: caught by the
    // cleave because it touches the target, not because it touches the player.
    const left = tanky(place(w, turnLeft(w.player.facing)));
    const guard = place(w, turnRight(w.player.facing), 'goblin_shield');
    guard.guard = 'raising';
    guard.guardT = 99;
    const item = w.state.equipment.weapon!;
    const before = durability(item).cur;
    w.attack();
    tick(w, 1.4);
    const mainDamage = front.maxHp - front.hp;
    const cleaveDamage = left.maxHp - left.hp;
    expect(mainDamage).toBeGreaterThan(0);
    expect(cleaveDamage).toBeGreaterThan(0);
    // A spill, not a second swing. The damage roll varies ±10%, so the bound is
    // loose on purpose — what it pins is the order of magnitude.
    expect(cleaveDamage).toBeLessThan(mainDamage * 0.5);
    // A cleaved blow is glancing: one chip, never the two the full swing is
    // worth, and it never bashes the guard open.
    expect(guard.blocks).toBe(1);
    expect(w.anim.stunT).toBe(0);
    expect(durability(item).cur).toBe(before - 3);
  });

  it('cleaves the rank behind the target, and never back onto your own tile', () => {
    const w = arena('great_maul');
    const front = tanky(root(place(w)));
    // Directly behind the thing you hit — two tiles out, and unreachable by
    // any one-handed weapon in the game.
    const behind = tanky(at(w, 2));
    w.attack();
    tick(w, 1.4);
    expect(front.hp).toBeLessThan(front.maxHp);
    expect(behind.hp).toBeLessThan(behind.maxHp);
  });

  it('reaches past the first rank with a halberd, and cleaves around where it lands', () => {
    const w = arena('halberd');
    // Nothing adjacent: the halberd's target is two tiles out, so the cleave
    // centres two tiles out with it.
    const far = tanky(at(w, 2));
    const beyond = tanky(at(w, 3));
    w.attack();
    tick(w, 1.4);
    const mainDamage = far.maxHp - far.hp;
    const cleaveDamage = beyond.maxHp - beyond.hp;
    expect(mainDamage).toBeGreaterThan(0);
    expect(cleaveDamage).toBeGreaterThan(0);
    expect(cleaveDamage).toBeLessThan(mainDamage * 0.5);
  });

  /**
   * The bug this pins: `weaponArt` looked the viewmodel up from the base's
   * *class*, and the three thrown weapons share one class while carrying their
   * own `viewmodel` override. The override was thrown away, `'thrown'` fell
   * through the switch to its default, and every thrown weapon rendered as a
   * sword in the player's hands. Invisible to the art test, which asks
   * `viewmodelFor` directly and so never saw the lossy call.
   */
  it('shows each weapon its own viewmodel, overrides included', () => {
    const expected: [string, string][] = [
      ['club', 'vm_club'],
      ['mace', 'vm_blunt'],
      ['dagger', 'vm_dagger'],
      ['short_sword', 'vm_short_sword'],
      ['long_sword', 'vm_blade'],
      ['greatsword', 'vm_greatsword'],
      ['great_maul', 'vm_maul'],
      ['halberd', 'vm_polearm'],
    ];
    const w = arena('long_sword');
    for (const [baseId, art] of expected) {
      w.state.equipment.weapon = weapon(baseId);
      expect(w.weaponArt().id, baseId).toBe(art);
    }
    w.state.equipment.weapon = null;
    expect(w.weaponArt().id).toBe('vm_fist');
  });

  it('leaves a one-handed weapon with no cleave at all', () => {
    const w = arena('long_sword');
    const front = place(w);
    const beside = place(w, turnLeft(w.player.facing));
    w.attack();
    tick(w, 1.4);
    expect(front.hp).toBeLessThan(front.maxHp);
    expect(beside.hp).toBe(beside.maxHp);
  });

  it('adds stagger cooldown without cancelling a windup', () => {
    const w = arena('halberd');
    const e = place(w);
    e.x += DX[w.player.facing];
    e.y += DY[w.player.facing];
    e.ai = 'windup';
    e.timer = 99;
    e.attackCd = 1;
    w.attack();
    tick(w, 0.4);
    expect(e.ai).toBe('windup');
    expect(e.attackCd).toBeGreaterThan(1);
  });
});

describe('recoverable thrown stock', () => {
  /** A belt of shafts is worn alongside whatever is in your hands. */
  function belted(baseId: string, seed = 701, weaponId = 'long_sword'): World {
    const w = arena(weaponId, seed);
    w.state.equipment.thrown = weapon(baseId);
    w.refreshDerived();
    w.run.thrown = { held: {}, retrieveCd: 0 };
    w.state.equipment.thrown && (w.run.thrown.held[baseId] = w.derived.thrownCapacity);
    return w;
  }

  it.each([
    ['throwing_knives', 0.10], ['throwing_axes', 0.14], ['javelins', 0.18],
  ] as const)('%s allows another action promptly after release', (base, recovery) => {
    const w = belted(base);
    expect(w.hurl()).toBe(true);
    tick(w, w.derived.thrown!.windup + 0.02);
    expect(w.anim.attack).toBe('recover');
    expect(w.anim.attackDur).toBeCloseTo(recovery);
    tick(w, recovery + 0.02);
    expect(w.anim.attack).toBe('idle');
    w.attack();
    expect(w.anim.attack).toBe('windup');
    expect(w.anim.attackThrow).toBe(false);
  });

  it.each([0, 0.34])('starts retrieval during the last javelin throw at %ss without waiting for landing', (delay) => {
    const w = belted('javelins');
    w.run.thrown.held.javelins = 1;
    // Old saves may retain a cooldown from the previous volley.
    w.run.thrown.retrieveCd = 6;
    w.hurl();
    if (delay) tick(w, delay);
    w.player.stamina = 0;
    expect(w.floor.thrown ?? []).toHaveLength(0);
    expect(w.retrieve()).toBe(true);
    tick(w, 0.7);
    expect(w.projectiles.some(pr => pr.returning)).toBe(false);
    tick(w, 0.06);
    expect(w.projectiles.some(pr => pr.returning)).toBe(true);
    w.retrieve(false);
    tick(w, 1);
    expect(w.run.thrown.held.javelins).toBe(1);
    expect(w.projectiles).toHaveLength(0);
    expect(w.floor.thrown ?? []).toHaveLength(0);
  });

  it('rides its own slot alongside a weapon and a shield, and pays no stats', () => {
    const eq = emptyEquipment();
    eq.weapon = weapon('long_sword');
    eq.offhand = weapon('kite_shield');
    const bare = derivePlayer(eq, {});
    eq.thrown = weapon('javelins');
    const belted = derivePlayer(eq, {});
    // The belt changes nothing about the player except that a throw exists.
    expect(belted.stats).toEqual(bare.stats);
    expect(belted.attack).toBe(bare.attack);
    expect(belted.swing).toEqual(bare.swing);
    expect(belted.hasShield).toBe(true);
    expect(belted.thrown).toBeTruthy();
    expect(belted.thrownAttack).toBeGreaterThan(0);
  });

  it('is not displaced by a two-hander, the way a shield is', () => {
    const eq = emptyEquipment();
    eq.thrown = weapon('javelins');
    eq.weapon = weapon('greatsword');
    const d = derivePlayer(eq, {});
    expect(d.twoHanded).toBe(true);
    expect(d.thrown).toBeTruthy();
    expect(d.thrownCapacity).toBeGreaterThan(0);
  });

  it('throws only on its own key, never on the attack button', () => {
    const w = belted('throwing_knives');
    const full = w.derived.thrownCapacity;
    // Attack swings the sword even with nothing in front and a full belt.
    w.attack();
    tick(w, 1.2);
    expect(w.run.thrown.held.throwing_knives).toBe(full);
    expect(w.projectiles).toHaveLength(0);
    // And a deliberate throw spends exactly one.
    expect(w.hurl()).toBe(true);
    tick(w, 0.2);
    expect(w.run.thrown.held.throwing_knives).toBe(full - 1);
  });

  it('throws point blank too, because the key means you meant it', () => {
    const w = belted('throwing_knives', 704);
    const foe = place(w);
    const full = w.derived.thrownCapacity;
    expect(w.hurl()).toBe(true);
    tick(w, 0.4);
    expect(foe.hp).toBeLessThan(foe.maxHp);
    // And it costs a shaft, which it did not when a point blank hit dropped the
    // knife on the thrower's own tile to be collected the same frame.
    expect(w.run.thrown.held.throwing_knives).toBe(full - 1);
    expect(w.floor.thrown!.reduce((n, m) => n + m.n, 0)).toBe(1);
  });

  /**
   * What the renderer keys the "do not animate" branch off. A throw runs
   * through the same wind-up and recovery states as a swing, so without this
   * flag holding for the whole of both, hurling a javelin swings whatever melee
   * weapon is in your hands — which it did, once the thrown viewmodel was
   * removed and there was a greatsword left on screen to swing.
   */
  it('flags the whole throw, and never a swing', () => {
    const w = belted('javelins', 709, 'greatsword');
    expect(w.anim.attackThrow).toBe(false);
    w.hurl();
    const seen: boolean[] = [];
    for (let t = 0; t < 1.4; t += 1 / 60) {
      w.update(1 / 60);
      if (w.anim.attack !== 'idle') seen.push(w.anim.attackThrow);
    }
    expect(seen.length).toBeGreaterThan(20);
    expect(seen.every(Boolean)).toBe(true);
    // And it is cleared once the throw is over, so the next swing animates.
    expect(w.anim.attack).toBe('idle');
    expect(w.anim.attackThrow).toBe(false);

    w.attack();
    const swinging: boolean[] = [];
    for (let t = 0; t < 1.4; t += 1 / 60) {
      w.update(1 / 60);
      if (w.anim.attack !== 'idle') swinging.push(w.anim.attackThrow);
    }
    expect(swinging.length).toBeGreaterThan(20);
    expect(swinging.some(Boolean)).toBe(false);
  });

  it('draws no viewmodel of its own for a throw', () => {
    // The shaft leaves the player and is a projectile from that moment. Holding
    // a fistful of javelins up through the wind-up put a second pair of hands
    // in the frame beside the ones already holding the greatsword.
    const w = belted('javelins', 708, 'greatsword');
    expect(w.weaponArt().id).toBe('vm_greatsword');
    w.hurl();
    tick(w, 0.1);
    expect(w.weaponArt().id).toBe('vm_greatsword');
    tick(w, 2.0);
    expect(w.weaponArt().id).toBe('vm_greatsword');
  });

  it('lands the shaft on the floor synchronously, and it survives save and load', () => {
    const w = belted('throwing_knives');
    w.hurl();
    tick(w, 1.0);
    expect(w.floor.thrown?.reduce((n, m) => n + m.n, 0)).toBe(1);
    const loaded = parseSave(serializeSave(w.state))!;
    expect(loaded.run!.floors[0]!.thrown?.reduce((n, m) => n + m.n, 0)).toBe(1);
    expect(loaded.equipment.thrown?.ref).toBe('throwing_knives');
  });

  it('scores the throw on the shafts, not on the weapon in your other hand', () => {
    const knives = derivePlayer({ ...emptyEquipment(), weapon: weapon('long_sword'), thrown: weapon('throwing_knives') }, {});
    const javelins = derivePlayer({ ...emptyEquipment(), weapon: weapon('dagger'), thrown: weapon('javelins') }, {});
    // A dagger-carrier's javelins outhit a swordsman's knives: the belt decides.
    expect(javelins.thrownAttack).toBeGreaterThan(knives.thrownAttack);
    expect(knives.thrownDamageType).toBe('pierce');
    expect(derivePlayer({ ...emptyEquipment(), thrown: weapon('throwing_axes') }, {}).thrownDamageType).toBe('slash');
  });

  it('hits a real enemy at range and wears the belt, not the weapon', () => {
    const w = belted('javelins', 703);
    const target = at(w, 3);
    const belt = w.state.equipment.thrown!;
    const sword = w.state.equipment.weapon!;
    const beltBefore = durability(belt).cur;
    const swordBefore = durability(sword).cur;
    w.hurl();
    tick(w, 1.4);
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(durability(belt).cur).toBe(beltBefore - 1);
    expect(durability(sword).cur).toBe(swordBefore);
  });

  /**
   * The retrieval channel. It used to snap the whole floor into your hand the
   * instant you pressed R, which made running dry cost nothing worth planning
   * around. Now each shaft takes its own three quarters of a second to leave
   * the floor and then flies home to your raised hand — and the wait is the
   * whole cost: no stamina, because charging the bar you need *during* a fight
   * for the thing you do *after* one paid for nothing.
   */
  it('calls shafts back one at a time, wearing the belt per arrival and charging no stamina', () => {
    const w = belted('throwing_knives', 705);
    const belt = w.state.equipment.thrown!;
    for (let i = 0; i < 3; i++) { w.hurl(); tick(w, 1.0); }
    const landed = w.floor.thrown!.reduce((n, m) => n + m.n, 0);
    expect(landed).toBe(3);
    const held = w.run.thrown.held.throwing_knives;
    const wearBefore = durability(belt).cur;
    w.player.stamina = w.derived.maxStamina;
    const stamina = w.player.stamina;

    expect(w.retrieve()).toBe(true);
    // Nothing has left the floor yet: the call is not the recovery.
    tick(w, 0.5);
    expect(w.run.thrown.held.throwing_knives).toBe(held);
    expect(w.thrownCounts()).toMatchObject({ floor: 3, flying: 0, calling: true });

    // The first shaft is airborne: off the floor, not yet in hand. The counter
    // moves when it leaves the floor and the stock only when it arrives, and
    // both are visible at once — that split is what the old counter lied about.
    tick(w, 0.5);
    expect(w.thrownCounts()).toMatchObject({ floor: 2, flying: 1, calling: true });
    expect(w.run.thrown.held.throwing_knives).toBe(held);

    // It lands with no stamina spent and one point of belt wear.
    tick(w, 0.6);
    expect(w.run.thrown.held.throwing_knives).toBe(held + 1);
    expect(durability(belt).cur).toBe(wearBefore - 1);
    expect(w.player.stamina).toBe(stamina);
    // Still running, so no cooldown has started.
    expect(w.run.thrown.retrieveCd).toBe(0);

    tick(w, 3.0);
    expect(w.run.thrown.held.throwing_knives).toBe(held + 3);
    expect(w.floor.thrown).toEqual([]);
    expect(w.thrownCounts()).toMatchObject({ floor: 0, flying: 0, calling: false });
    expect(durability(belt).cur).toBe(wearBefore - 3);
    expect(w.player.stamina).toBe(stamina);
    // The charge is the only retrieval delay; completing a volley adds none.
    expect(w.run.thrown.retrieveCd).toBe(0);
  });

  it('stops the call on a blow, keeping what arrived and losing nothing', () => {
    const w = belted('throwing_knives', 706);
    for (let i = 0; i < 3; i++) { w.hurl(); tick(w, 1.0); }
    const held = w.run.thrown.held.throwing_knives;
    w.player.stamina = w.derived.maxStamina;
    w.retrieve();
    // First shaft home (~1.1s), second not yet sent (1.5s).
    tick(w, 1.3);
    expect(w.run.thrown.held.throwing_knives).toBe(held + 1);
    const attacker = place(w);
    attacker.attackCd = 0;
    attacker.alert = 8;
    tick(w, 2.0);
    // The blow stopped the call without a cooldown,
    // and the shafts still sum to three across hand, floor and air: whatever
    // was airborne when the blow landed still came home.
    expect(w.anim.retrieving).toBeNull();
    expect(w.run.thrown.retrieveCd).toBe(0);
    const counts = w.thrownCounts()!;
    expect(counts.held + counts.floor + counts.flying).toBe(held + 3);
    expect(counts.held).toBeGreaterThanOrEqual(held + 1);
    // And it stays stopped: nothing more leaves the floor.
    const snap = { ...counts };
    tick(w, 1.0);
    expect(w.thrownCounts()).toMatchObject(snap);
  });

  it('stopping the call mid-flight still lets the airborne shaft land', () => {
    const w = belted('throwing_knives', 707);
    for (let i = 0; i < 2; i++) { w.hurl(); tick(w, 1.0); }
    const held = w.run.thrown.held.throwing_knives;
    w.player.stamina = w.derived.maxStamina;
    expect(w.retrieve()).toBe(true);
    // First shaft launched (0.75s) but not yet home (~1.1s).
    tick(w, 0.8);
    expect(w.thrownCounts()).toMatchObject({ floor: 1, flying: 1 });
    // Release R: the call stops, and the shaft already in the air is not
    // lost with it — the old 0.75s-or-nothing is exactly what this pins.
    expect(w.retrieve(false)).toBe(false);
    expect(w.anim.retrieving).toBeNull();
    tick(w, 2.0);
    expect(w.run.thrown.held.throwing_knives).toBe(held + 1);
    expect(w.thrownCounts()).toMatchObject({ floor: 1, flying: 0, calling: false });
  });

  it('release cancels a partial channel and a new hold starts a full interval', () => {
    const w = belted('throwing_knives', 712);
    w.hurl(); tick(w, 1.0);
    w.retrieve();
    tick(w, 0.5);
    // Repeated down events must not toggle off or reset progress.
    expect(w.retrieve()).toBe(true);
    w.retrieve(false);
    tick(w, 1.0);
    expect(w.thrownCounts()).toMatchObject({ floor: 1, flying: 0, calling: false });
    expect(w.run.thrown.retrieveCd).toBe(0);
    w.retrieve();
    tick(w, 0.5);
    expect(w.thrownCounts()).toMatchObject({ floor: 1, flying: 0, calling: true });
    tick(w, 0.3);
    expect(w.thrownCounts()).toMatchObject({ floor: 0, flying: 1 });
  });

  it.each([false, true])('charges remote ammunition before spawning a local return (other floor: %s)', (otherFloor) => {
    const w = belted('throwing_knives', 713);
    const base = 'throwing_knives';
    const held = --w.run.thrown.held[base];
    const source = otherFloor ? structuredClone(w.floor) : w.floor;
    source.thrown = [{ base, x: w.player.x + 20, y: w.player.y, n: 1 }];
    if (otherFloor) w.run.floors.push(source);
    expect(w.thrownCounts()).toMatchObject({ floor: 1, held });
    expect(w.retrieve()).toBe(true);
    for (let i = 0; i < 44; i++) w.update(1 / 60);
    expect(source.thrown[0].n).toBe(1);
    expect(w.projectiles).toHaveLength(0);
    w.update(1 / 60);
    expect(source.thrown).toEqual([]);
    const returning = w.projectiles.find(p => p.returning)!;
    expect(returning).toBeDefined();
    expect(Math.hypot(returning.x - w.player.x - 0.5, returning.y - w.player.y - 0.5)).toBeLessThanOrEqual(2);
    w.retrieve(false);
    tick(w, 1);
    expect(w.thrownCounts()).toMatchObject({ held: held + 1, floor: 0, flying: 0, calling: false });
  });

  it.each([false, true])('holds the final receiving pose until arrival unless released (cancel: %s)', (cancel) => {
    const w = belted('javelins', 714);
    const base = 'javelins';
    const held = --w.run.thrown.held[base];
    w.floor.thrown = [{ base, x: w.player.x + 7, y: w.player.y, n: 1 }];
    w.retrieve();
    tick(w, 0.8);
    expect(w.anim.retrieving).toMatchObject({ left: 0, t: 0 });
    expect(w.thrownCounts()).toMatchObject({ held, floor: 0, flying: 1, calling: true });
    if (cancel) w.retrieve(false);
    tick(w, 0.1);
    expect(!!w.anim.retrieving).toBe(!cancel);
    expect(w.thrownCounts()).toMatchObject({ held, flying: 1 });
    tick(w, 1);
    expect(w.thrownCounts()).toMatchObject({ held: held + 1, floor: 0, flying: 0, calling: false });
    expect(w.anim.retrieving).toBeNull();
  });

  it('walking over a shaft spends the call remainder instead of duplicating it', () => {
    const w = belted('throwing_knives', 710);
    w.hurl();
    tick(w, 1.0);
    const marker = w.floor.thrown!.find((m) => m.base === 'throwing_knives')!;
    const held = w.run.thrown.held.throwing_knives;
    expect(w.retrieve()).toBe(true);
    // Step onto it on foot before the first launch fires (0.75s): the call
    // re-anchors to what is still out — nothing — and ends with no cooldown,
    // because the steps were the price.
    const d = w.player.facing;
    Object.assign(w.player, { x: marker.x - DX[d], y: marker.y - DY[d] });
    Object.assign(w.anim, { fromX: w.player.x, fromY: w.player.y, moveT: 1, turnT: 1 });
    w.press('forward');
    tick(w, 1.0);
    const counts = w.thrownCounts()!;
    expect(counts.held).toBe(held + 1);
    expect(counts.floor + counts.flying).toBe(0);
    expect(w.anim.retrieving).toBeNull();
    expect(w.run.thrown.retrieveCd).toBe(0);
  });

  it('counts every shaft exactly once, wherever it is', () => {
    const w = belted('throwing_knives', 711);
    for (let i = 0; i < 3; i++) { w.hurl(); tick(w, 1.0); }
    const held = w.run.thrown.held.throwing_knives;
    const total = () => {
      const c = w.thrownCounts()!;
      return c.held + c.floor + c.flying;
    };
    expect(total()).toBe(held + 3);
    w.retrieve();
    for (let i = 0; i < 40; i++) {
      tick(w, 0.25);
      // Floor, air and hand always sum to the same three — the counter the HUD
      // reads can never promise what the stock will not receive.
      expect(total()).toBe(held + 3);
      if (!w.anim.retrieving && w.thrownCounts()!.flying === 0) break;
    }
    expect(w.run.thrown.held.throwing_knives).toBe(held + 3);
  });
});
