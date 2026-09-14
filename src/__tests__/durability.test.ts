import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { FLOOR, createEnemy } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { Rarity } from '../types';
import {
  BROKEN_STAT_FRACTION,
  durability,
  itemStats,
  makeConsumable,
  makeEquipment,
  makeMaterial,
  maxDurability,
  repairCost,
  repairItem,
  wearItem,
} from '../systems/items';

const sword = () => makeEquipment({ baseId: 'long_sword', materialId: 'iron', rarity: Rarity.Common, ilvl: 4, quality: 1 });
const ring = () => makeEquipment({ baseId: 'band', materialId: 'iron', rarity: Rarity.Common, ilvl: 4, quality: 1 });

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
  for (let y = 2; y < f.height - 4; y++) for (let x = 2; x < f.width - 4; x++) {
    for (const d of DIRS) {
      if (!free(x, y) || !free(x + DX[d], y + DY[d])) continue;
      Object.assign(w.player, { x, y, facing: d });
      Object.assign(w.anim, { fromX: x, fromY: y, moveT: 1, turnT: 1 });
      return w;
    }
  }
  throw new Error('no arena');
}

describe('what wears and what does not', () => {
  it('gives worn gear a pool and jewellery none', () => {
    expect(maxDurability(sword())).toBeGreaterThan(0);
    expect(maxDurability(ring())).toBe(0);
    expect(durability(ring()).wears).toBe(false);
  });

  it('scales the pool with the material', () => {
    const copper = makeEquipment({ baseId: 'long_sword', materialId: 'copper', rarity: Rarity.Common, ilvl: 4, quality: 1 });
    const star = makeEquipment({ baseId: 'long_sword', materialId: 'star_iron', rarity: Rarity.Common, ilvl: 4, quality: 1 });
    expect(maxDurability(star)).toBeGreaterThan(maxDurability(copper));
  });

  it('scales crafted durability with frozen recipe mastery', () => {
    const rank1 = makeEquipment({ baseId: 'long_sword', materialId: 'iron', rarity: Rarity.Common, ilvl: 4, crafted: true, craftRank: 1 });
    const rank5 = makeEquipment({ baseId: 'long_sword', materialId: 'iron', rarity: Rarity.Common, ilvl: 4, crafted: true, craftRank: 5 });
    expect(maxDurability(rank5)).toBe(Math.round(maxDurability(rank1) * 1.4));
    expect(maxDurability(makeEquipment({ baseId: 'band', materialId: 'iron', rarity: Rarity.Common, ilvl: 4, crafted: true, craftRank: 5 }))).toBe(0);
  });

  it('never wears stacks of materials or potions', () => {
    expect(maxDurability(makeMaterial('iron', 3))).toBe(0);
    expect(maxDurability(makeConsumable('healing_draught', 2))).toBe(0);
    expect(wearItem(makeMaterial('iron', 3))).toBe('none');
  });

  it('reads an item with no durability field as fresh', () => {
    const it = sword();
    delete it.dur;
    const d = durability(it);
    expect(d.frac).toBe(1);
    expect(d.broken).toBe(false);
    expect(repairCost(it)).toBe(0);
  });
});

describe('wearing out', () => {
  it('warns once on the way down and once at the end', () => {
    const it = sword();
    const max = maxDurability(it);
    const warnAt = Math.ceil(max * 0.25);
    it.dur = warnAt + 1;
    expect(wearItem(it)).toBe('warn');
    expect(wearItem(it)).toBe('none'); // only the crossing speaks
    it.dur = 1;
    expect(wearItem(it)).toBe('broke');
    expect(wearItem(it)).toBe('none'); // already gone
  });

  it('cannot go below zero', () => {
    const it = sword();
    it.dur = 1;
    wearItem(it, 50);
    expect(it.dur).toBe(0);
    expect(durability(it).frac).toBe(0);
  });

  it('guts the stats when it breaks, without zeroing them', () => {
    const fresh = sword();
    const dead = sword();
    dead.dur = 0;
    const a = itemStats(fresh).attack;
    const b = itemStats(dead).attack;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThan(a);
    expect(b).toBeCloseTo(Math.round(a * BROKEN_STAT_FRACTION), 0);
  });
});

describe('the smith', () => {
  it('charges more the worse it is, and nothing for sound gear', () => {
    const it = sword();
    expect(repairCost(it)).toBe(0);
    it.dur = Math.round(maxDurability(it) * 0.5);
    const half = repairCost(it);
    it.dur = 0;
    expect(repairCost(it)).toBeGreaterThan(half);
    expect(half).toBeGreaterThan(0);
  });

  it('makes it whole again', () => {
    const it = sword();
    it.dur = 0;
    repairItem(it);
    expect(durability(it).frac).toBe(1);
    expect(repairCost(it)).toBe(0);
  });
});

describe('wear in the dungeon', () => {
  it('blunts the weapon on a blow that lands', () => {
    const w = arena(3);
    const weapon = w.state.equipment.weapon!;
    const before = durability(weapon).cur;
    const t = w.frontTile(1);
    const e = createEnemy(enemyDef('skeleton'), t.x, t.y, turnAround(w.player.facing), 'target', 1);
    e.hp = 999;
    w.floor.enemies.push(e);
    w.attack();
    tick(w, 1);
    expect(durability(weapon).cur).toBeLessThan(before);
  });

  it('dulls the edge slowly on empty air: 1 wear per 3 whiffs', () => {
    const w = arena(4);
    const weapon = w.state.equipment.weapon!;
    const before = durability(weapon).cur;
    w.attack();
    tick(w, 1);
    // One or two whiffs cost nothing; the third takes a point.
    expect(durability(weapon).cur).toBe(before);
    w.attack();
    tick(w, 1);
    expect(durability(weapon).cur).toBe(before);
    w.attack();
    tick(w, 1);
    expect(durability(weapon).cur).toBeLessThan(before);
  });

  it('grinds the shield down when it takes a hit', () => {
    const w = arena(5);
    const shield = w.state.equipment.offhand!;
    const before = durability(shield).cur;
    const t = w.frontTile(1);
    const e = createEnemy(enemyDef('skeleton'), t.x, t.y, turnAround(w.player.facing), 'hitter', 1);
    w.floor.enemies.push(e);
    w.setBlock(true);
    tick(w, 1.2); // guard up well before the swing, so it blocks rather than parries
    e.ai = 'windup';
    e.timer = 0.05;
    e.alert = 6;
    e.lastSeenX = w.player.x;
    e.lastSeenY = w.player.y;
    tick(w, 0.3);
    expect(durability(shield).cur).toBeLessThan(before);
  });

  it('costs the shield nothing to parry', () => {
    const w = arena(6);
    const shield = w.state.equipment.offhand!;
    const before = durability(shield).cur;
    const t = w.frontTile(1);
    const e = createEnemy(enemyDef('skeleton'), t.x, t.y, turnAround(w.player.facing), 'parried', 1);
    w.floor.enemies.push(e);
    e.ai = 'windup';
    e.timer = 0.12;
    e.alert = 6;
    e.lastSeenX = w.player.x;
    e.lastSeenY = w.player.y;
    w.setBlock(true);
    tick(w, 0.25);
    expect(e.vuln).toBeGreaterThan(0); // it really was a parry
    expect(durability(shield).cur).toBe(before);
  });

  it('scuffs armour when a hit gets through', () => {
    const w = arena(7);
    const body = w.state.equipment.body!;
    const before = durability(body).cur;
    const t = w.frontTile(1);
    const e = createEnemy(enemyDef('skeleton'), t.x, t.y, turnAround(w.player.facing), 'biter', 1);
    w.floor.enemies.push(e);
    // No guard up: the blow lands.
    for (let n = 0; n < 6; n++) {
      e.ai = 'windup';
      e.timer = 0.05;
      e.alert = 6;
      e.lastSeenX = w.player.x;
      e.lastSeenY = w.player.y;
      w.player.hp = 500;
      tick(w, 1.2);
    }
    expect(durability(body).cur).toBeLessThan(before);
  });
});
