import { describe, expect, it } from 'vitest';
import { DX, DY } from '../core/dir';
import { createRng } from '../core/rng';
import { newGame } from '../state/game-state';
import { migrateSave } from '../state/migrations';
import { EnemyState, createEnemy } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import {
  BULWARK_WINDOW, INSCRIBE_COST, LAST_FLASK_MULT, PROPERTY_IDS, RIPOSTE_WINDOW,
} from '../data/properties';
import { canCarry, inscribe, inscribeTargets, learnProperty, unlearnedProperties } from '../systems/properties';
import { derivePlayer } from '../systems/player';
import { makeEquipment, makeUnique } from '../systems/items';
import { Item, Rarity } from '../types';
import { findUnique } from '../data/uniques';
import { World } from '../world/world';
import { room } from './harness';
import * as Thrown from '../world/thrown';

interface Private {
  refreshDerived(): void;
  damagePlayer(attack: number, type: string, fromX: number, fromY: number, source: string, sourceId?: string, attacker?: EnemyState): void;
  killEnemy(e: EnemyState): void;
  hitEnemy(e: EnemyState): void;
  heal(amount: number, source?: 'food' | 'leech'): number;
  parryFlourish(x: number, y: number): void;
}
const priv = (w: World) => w as unknown as Private;

const gear = (baseId: string, materialId = 'iron'): Item =>
  makeEquipment({ baseId, materialId, rarity: Rarity.Common, ilvl: 2, identified: true });

const arena = (seed = 211): World => room({ seed });

/** Wear `item` with `property` inscribed, and rebuild the derived stats. */
function wear(w: World, slot: 'weapon' | 'offhand' | 'thrown' | 'body', item: Item, property: string): void {
  item.property = property;
  w.state.equipment[slot] = item;
  priv(w).refreshDerived();
}

function foe(w: World, id: string, dx: number, dy: number): EnemyState {
  const e = createEnemy(enemyDef(id), w.player.x + dx, w.player.y + dy, 0, `${id}_${dx}_${dy}`, 1);
  e.ai = 'chase';
  e.alert = 6;
  w.floor.enemies.push(e);
  return e;
}

describe('learning and inscribing', () => {
  it('learns each property once, and lists what is left', () => {
    const s = newGame(createRng(1));
    expect(unlearnedProperties(s)).toEqual(PROPERTY_IDS);
    expect(learnProperty(s, 'riposte')).toBe(true);
    expect(learnProperty(s, 'riposte')).toBe(false);
    expect(learnProperty(s, 'nonsense')).toBe(false);
    expect(unlearnedProperties(s)).not.toContain('riposte');
  });

  it('only fits the gear it was made for, never a relic', () => {
    expect(canCarry(gear('long_sword'), 'riposte')).toBe(true);
    expect(canCarry(gear('helm'), 'riposte')).toBe(false);
    expect(canCarry(gear('kite_shield'), 'bulwark')).toBe(true);
    expect(canCarry(gear('plate'), 'last_flask')).toBe(true);
    const relic = makeUnique(findUnique('ordinary_sword')!, createRng(9), 6, true);
    expect(canCarry(relic, 'riposte')).toBe(false);
  });

  it('costs gold, needs the property learned, and replaces the old one', () => {
    const s = newGame(createRng(2));
    const sword = gear('long_sword');
    s.stash.items.push(sword);
    s.gold = INSCRIBE_COST * 2;
    expect(inscribe(s, sword.uid, 'riposte')).toBe('unknown');
    learnProperty(s, 'riposte');
    learnProperty(s, 'execution');
    expect(inscribeTargets(s, 'riposte').map((i) => i.uid)).toContain(sword.uid);
    expect(inscribe(s, sword.uid, 'riposte')).toBe('ok');
    expect(sword.property).toBe('riposte');
    expect(s.gold).toBe(INSCRIBE_COST);
    expect(inscribe(s, sword.uid, 'riposte')).toBe('already');
    expect(inscribe(s, sword.uid, 'execution')).toBe('ok');
    expect(sword.property).toBe('execution');
    expect(inscribe(s, sword.uid, 'riposte')).toBe('gold');
  });

  it('counts only on worn, identified gear in a fitting slot', () => {
    const s = newGame(createRng(3));
    const sword = gear('long_sword');
    sword.property = 'riposte';
    s.equipment.weapon = sword;
    expect(derivePlayer(s.equipment, s.meta).traits.riposte).toBe(true);
    sword.identified = false;
    expect(derivePlayer(s.equipment, s.meta).traits.riposte).toBe(false);
    const helm = gear('helm');
    helm.property = 'riposte';
    s.equipment.weapon = null;
    s.equipment.head = helm;
    expect(derivePlayer(s.equipment, s.meta).traits.riposte).toBe(false);
  });

  it('migrates an older save with nothing learned', () => {
    const s = newGame(createRng(4)) as unknown as Record<string, unknown>;
    delete s.properties;
    s.revision = 24;
    migrateSave(s as never);
    expect(s.properties).toEqual([]);
  });
});

describe('the effects', () => {
  it('Riposte: a parry makes the next swing free', () => {
    const w = arena();
    wear(w, 'weapon', gear('long_sword'), 'riposte');
    priv(w).parryFlourish(w.player.x, w.player.y - 1);
    expect(w.anim.riposteT).toBe(RIPOSTE_WINDOW);
    const stamina = w.player.stamina;
    w.attack();
    expect(w.anim.riposteSwing).toBe(true);
    expect(w.player.stamina).toBe(stamina);
  });

  it('Bulwark: a heavy blow on the shield charges the next strike', () => {
    const w = arena(212);
    wear(w, 'offhand', gear('kite_shield'), 'bulwark');
    const e = foe(w, 'skeleton', DX[0], DY[0]);
    w.anim.blockRaise = 1;
    priv(w).damagePlayer(Math.round(w.derived.maxHp * 0.6), 'slash', e.x, e.y, 'Skeleton', 'skeleton', e);
    expect(w.anim.bulwarkT).toBe(BULWARK_WINDOW);
  });

  it('Execution: finishing a reeling monster refunds double', () => {
    const refund = (execution: boolean) => {
      const w = arena(213);
      if (execution) wear(w, 'weapon', gear('long_sword'), 'execution');
      w.run.sigil = { id: 'wardcry', cd: 60 };
      const e = foe(w, 'skeleton', 0, -1);
      e.vuln = 1;
      priv(w).killEnemy(e);
      return 60 - w.run.sigil.cd;
    };
    expect(refund(true)).toBeCloseTo(refund(false) * 2, 5);
  });

  it('Kindling: fire on a wounded monster burns its neighbour', () => {
    const w = arena(214);
    wear(w, 'weapon', gear('long_sword'), 'kindling');
    w.derived.stats.fire = 12;
    const target = foe(w, 'skeleton', 0, -1);
    const beside = foe(w, 'skeleton', 1, -1);
    target.hp = Math.round(target.maxHp * 0.3);
    w.anim.attackPower = 1;
    priv(w).hitEnemy(target);
    expect(beside.hp).toBeLessThan(beside.maxHp);
  });

  it('Last Flask: food heals more with the flask empty, and only then', () => {
    const w = arena(215);
    wear(w, 'body', gear('plate'), 'last_flask');
    w.player.hp = 10;
    w.run.flask!.charges = 1;
    const plain = priv(w).heal(20, 'food');
    w.player.hp = 10;
    w.run.flask!.charges = 0;
    const dry = priv(w).heal(20, 'food');
    expect(dry).toBe(Math.round(plain * LAST_FLASK_MULT));
    w.player.hp = 10;
    expect(priv(w).heal(20)).toBe(plain);
  });

  it('Retrieval: a returning shaft cuts each monster in its path once', () => {
    const w = arena(216);
    const belt = makeEquipment({ baseId: 'throwing_knives', materialId: 'iron', rarity: Rarity.Common, ilvl: 2, identified: true });
    wear(w, 'thrown', belt, 'retrieval');
    const e = foe(w, 'skeleton', 0, -2);
    Thrown.launchReturn(w, belt.ref, w.player.x, w.player.y - 4);
    for (let i = 0; i < 120; i++) w.update(1 / 60);
    expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('Retrieval: a returning shaft is scored off the belt, not the weapon in your hands', () => {
    const w = arena(217);
    w.state.equipment.weapon = makeEquipment({ baseId: 'war_axe', materialId: 'iron', rarity: Rarity.Common, ilvl: 8, identified: true });
    const belt = makeEquipment({ baseId: 'throwing_knives', materialId: 'iron', rarity: Rarity.Common, ilvl: 2, identified: true });
    belt.affixes = [{ id: 'blazing', value: 6 }];
    wear(w, 'thrown', belt, 'retrieval');
    Thrown.launchReturn(w, belt.ref, w.player.x, w.player.y - 4);
    const shaft = (w as unknown as { projectiles: { returning?: boolean; type: string; player?: { attack: number; damageType: string; stats: { fire: number } } }[] }).projectiles.find((p) => p.returning)!;
    expect(w.derived.attack).not.toBe(w.derived.thrownAttack);
    expect(shaft.player!.attack).toBe(w.derived.thrownAttack);
    expect(shaft.player!.damageType).toBe('pierce');
    expect(shaft.type).toBe('pierce');
    expect(shaft.player!.stats.fire).toBe(6);
  });
});

it('every property fits at least one kind of gear', () => {
  const bases = ['long_sword', 'kite_shield', 'throwing_knives', 'plate', 'gloves'];
  for (const id of PROPERTY_IDS) expect(bases.some((b) => canCarry(gear(b), id)), id).toBe(true);
});
