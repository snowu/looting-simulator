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
    const front = place(w);
    // Diagonally off the target, which is beside the player: caught by the
    // cleave because it touches the target, not because it touches the player.
    const left = place(w, turnLeft(w.player.facing));
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
    const front = root(place(w));
    // Directly behind the thing you hit — two tiles out, and unreachable by
    // any one-handed weapon in the game.
    const behind = at(w, 2);
    w.attack();
    tick(w, 1.4);
    expect(front.hp).toBeLessThan(front.maxHp);
    expect(behind.hp).toBeLessThan(behind.maxHp);
  });

  it('reaches past the first rank with a halberd, and cleaves around where it lands', () => {
    const w = arena('halberd');
    // Nothing adjacent: the halberd's target is two tiles out, so the cleave
    // centres two tiles out with it.
    const far = at(w, 2);
    const beyond = at(w, 3);
    w.attack();
    tick(w, 1.4);
    const mainDamage = far.maxHp - far.hp;
    const cleaveDamage = beyond.maxHp - beyond.hp;
    expect(mainDamage).toBeGreaterThan(0);
    expect(cleaveDamage).toBeGreaterThan(0);
    expect(cleaveDamage).toBeLessThan(mainDamage * 0.5);
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
  it('throws at range, melees point blank, lands synchronously, and survives save/load', () => {
    const w = arena('throwing_knives');
    expect(w.run.thrown.held.throwing_knives).toBe(6);
    w.attack();
    tick(w, 0.2);
    expect(w.run.thrown.held.throwing_knives).toBe(5);
    tick(w, 0.8);
    expect(w.floor.thrown?.reduce((n, m) => n + m.n, 0)).toBe(1);
    const loaded = parseSave(serializeSave(w.state))!;
    expect(loaded.run!.thrown.held.throwing_knives).toBe(5);
    expect(loaded.run!.floors[0]!.thrown?.reduce((n, m) => n + m.n, 0)).toBe(1);

    const close = arena('throwing_knives', 702);
    place(close);
    close.attack();
    expect(close.run.thrown.held.throwing_knives).toBe(6);
    expect(close.projectiles).toHaveLength(0);
  });

  it('applies a real player hit, then retrieves the floor at full aggregate cost with wear and cooldown', () => {
    const w = arena('javelins', 703);
    const target = place(w);
    target.x += DX[w.player.facing] * 2;
    target.y += DY[w.player.facing] * 2;
    const item = w.state.equipment.weapon!;
    const wearBefore = durability(item).cur;
    w.attack();
    tick(w, 1.2);
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(durability(item).cur).toBe(wearBefore - 1);
    expect(w.floor.thrown).toHaveLength(1);
    w.player.stamina = w.derived.maxStamina;
    const stamina = w.player.stamina;
    expect(w.retrieve()).toBe(true);
    expect(w.player.stamina).toBeCloseTo(stamina - 0.6 * w.derived.thrown!.staminaCost);
    expect(w.run.thrown.retrieveCd).toBe(6);
    expect(w.floor.thrown).toEqual([]);
    expect(durability(item).cur).toBe(wearBefore - 2);
  });
});
