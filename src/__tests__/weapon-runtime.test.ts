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

  it('cleaves everything touching the target for a quarter, never bashes, and wears twice', () => {
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
    expect(durability(item).cur).toBe(before - 2);
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
   * around. Now each shaft takes its own three quarters of a second and is paid
   * for as it arrives, so an interrupted call costs exactly what it recovered.
   */
  it('calls shafts back one at a time, charging stamina and wear per shaft', () => {
    const w = belted('throwing_knives', 705);
    const belt = w.state.equipment.thrown!;
    for (let i = 0; i < 3; i++) { w.hurl(); tick(w, 1.0); }
    const landed = w.floor.thrown!.reduce((n, m) => n + m.n, 0);
    expect(landed).toBe(3);
    const held = w.run.thrown.held.throwing_knives;
    const wearBefore = durability(belt).cur;
    w.player.stamina = w.derived.maxStamina;
    const stamina = w.player.stamina;
    const perShaft = 0.6 * w.derived.thrown!.staminaCost;

    expect(w.retrieve()).toBe(true);
    // Nothing has arrived yet: the call is not the recovery.
    tick(w, 0.5);
    expect(w.run.thrown.held.throwing_knives).toBe(held);

    tick(w, 0.4);
    expect(w.run.thrown.held.throwing_knives).toBe(held + 1);
    expect(durability(belt).cur).toBe(wearBefore - 1);
    expect(w.player.stamina).toBeCloseTo(stamina - perShaft, 1);
    // Still running, so no cooldown has started.
    expect(w.run.thrown.retrieveCd).toBe(0);

    tick(w, 1.6);
    expect(w.run.thrown.held.throwing_knives).toBe(held + 3);
    expect(w.floor.thrown).toEqual([]);
    expect(durability(belt).cur).toBe(wearBefore - 3);
    // Set to 6 when the last shaft arrived, and ticking down ever since.
    expect(w.run.thrown.retrieveCd).toBeGreaterThan(5);
  });

  it('stops the call on a blow, keeping only what already came back', () => {
    const w = belted('throwing_knives', 706);
    for (let i = 0; i < 3; i++) { w.hurl(); tick(w, 1.0); }
    const held = w.run.thrown.held.throwing_knives;
    w.player.stamina = w.derived.maxStamina;
    w.retrieve();
    tick(w, 0.8);
    expect(w.run.thrown.held.throwing_knives).toBe(held + 1);
    const attacker = place(w);
    attacker.attackCd = 0;
    attacker.alert = 8;
    tick(w, 2.0);
    // One came home before the blow; the other two are still on the floor.
    expect(w.run.thrown.held.throwing_knives).toBe(held + 1);
    expect(w.floor.thrown!.reduce((n, m) => n + m.n, 0)).toBe(2);
  });

  it('stops the call when you press R again', () => {
    const w = belted('throwing_knives', 707);
    for (let i = 0; i < 2; i++) { w.hurl(); tick(w, 1.0); }
    w.player.stamina = w.derived.maxStamina;
    expect(w.retrieve()).toBe(true);
    expect(w.retrieve()).toBe(false);
    tick(w, 2.0);
    expect(w.floor.thrown!.reduce((n, m) => n + m.n, 0)).toBe(2);
  });
});
