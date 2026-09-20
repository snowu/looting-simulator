import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { EnemyState, FLOOR, createEnemy, generateFloor } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { itemBase } from '../data/items';
import { GEAR_UNIQUES, ROLLABLE_UNIQUES, findUnique, uniqueForQuirk } from '../data/uniques';
import { makeUnique, pickUnique } from '../systems/items';
import { CHARGE_STACKS, derivePlayer, emptyEquipment } from '../systems/player';
import { playerHitsEnemy } from '../systems/combat';
import { applyQuirk, rollQuirk } from '../systems/quirks';
import { QUIRK_IDS, QUIRK_MAX_DEPTH, QUIRK_MIN_DEPTH } from '../data/quirks';
import { Item } from '../types';

function relic(id: string, depth = 5): Item {
  return makeUnique(findUnique(id)!, createRng(1), depth, true);
}

function tick(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

function arena(seed = 1): World {
  const state = newGame(createRng(seed));
  state.difficulty = 'hard';
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

describe('The Big Toe', () => {
  it('is a real weapon with a real niche, not a joke with no numbers', () => {
    const base = itemBase('big_toe');
    const sword = itemBase('long_sword');
    // It hits about as hard as a one-hander of its depth...
    expect(base.base.attack!).toBeGreaterThan(itemBase('mace').base.attack!);
    expect(base.base.attack!).toBeLessThan(sword.base.attack!);
    // ...and buys the widest cleave and heaviest stagger of any one-hander
    // with the slowest recovery of any one-hander.
    expect(base.swing!.cleave!).toBeGreaterThan(itemBase('greatsword').swing!.cleave!);
    expect(base.swing!.stagger!).toBeGreaterThan(itemBase('great_maul').swing!.stagger!);
    expect(base.swing!.recovery).toBeGreaterThan(sword.swing!.recovery);
    expect(base.twoHanded).toBeFalsy();
  });

  it('is made of bone or hide, because it is a toe', () => {
    expect(itemBase('big_toe').primary).not.toContain('metal');
  });

  it('can be found in an ordinary delve', () => {
    // Unlike the other two, the Toe is not locked to a strange floor: it is a
    // weapon that happens to be a toe, not a souvenir.
    expect(itemBase('big_toe').weight).toBeGreaterThan(0);
    expect(findUnique('big_toe')!.only).toBeUndefined();
  });

  it('leaves a second cut some of the time, on its own roll', () => {
    const w = arena(11);
    w.state.equipment.weapon = relic('big_toe');
    w.refreshDerived();
    expect(w.derived.traits.butcher).toBeGreaterThan(0);
    // Deterministic per corpse, so carrying the toe cannot change whether the
    // *first* morsel dropped — only whether a second one did.
    let seconds = 0;
    for (let i = 0; i < 60; i++) {
      const e = spawn(w, 'ghoul', 1);
      e.id = `corpse${i}`;
      e.hp = 1;
      w.attack();
      tick(w, 0.8);
      seconds += (w.floor.morsels ?? []).filter((m) => m.id.startsWith('morsel_toe_')).length;
      w.floor.morsels = [];
      w.floor.enemies = [];
    }
    expect(seconds).toBeGreaterThan(0);
  });
});

describe("The Prize Bull's Horn", () => {
  it('keeps a spear reach', () => {
    expect(itemBase('prize_horn').swing!.reach).toBe(itemBase('spear').swing!.reach);
  });

  it('builds while you keep landing blows and breaks when one lands on you', () => {
    const w = arena(12);
    w.state.equipment.weapon = relic('prize_horn');
    w.refreshDerived();
    expect(w.derived.traits.chargeMax).toBe(CHARGE_STACKS);
    const e = spawn(w, 'ghoul', 1);
    const spot = w.frontTile(1);
    for (let i = 0; i < CHARGE_STACKS + 4; i++) {
      // Pinned and unable to swing back: this test is about the charge
      // building, and the very next assertion is about it breaking.
      Object.assign(e, { hp: 9999, maxHp: 9999, x: spot.x, y: spot.y, fromX: spot.x, fromY: spot.y, moveT: 1, ai: 'idle', alert: 0, attackCd: 99 });
      w.player.stamina = w.derived.maxStamina;
      w.attack();
      tick(w, 1);
    }
    expect(w.anim.chargeStacks).toBe(CHARGE_STACKS);
    // A blow that gets through puts it back to nothing. Let the thing swing.
    const hp = w.player.hp;
    Object.assign(e, { ai: 'chase', alert: 6, attackCd: 0 });
    tick(w, 4);
    expect(w.player.hp).toBeLessThan(hp);
    expect(w.anim.chargeStacks).toBe(0);
  });

  it('pays the charge as Attack, so armour still takes its cut', () => {
    // Added to the damage after mitigation, "+4 Attack" would have been an
    // armour bypass: +24 against a heavily armoured thing is worth far more as
    // damage than as Attack. The charge must be worth *less* against armour.
    const gain = (defenseMult: number): number => {
      const w = arena(21);
      w.state.equipment.weapon = relic('prize_horn');
      w.refreshDerived();
      const measure = (stacks: number): number => {
        const e = spawn(w, 'ghoul', 1);
        Object.assign(e, { hp: 999999, maxHp: 999999, ai: 'idle', alert: 0, attackCd: 99, power: defenseMult });
        w.anim.chargeStacks = stacks;
        w.player.stamina = w.derived.maxStamina;
        const before = e.hp;
        w.attack();
        tick(w, 0.8);
        const dealt = before - e.hp;
        w.floor.enemies = [];
        return dealt;
      };
      return measure(CHARGE_STACKS) - measure(0);
    };
    const soft = gain(1);
    const armoured = gain(6);
    expect(soft).toBeGreaterThan(0);
    expect(armoured).toBeGreaterThan(0);
    expect(armoured, 'the charge should buy less against armour').toBeLessThan(soft);
  });

  it('cannot hurt something the blow itself could not', () => {
    // The charge rides on the swing rather than sitting on top of it: a target
    // immune to the damage type is immune to the charge behind it, instead of
    // taking a flat 24 from a blow the game just reported as doing nothing.
    const eq = emptyEquipment();
    eq.weapon = relic('prize_horn');
    const d = derivePlayer(eq, {}, 'hard');
    const immune = {
      ...enemyDef('ghoul'),
      resist: { slash: 0, pierce: 0, blunt: 0, fire: 0, frost: 0, shadow: 0, holy: 0 },
    };
    const charge = CHARGE_STACKS * d.traits.charge;
    expect(charge).toBeGreaterThan(0);
    const hit = playerHitsEnemy(createRng(1), d, 1, immune, 1, charge);
    expect(hit.damage).toBe(0);
    expect(hit.effective).toBe('immune');
  });

  it('hits harder at full charge than at none', () => {
    const measure = (stacks: number): number => {
      const w = arena(13);
      w.state.equipment.weapon = relic('prize_horn');
      w.refreshDerived();
      const e = spawn(w, 'ghoul', 1);
      Object.assign(e, { hp: 99999, maxHp: 99999, ai: 'idle', alert: 0, attackCd: 99 });
      w.anim.chargeStacks = stacks;
      const before = e.hp;
      w.attack();
      tick(w, 0.6);
      return before - e.hp;
    };
    expect(measure(CHARGE_STACKS)).toBeGreaterThan(measure(0));
  });
});

describe("The Impresario's Cane", () => {
  it('trades a weapon slot of damage for doing everything sooner', () => {
    const eq = emptyEquipment();
    eq.weapon = relic('impresario_cane');
    const d = derivePlayer(eq, {}, 'hard');
    expect(d.traits.haste).toBeLessThan(1);

    const plain = emptyEquipment();
    plain.weapon = relic('ordinary_sword');
    const p = derivePlayer(plain, {}, 'hard');
    // Faster at everything...
    expect(d.swing.windup).toBeLessThan(p.swing.windup);
    expect(d.swing.recovery).toBeLessThan(p.swing.recovery);
    // ...and nowhere near as hard-hitting, which is the trade.
    expect(d.attack).toBeLessThan(p.attack);
  });

  it('reaches the step and the sip, not only the swing', () => {
    const w = arena(14);
    w.state.equipment.weapon = relic('impresario_cane');
    w.refreshDerived();
    w.player.hp = 1;
    expect(w.sipFlask()).toBe(true);
    const hasted = w.anim.sip!;
    const plain = arena(14);
    plain.player.hp = 1;
    expect(plain.sipFlask()).toBe(true);
    expect(hasted).toBeLessThan(plain.anim.sip!);
    // And the step, which nothing else in the game touches.
    expect(w.derived.traits.haste).toBeLessThan(1);
  });
});

describe('relics locked to a strange floor', () => {
  it('never arrive from an ordinary roll, not even a guaranteed one', () => {
    const locked = GEAR_UNIQUES.filter((u) => u.only);
    expect(locked.length).toBeGreaterThan(0);
    for (const u of locked) expect(ROLLABLE_UNIQUES).not.toContain(u);
    const ids = new Set<string>();
    for (let seed = 0; seed < 4000; seed++) {
      for (const guaranteed of [false, true]) {
        const got = pickUnique(createRng(seed), 6, [], guaranteed);
        if (got) ids.add(got.id);
      }
    }
    for (const u of locked) expect([...ids], `${u.id} must not be rollable`).not.toContain(u.id);
  });

  it('gives every strange floor exactly one, waiting on the floor', () => {
    for (const quirk of QUIRK_IDS) {
      const def = uniqueForQuirk(quirk);
      expect(def, `${quirk} has no relic`).toBeDefined();
      let checked = 0;
      for (let seed = 0; seed < 5000 && checked < 3; seed++) {
        for (let depth = QUIRK_MIN_DEPTH; depth <= QUIRK_MAX_DEPTH; depth++) {
          if (rollQuirk(seed, depth) !== quirk) continue;
          const f = generateFloor(seed, depth, 'hard');
          applyQuirk(f, seed, 'hard');
          const planted = f.pickups.flatMap((p) => p.items).filter((it) => it.uniqueId === def!.id);
          expect(planted.length, `${quirk} at ${seed}/${depth}`).toBe(1);
          // Unidentified: the name lands at the appraiser, not in a corridor.
          expect(planted[0].identified).toBe(false);
          checked++;
          break;
        }
      }
      expect(checked, `no ${quirk} floors generated`).toBeGreaterThan(0);
    }
  });
});
