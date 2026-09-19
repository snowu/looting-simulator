import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { GameState, newGame } from '../state/game-state';
import { migrateSave } from '../state/migrations';
import { generateFloor } from '../systems/dungeon';
import { BOSS_ID } from '../data/enemies';
import { DRY_WELL_CHARGES, LIGHTLESS_LIGHT, MULTITUDES_COUNT, SEAL_FIND, SEAL_RENOWN, TEETH_DAMAGE, sealFloorMods } from '../data/seals';
import { sealsUnlocked, toggleSeal } from '../systems/seals';
import { endRun, startRun } from '../systems/run';
import { World } from '../world/world';

function kingSlain(state: GameState): void {
  state.bestiary[BOSS_ID] = { kills: 1, deaths: 0, bestHit: 0, worstHit: 0, known: true };
}

function sealed(seals: string[], seed = 801): { state: GameState; w: World } {
  const state = newGame(createRng(seed));
  kingSlain(state);
  state.pendingSeals = seals;
  startRun(state, seed);
  return { state, w: new World(state) };
}

describe('unlocking', () => {
  it('only once the King has fallen, and only in town', () => {
    const state = newGame(createRng(800));
    expect(sealsUnlocked(state)).toBe(false);
    expect(toggleSeal(state, 'teeth')).toBe(false);
    kingSlain(state);
    expect(sealsUnlocked(state)).toBe(true);
    expect(toggleSeal(state, 'teeth')).toBe(true);
    expect(state.pendingSeals).toEqual(['teeth']);
    expect(toggleSeal(state, 'teeth')).toBe(true);
    expect(state.pendingSeals).toEqual([]);
    startRun(state, 800);
    expect(toggleSeal(state, 'teeth')).toBe(false);
  });

  it('Seals set before the King fell do nothing', () => {
    const state = newGame(createRng(802));
    state.pendingSeals = ['teeth'];
    startRun(state, 802);
    expect(state.run!.seals).toBeUndefined();
  });

  it('migrates an older save with none set', () => {
    const s = newGame(createRng(803)) as unknown as Record<string, unknown>;
    delete s.pendingSeals;
    s.revision = 27;
    migrateSave(s as never);
    expect(s.pendingSeals).toEqual([]);
  });
});

describe('each Seal', () => {
  it('Teeth: monsters hit harder', () => {
    const plain = sealed([]);
    const { w } = sealed(['teeth']);
    expect(w.diff.enemyDamage).toBeCloseTo(plain.w.diff.enemyDamage * TEETH_DAMAGE);
  });

  it('Multitudes: more monsters on a floor', () => {
    let plain = 0, many = 0;
    for (let seed = 0; seed < 20; seed++) {
      plain += generateFloor(seed, 3, 'hard').enemies.length;
      many += generateFloor(seed, 3, 'hard', false, undefined, sealFloorMods(['multitudes'])).enemies.length;
    }
    expect(many).toBeGreaterThan(plain * (1 + (MULTITUDES_COUNT - 1) / 2));
  });

  it('Champions: elites even on the first floor', () => {
    let elites = 0;
    for (let seed = 0; seed < 20; seed++) elites += generateFloor(seed, 1, 'hard', false, undefined, sealFloorMods(['champions'])).enemies.filter((e) => e.elite).length;
    expect(elites).toBeGreaterThan(5);
    for (let seed = 0; seed < 20; seed++) expect(generateFloor(seed, 1, 'hard').enemies.filter((e) => e.elite)).toEqual([]);
  });

  it('the Dry Well: the flask starts short, never below one', () => {
    const plain = sealed([]);
    const { state } = sealed(['dry_well']);
    expect(state.run!.flask!.charges).toBe(Math.max(1, plain.state.run!.flask!.charges - DRY_WELL_CHARGES));
  });

  it('the Lightless: less light', () => {
    const plain = sealed([]);
    const { w } = sealed(['lightless']);
    expect(w.playerLightRadius).toBe(Math.max(2.5, plain.w.playerLightRadius - LIGHTLESS_LIGHT));
  });
});

describe('the pay', () => {
  it('more loot find and renown per Seal, and a record for the King', () => {
    const { w } = sealed(['teeth', 'lightless']);
    const plain = sealed([]);
    const find = (x: World) => (x as unknown as { lootFind: number }).lootFind;
    expect(find(w) - find(plain.w)).toBe(2 * SEAL_FIND);

    const a = sealed([], 804);
    a.state.run!.stats.deepest = 3;
    const plainRenown = endRun(a.state, 'extracted').renown;
    const b = sealed(['teeth', 'multitudes'], 804);
    b.state.run!.stats.deepest = 3;
    const sum = endRun(b.state, 'extracted');
    expect(sum.renown).toBe(Math.round(plainRenown * (1 + 2 * SEAL_RENOWN)));
    expect(sum.seals).toEqual({ count: 2, record: false });

    const c = sealed(['teeth', 'multitudes', 'champions'], 805);
    c.state.run!.stats.bossKilled = true;
    expect(endRun(c.state, 'extracted').seals).toEqual({ count: 3, record: true });
    expect(c.state.lifetime.bestSeals).toBe(3);
  });
});
