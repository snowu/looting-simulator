import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { GameState, newGame } from '../state/game-state';
import { migrateSave } from '../state/migrations';
import { EnemyState, createEnemy } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import {
  BLOOD_PRICE_GOLD, DRY_THROAT_DEPTH, DUELIST_KILLS, HUNTER_DEPTHS, HUNTER_MARKS, HUNTER_SIGHT, KINGSBANE_DAMAGE, OATHS,
  OATH_FALLBACK, OATH_IDS, OathId, PILGRIM_PRAYERS, SILENCE_DEPTH, SILENCE_NOISE, SILENCE_SIGHT, UNBROKEN_DEPTH, oathsForDay,
} from '../data/oaths';
import { PROPERTY_IDS } from '../data/properties';
import { claimOathReward, oathKept, runOath, settleOaths, todaysOaths, toggleOath } from '../systems/oaths';
import { endRun, startRun } from '../systems/run';
import { durability, makeEquipment } from '../systems/items';
import { Rarity } from '../types';
import { World } from '../world/world';

interface Private {
  changeFloor(dir: 'down' | 'up'): void;
  killEnemy(e: EnemyState): void;
  wear(slot: string, amount?: number): void;
  sightPenalty: number;
  noise(r: number): number;
  pray(p: { shrine?: string }): void;
  castWardcry(): void;
  damagePlayer(attack: number, type: string, fromX: number, fromY: number, source: string, sourceId?: string, attacker?: EnemyState): void;
}
const priv = (w: World) => w as unknown as Private;

/** A delve under these oaths (set directly, bypassing the day's offer). */
function sworn(ids: OathId[], seed = 301): { state: GameState; w: World } {
  const state = newGame(createRng(seed));
  state.pendingOaths = ids;
  startRun(state, seed);
  return { state, w: new World(state) };
}

describe('the stone', () => {
  it('offers one hard and two medium oaths a day, the same all day, changing with the days', () => {
    const seen = new Set<string>();
    for (let day = 1; day <= 30; day++) {
      const offer = oathsForDay('save-x', day);
      expect(offer).toHaveLength(3);
      expect(offer.filter((id) => OATHS[id].tier === 'hard')).toHaveLength(1);
      expect(offer.filter((id) => OATHS[id].tier === 'medium')).toHaveLength(2);
      expect(oathsForDay('save-x', day)).toEqual(offer);
      offer.forEach((id) => seen.add(id));
    }
    expect(seen.size).toBe(OATH_IDS.length);
  });

  it('swears any number of today\'s oaths, only in town, and they move onto the delve', () => {
    const state = newGame(createRng(300));
    const today = todaysOaths(state);
    const other = OATH_IDS.find((id) => !today.includes(id))!;
    expect(toggleOath(state, other)).toBe(false);
    for (const id of today) expect(toggleOath(state, id)).toBe(true);
    expect(state.pendingOaths).toEqual(today);
    expect(toggleOath(state, today[0])).toBe(true);
    expect(state.pendingOaths).toEqual(today.slice(1));
    startRun(state, 300);
    expect(state.run!.oaths!.map((o) => o.id)).toEqual(today.slice(1));
    expect(state.pendingOaths).toEqual([]);
    expect(toggleOath(state, today[0])).toBe(false);
  });

  it('no new oath while a reward waits', () => {
    const state = newGame(createRng(310));
    state.oathReward = { oaths: ['hunter'], choices: ['riposte'] };
    expect(toggleOath(state, todaysOaths(state)[0])).toBe(false);
  });

  it('migrates a single sworn oath, a delve\'s single oath and a waiting reward into lists', () => {
    const s = newGame(createRng(298)) as unknown as Record<string, any>;
    delete s.pendingOaths;
    s.pendingOath = 'hunter';
    s.oathReward = { oath: 'unbroken', choices: ['riposte'] };
    s.revision = 28;
    migrateSave(s as never);
    expect(s.pendingOaths).toEqual(['hunter']);
    expect(s.oathReward.oaths).toEqual(['unbroken']);

    const t = newGame(createRng(297));
    startRun(t, 297);
    const r = t as unknown as Record<string, any>;
    r.run.oath = { id: 'hunter', status: 'active', marks: 1 };
    delete r.run.oaths;
    r.revision = 28;
    migrateSave(r as never);
    expect(r.run.oaths).toEqual([{ id: 'hunter', status: 'active', marks: 1 }]);
    expect(r.run.oath).toBeUndefined();
  });
});

describe('each oath', () => {
  it('Blood Price: cursed, a font will not lift it, 250 found gold', () => {
    const { state, w } = sworn(['blood_price']);
    expect(state.run!.curse).toBe('frailty');
    priv(w).pray({ shrine: 'font' });
    expect(state.run!.curse).toBe('frailty');
    const o = runOath(state.run!, 'blood_price')!;
    expect(oathKept(state.run!, o, 'extracted')).toBe(false);
    state.run!.stats.goldFound = BLOOD_PRICE_GOLD;
    expect(oathKept(state.run!, o, 'extracted')).toBe(true);
    expect(oathKept(state.run!, o, 'dead')).toBe(false);
  });

  it('Unbroken: double wear, a break ends it, kept at its depth', () => {
    const { state, w } = sworn(['unbroken'], 303);
    const sword = makeEquipment({ baseId: 'long_sword', materialId: 'iron', rarity: Rarity.Common, ilvl: 2, identified: true });
    state.equipment.weapon = sword;
    const before = durability(sword).cur;
    priv(w).wear('weapon', 2);
    expect(before - durability(sword).cur).toBe(4);
    priv(w).wear('weapon', 9999);
    expect(runOath(state.run!, 'unbroken')!.status).toBe('broken');

    const b = sworn(['unbroken'], 304);
    for (let d = 1; d < UNBROKEN_DEPTH; d++) priv(b.w).changeFloor('down');
    expect(runOath(b.state.run!, 'unbroken')!.status).toBe('kept');
  });

  it('Hunter: sight, three marks placed once each, counted', () => {
    const plain = new World((() => { const s = newGame(createRng(305)); startRun(s, 305); return s; })());
    const { state, w } = sworn(['hunter'], 305);
    expect(priv(w).sightPenalty - priv(plain).sightPenalty).toBe(HUNTER_SIGHT);
    for (let d = 1; d < Math.max(...HUNTER_DEPTHS); d++) priv(w).changeFloor('down');
    const marked = state.run!.floors.flatMap((f) => f?.enemies.filter((e) => e.marked) ?? []);
    expect(marked).toHaveLength(HUNTER_DEPTHS.length);
    for (const e of marked) priv(w).killEnemy(e);
    expect(runOath(state.run!, 'hunter')!.marks).toBe(HUNTER_MARKS);
  });

  it('Dry Throat: the flask starts empty; kept at its depth', () => {
    const plain = sworn([], 320);
    const { state } = sworn(['dry_throat'], 320);
    expect(plain.state.run!.flask!.charges).toBeGreaterThan(0);
    expect(state.run!.flask!.charges).toBe(0);
    const o = runOath(state.run!, 'dry_throat')!;
    state.run!.stats.deepest = DRY_THROAT_DEPTH;
    expect(oathKept(state.run!, o, 'extracted')).toBe(true);
  });

  it('Duelist: blocking absorbs nothing; kills are counted', () => {
    const block = (ids: OathId[]) => {
      const { w } = sworn(ids, 321);
      const p = w.player;
      const e = createEnemy(enemyDef('skeleton'), p.x, p.y - 1, 0, 'e', 1);
      w.floor.enemies = [e];
      Object.assign(p, { facing: 0 });
      w.anim.blockRaise = 1;
      const hp = p.hp;
      priv(w).damagePlayer(30, 'slash', e.x, e.y, 'Skeleton', 'skeleton', e);
      return hp - p.hp;
    };
    expect(block(['duelist'])).toBeGreaterThan(block([]));
    const { state, w } = sworn(['duelist'], 322);
    for (let i = 0; i < DUELIST_KILLS; i++) {
      const e = createEnemy(enemyDef('rat'), 1, 1, 0, `r${i}`, 1);
      w.floor.enemies.push(e);
      priv(w).killEnemy(e);
    }
    expect(runOath(state.run!, 'duelist')!.kills).toBe(DUELIST_KILLS);
    expect(oathKept(state.run!, runOath(state.run!, 'duelist')!, 'extracted')).toBe(true);
  });

  it('Kingsbane: monsters hit harder; kept only by killing the King', () => {
    const plain = sworn([], 323);
    const { state, w } = sworn(['kingsbane'], 323);
    expect(w.diff.enemyDamage).toBeCloseTo(plain.w.diff.enemyDamage * KINGSBANE_DAMAGE);
    const o = runOath(state.run!, 'kingsbane')!;
    expect(oathKept(state.run!, o, 'extracted')).toBe(false);
    state.run!.stats.bossKilled = true;
    expect(oathKept(state.run!, o, 'extracted')).toBe(true);
  });

  it('Silence: shorter sight, louder noise, broken by Wardcry or an alarm', () => {
    const plain = sworn([], 324);
    const { state, w } = sworn(['silence'], 324);
    expect(priv(plain.w).sightPenalty - priv(w).sightPenalty).toBe(SILENCE_SIGHT);
    expect(priv(w).noise(6)).toBe(priv(plain.w).noise(6) * SILENCE_NOISE);
    const o = runOath(state.run!, 'silence')!;
    state.run!.stats.deepest = SILENCE_DEPTH;
    expect(oathKept(state.run!, o, 'extracted')).toBe(true);
    priv(w).castWardcry();
    expect(o.status).toBe('broken');
    expect(oathKept(state.run!, o, 'extracted')).toBe(false);
  });

  it('Pilgrim: prayers are counted', () => {
    const { state, w } = sworn(['pilgrim'], 325);
    const shrine = { id: 's', kind: 'shrine', shrine: 'font', x: w.player.x, y: w.player.y - 1, used: false, tier: 'none', blocking: true, mimic: false };
    for (let i = 0; i < PILGRIM_PRAYERS; i++) {
      shrine.used = false;
      w.floor.props.push(shrine as never);
      Object.assign(w.player, { facing: 0 });
      w.interact();
      w.floor.props = w.floor.props.filter((p) => p !== (shrine as never));
    }
    expect(runOath(state.run!, 'pilgrim')!.prayers).toBe(PILGRIM_PRAYERS);
  });
});

describe('the reward', () => {
  it('pays per kept oath: medium one, hard two, and one more for keeping all of two or more', () => {
    const { state } = sworn(['blood_price', 'hunter'], 330);
    state.run!.stats.goldFound = BLOOD_PRICE_GOLD;
    runOath(state.run!, 'hunter')!.marks = HUNTER_MARKS;
    const out = settleOaths(state, state.run!, 'extracted')!;
    expect(out.results).toEqual([{ id: 'blood_price', kept: true }, { id: 'hunter', kept: true }]);
    expect(out.bonus).toBe(true);
    expect(out.picks).toBe(2 + 1 + 1);
    expect(state.oathReward!.picks).toBe(4);
    expect(state.oathReward!.choices.length).toBe(5);
    expect(state.oathReward!.oaths).toEqual(['blood_price', 'hunter']);
  });

  it('a broken oath loses only its own reward, and the bonus', () => {
    const { state } = sworn(['blood_price', 'hunter'], 331);
    state.run!.stats.goldFound = BLOOD_PRICE_GOLD;
    const out = settleOaths(state, state.run!, 'extracted')!;
    expect(out.results.find((r) => r.id === 'hunter')!.kept).toBe(false);
    expect(out.bonus).toBe(false);
    expect(out.picks).toBe(2);
  });

  it('nothing on a death', () => {
    const { state } = sworn(['blood_price'], 332);
    const sum = endRun(state, 'dead');
    expect(sum.oaths).toEqual({ results: [{ id: 'blood_price', kept: false }], picks: 0, renown: 0, bonus: false });
    expect(state.oathReward ?? null).toBeNull();
  });

  it('renown instead when every inscription is known', () => {
    const { state } = sworn(['blood_price'], 333);
    state.properties = [...PROPERTY_IDS];
    state.run!.stats.goldFound = BLOOD_PRICE_GOLD;
    const renown = state.renown;
    expect(settleOaths(state, state.run!, 'extracted')!.renown).toBe(OATH_FALLBACK.hard);
    expect(state.renown).toBe(renown + OATH_FALLBACK.hard);
  });

  it('claims one pick at a time; a reward from before stacking pays one', () => {
    const state = newGame(createRng(311));
    state.oathReward = { oaths: ['blood_price'], choices: ['riposte', 'bulwark', 'retrieval'], picks: 2 };
    expect(claimOathReward(state, 'not-offered')).toBe(false);
    expect(claimOathReward(state, 'bulwark')).toBe(true);
    expect(state.oathReward).toEqual({ oaths: ['blood_price'], choices: ['riposte', 'retrieval'], picks: 1 });
    expect(claimOathReward(state, 'retrieval')).toBe(true);
    expect(state.oathReward).toBeNull();
    state.oathReward = { oath: 'hunter', choices: ['riposte', 'kindling'] };
    claimOathReward(state, 'riposte');
    expect(state.oathReward).toBeNull();
  });
});
