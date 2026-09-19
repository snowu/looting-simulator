import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { GameState, newGame } from '../state/game-state';
import { migrateSave } from '../state/migrations';
import { EnemyState } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import {
  BLOOD_PRICE_GOLD, HUNTER_DEPTHS, HUNTER_MARKS, HUNTER_SIGHT, OATH_FALLBACK_RENOWN, UNBROKEN_DEPTH,
} from '../data/oaths';
import { PROPERTY_IDS } from '../data/properties';
import { oathKept, settleOath, swearOath } from '../systems/oaths';
import { endRun, startRun } from '../systems/run';
import { durability, makeEquipment } from '../systems/items';
import { Rarity } from '../types';
import { World } from '../world/world';

interface Private {
  changeFloor(dir: 'down' | 'up'): void;
  killEnemy(e: EnemyState): void;
  wear(slot: string, amount?: number): void;
  sightPenalty: number;
  pray(p: { shrine?: string }): void;
}
const priv = (w: World) => w as unknown as Private;

function sworn(id: 'blood_price' | 'unbroken' | 'hunter', seed = 301): { state: GameState; w: World } {
  const state = newGame(createRng(seed));
  expect(swearOath(state, id)).toBe(true);
  startRun(state, seed);
  return { state, w: new World(state) };
}

describe('swearing', () => {
  it('is a town decision, taken onto the next delve and then cleared', () => {
    const state = newGame(createRng(300));
    expect(swearOath(state, 'hunter')).toBe(true);
    expect(swearOath(state, null)).toBe(true);
    expect(state.pendingOath).toBeNull();
    swearOath(state, 'unbroken');
    startRun(state, 300);
    expect(state.run!.oath).toEqual({ id: 'unbroken', status: 'active', marks: 0, placed: [] });
    expect(state.pendingOath).toBeNull();
    expect(swearOath(state, 'hunter')).toBe(false);
  });

  it('a delve with no oath has none', () => {
    const state = newGame(createRng(299));
    startRun(state, 299);
    expect(state.run!.oath).toBeUndefined();
    const sum = endRun(state, 'extracted');
    expect(sum.oath).toBeUndefined();
  });

  it('migrates an older save with nothing sworn', () => {
    const s = newGame(createRng(298)) as unknown as Record<string, unknown>;
    delete s.pendingOath;
    delete s.oathReward;
    s.revision = 25;
    migrateSave(s as never);
    expect(s.pendingOath).toBeNull();
    expect(s.oathReward).toBeNull();
  });
});

describe('Blood Price', () => {
  it('starts you cursed, and a font will not lift it', () => {
    const { state, w } = sworn('blood_price');
    expect(state.run!.curse).toBe('frailty');
    priv(w).pray({ shrine: 'font' });
    expect(state.run!.curse).toBe('frailty');
  });

  it(`is kept by coming home with ${BLOOD_PRICE_GOLD} gold found, and only then`, () => {
    const { state } = sworn('blood_price', 302);
    state.run!.stats.goldFound = BLOOD_PRICE_GOLD - 1;
    expect(oathKept(state.run!, 'extracted')).toBe(false);
    state.run!.stats.goldFound = BLOOD_PRICE_GOLD;
    expect(oathKept(state.run!, 'dead')).toBe(false);
    const sum = endRun(state, 'extracted');
    expect(sum.oath).toEqual({ id: 'blood_price', kept: true, renown: 0 });
    expect(state.oathReward?.choices).toHaveLength(3);
    for (const c of state.oathReward!.choices) expect(PROPERTY_IDS).toContain(c);
  });
});

describe('Unbroken', () => {
  it('doubles wear, and a break ends it', () => {
    const { state, w } = sworn('unbroken', 303);
    const sword = makeEquipment({ baseId: 'long_sword', materialId: 'iron', rarity: Rarity.Common, ilvl: 2, identified: true });
    state.equipment.weapon = sword;
    const before = durability(sword).cur;
    priv(w).wear('weapon', 2);
    expect(before - durability(sword).cur).toBe(4);
    priv(w).wear('weapon', 9999);
    expect(state.run!.oath!.status).toBe('broken');
  });

  it(`is kept on reaching depth ${UNBROKEN_DEPTH} whole, and paid on the way home`, () => {
    const { state, w } = sworn('unbroken', 304);
    for (let d = 1; d < UNBROKEN_DEPTH; d++) priv(w).changeFloor('down');
    expect(state.run!.depth).toBe(UNBROKEN_DEPTH);
    expect(state.run!.oath!.status).toBe('kept');
    expect(oathKept(state.run!, 'dead')).toBe(false);
    expect(oathKept(state.run!, 'extracted')).toBe(true);
  });
});

describe('Hunter', () => {
  it('lets monsters see further', () => {
    const plain = new World((() => { const s = newGame(createRng(305)); startRun(s, 305); return s; })());
    const { w } = sworn('hunter', 305);
    expect(priv(w).sightPenalty - priv(plain).sightPenalty).toBe(HUNTER_SIGHT);
  });

  it('marks one elite on each hunt depth, once, and counts the kills', () => {
    const { state, w } = sworn('hunter', 306);
    for (let d = 1; d < Math.max(...HUNTER_DEPTHS); d++) priv(w).changeFloor('down');
    const marked = state.run!.floors.flatMap((f) => f?.enemies.filter((e) => e.marked) ?? []);
    expect(marked).toHaveLength(HUNTER_DEPTHS.length);
    for (const e of marked) expect(e.elite).toBeDefined();
    // Never the weakest thing on the floor.
    for (const e of marked) {
      const floor = state.run!.floors.find((f) => f?.enemies.includes(e))!;
      const weakest = Math.min(...floor.enemies.map((o) => enemyDef(o.def).hp));
      expect(enemyDef(e.def).hp).toBeGreaterThan(weakest);
    }
    expect(state.run!.oath!.placed).toEqual(HUNTER_DEPTHS);
    // Going back up and down does not mark again.
    priv(w).changeFloor('up');
    priv(w).changeFloor('down');
    expect(state.run!.floors.flatMap((f) => f?.enemies.filter((e) => e.marked) ?? [])).toHaveLength(HUNTER_DEPTHS.length);
    for (const e of marked) priv(w).killEnemy(e);
    expect(state.run!.oath!.marks).toBe(HUNTER_MARKS);
    expect(oathKept(state.run!, 'extracted')).toBe(true);
  });
});

describe('the reward', () => {
  it('draws only unlearned properties, and pays renown when there are none', () => {
    const { state } = sworn('blood_price', 307);
    state.properties = PROPERTY_IDS.slice(0, 4);
    state.run!.stats.goldFound = BLOOD_PRICE_GOLD;
    settleOath(state, state.run!, 'extracted');
    expect(state.oathReward!.choices.sort()).toEqual(PROPERTY_IDS.slice(4).sort());

    const again = sworn('blood_price', 308);
    again.state.properties = [...PROPERTY_IDS];
    again.state.run!.stats.goldFound = BLOOD_PRICE_GOLD;
    const renown = again.state.renown;
    expect(settleOath(again.state, again.state.run!, 'extracted')).toEqual({ id: 'blood_price', kept: true, renown: OATH_FALLBACK_RENOWN });
    expect(again.state.renown).toBe(renown + OATH_FALLBACK_RENOWN);
    expect(again.state.oathReward ?? null).toBeNull();
  });

  it('no new oath until the last reward is chosen', () => {
    const state = newGame(createRng(310));
    state.oathReward = { oath: 'hunter', choices: ['riposte'] };
    expect(swearOath(state, 'unbroken')).toBe(false);
    state.oathReward = null;
    expect(swearOath(state, 'unbroken')).toBe(true);
  });

  it('a broken oath pays nothing', () => {
    const { state } = sworn('blood_price', 309);
    const sum = endRun(state, 'dead');
    expect(sum.oath).toEqual({ id: 'blood_price', kept: false, renown: 0 });
    expect(state.oathReward ?? null).toBeNull();
  });
});
