import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIFFICULTIES, DIFFICULTY_IDS, difficultyOf, isDifficultyId } from '../data/difficulty';
import { ENEMIES, enemyDef } from '../data/enemies';
import { createEnemy, generateFloor } from '../systems/dungeon';
import { derivePlayer, emptyEquipment } from '../systems/player';
import { rollEnemyLoot, rollContainerLoot } from '../systems/items';
import { GameState, newGame } from '../state/game-state';
import { describeSave, parseSave, serializeSave } from '../state/save-format';
import { endRun, startRun } from '../systems/run';
import { World } from '../world/world';
import { Dir, turnAround } from '../core/dir';

/**
 * Hardcore: Hard in every number, with one life.
 *
 * The first block is the contract the mode was asked for — "same exact
 * difficulty values and curve and gameplay as Hard" — so it compares whole
 * outputs, not a sample of knobs: floors, spawns, loot, the player, and a
 * real fight tick for tick. The second block is the one life.
 */
const scrub = (v: unknown): string => JSON.stringify(v, (k, x) => (k === 'uid' ? undefined : x));

describe('hardcore plays exactly like hard', () => {
  it('shares every tuning knob with hard', () => {
    const { id: _a, name: _b, tagline: _c, description: _d, oneLife: hcLife, ...hc } = DIFFICULTIES.hardcore;
    const { id: _e, name: _f, tagline: _g, description: _h, oneLife: hardLife, ...hard } = DIFFICULTIES.hard;
    expect(hc).toEqual(hard);
    expect(hcLife).toBe(true);
    expect(hardLife).toBe(false);
  });

  it('is a real, resolvable difficulty', () => {
    expect(DIFFICULTY_IDS).toContain('hardcore');
    expect(isDifficultyId('hardcore')).toBe(true);
    expect(difficultyOf('hardcore').id).toBe('hardcore');
  });

  it('generates identical floors, monsters, loot and player', () => {
    for (const seed of [1, 7, 42, 1234]) {
      for (let depth = 1; depth <= 6; depth++) {
        expect(scrub(generateFloor(seed, depth, 'hardcore'))).toBe(scrub(generateFloor(seed, depth, 'hard')));
        for (const tier of ['urn', 'chest', 'vault', 'secret'] as const) {
          expect(scrub(rollContainerLoot(createRng(seed), depth, 30, tier, undefined, {}, [], 'hardcore')))
            .toBe(scrub(rollContainerLoot(createRng(seed), depth, 30, tier, undefined, {}, [], 'hard')));
        }
        expect(scrub(rollEnemyLoot(createRng(seed), enemyDef('ghoul'), depth, 30, undefined, {}, {}, [], 'hardcore')))
          .toBe(scrub(rollEnemyLoot(createRng(seed), enemyDef('ghoul'), depth, 30, undefined, {}, {}, [], 'hard')));
      }
    }
    for (const def of ENEMIES) {
      for (let depth = 1; depth <= 6; depth++) {
        expect(createEnemy(def, 0, 0, Dir.N, 'x', depth, 'hardcore').hp).toBe(createEnemy(def, 0, 0, Dir.N, 'x', depth, 'hard').hp);
      }
    }
    expect(derivePlayer(emptyEquipment(), { toughness: 3 }, 'hardcore')).toEqual(derivePlayer(emptyEquipment(), { toughness: 3 }, 'hard'));
  });

  it('fights the same fight, tick for tick', () => {
    const run = (difficulty: 'hard' | 'hardcore', swing: boolean): number[] => {
      const state = newGame(createRng(8));
      state.difficulty = difficulty;
      startRun(state, 8);
      const w = new World(state);
      w.floor.enemies = [];
      const t = w.frontTile(1);
      w.floor.enemies.push(createEnemy(enemyDef('skeleton'), t.x, t.y, turnAround(w.player.facing), 'hitter', 1, difficulty));
      const trace: number[] = [];
      for (let i = 0; i < 60 * 5; i++) {
        if (swing && i % 20 === 0) w.attack();
        w.update(1 / 60);
        trace.push(w.player.hp, w.floor.enemies[0]?.hp ?? -1);
      }
      return trace;
    };
    // Standing still, the skeleton lands blows; swinging, ours land too.
    const struck = run('hard', false);
    expect(struck.some((v, i) => i % 2 === 0 && v < struck[0])).toBe(true);
    expect(run('hardcore', false)).toEqual(struck);
    const fought = run('hard', true);
    expect(fought.some((v, i) => i % 2 === 1 && v < fought[1])).toBe(true);
    expect(run('hardcore', true)).toEqual(fought);
  });
});

describe('hardcore has one life', () => {
  function dieIn(state: GameState): void {
    startRun(state, 21);
    state.run!.killedBy = 'Skeleton';
    state.run!.outcome = 'dead';
  }

  it('a death buries the hero', () => {
    const s = newGame(createRng(9));
    s.difficulty = 'hardcore';
    dieIn(s);
    const summary = endRun(s, 'dead');
    expect(summary.fallen).toBe(true);
    expect(s.fallen).toEqual({ day: summary.day, depth: 1, killedBy: 'Skeleton', delve: 1 });
    expect(() => startRun(s)).toThrow();
    expect(describeSave(s).place).toBe('Fell at depth 1');
    expect(describeSave(s).difficulty).toBe('Hardcore');
  });

  it('the grave survives a save round trip', () => {
    const s = newGame(createRng(10));
    s.difficulty = 'hardcore';
    dieIn(s);
    endRun(s, 'dead');
    const back = parseSave(serializeSave(s))!;
    expect(back.difficulty).toBe('hardcore');
    expect(back.fallen?.killedBy).toBe('Skeleton');
  });

  it('extracting, and dying on hard, bury no one', () => {
    const hc = newGame(createRng(11));
    hc.difficulty = 'hardcore';
    startRun(hc, 3);
    expect(endRun(hc, 'extracted').fallen).toBeUndefined();
    expect(hc.fallen ?? null).toBeNull();
    startRun(hc, 4);

    const hard = newGame(createRng(11));
    dieIn(hard);
    expect(endRun(hard, 'dead').fallen).toBeUndefined();
    expect(hard.fallen ?? null).toBeNull();
    expect(() => startRun(hard)).not.toThrow();
  });

  it('keeps hardcore through a save round trip mid-delve, and on new games stays off', () => {
    const s = newGame(createRng(12));
    expect(s.difficulty).toBe('hard');
    s.difficulty = 'hardcore';
    startRun(s, 5);
    const back = parseSave(serializeSave(s))!;
    expect(back.difficulty).toBe('hardcore');
    expect(back.run!.difficulty).toBe('hardcore');
    expect(new World(back).diff.oneLife).toBe(true);
  });

  it('an older save migrates alive', () => {
    const raw = JSON.parse(serializeSave(newGame(createRng(13)))) as Record<string, unknown>;
    delete raw.fallen;
    raw.revision = 22;
    const s = parseSave(JSON.stringify(raw))!;
    expect(s.fallen).toBeNull();
    expect(s.difficulty).toBe('hard');
  });
});
