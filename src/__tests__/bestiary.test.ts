import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import {
  BESTIARY_ORDER,
  BestiaryState,
  bestiaryEntry,
  bestiaryProgress,
  isKnown,
  isSeen,
  recordDamageDealt,
  recordDamageTaken,
  recordDeath,
  recordKill,
  unlockEntry,
} from '../systems/bestiary';
import { rollEnemyLoot } from '../systems/items';
import { enemyDef, BOSS_ID } from '../data/enemies';
import { ENEMIES } from '../data/enemies';
import { newGame } from '../state/game-state';
import { migrateSave } from '../state/migrations';

describe('bestiary', () => {
  it('lists every creature, shallowest first', () => {
    expect(BESTIARY_ORDER.length).toBe(ENEMIES.length);
    for (let i = 1; i < BESTIARY_ORDER.length; i++) {
      expect(BESTIARY_ORDER[i].minDepth).toBeGreaterThanOrEqual(BESTIARY_ORDER[i - 1].minDepth);
    }
  });

  it('separates met from recorded', () => {
    const b = {};
    expect(isSeen(b, 'rat')).toBe(false);
    recordKill(b, 'rat');
    expect(isSeen(b, 'rat')).toBe(true);
    expect(isKnown(b, 'rat')).toBe(false);
    expect(unlockEntry(b, 'rat')).toBe(true);
    expect(isKnown(b, 'rat')).toBe(true);
    // A page already in the codex is not a fresh one.
    expect(unlockEntry(b, 'rat')).toBe(false);
  });

  it('drops field notes until the entry is read, then stops', () => {
    const def = enemyDef('skeleton');
    const lore = (bestiary: BestiaryState) => {
      let found = 0;
      for (let seed = 0; seed < 300; seed++) {
        const roll = rollEnemyLoot(createRng(seed), def, 3, 0, undefined, {}, bestiary);
        if (roll.items.some((i) => i.kind === 'lore' && i.ref === 'skeleton')) found++;
      }
      return found;
    };
    expect(lore({})).toBeGreaterThan(0);
    expect(lore({ skeleton: { kills: 9, deaths: 2, bestHit: 0, worstHit: 0, known: true } })).toBe(0);
  });

  it('always gives up the boss page', () => {
    const def = enemyDef(BOSS_ID);
    for (let seed = 0; seed < 20; seed++) {
      const roll = rollEnemyLoot(createRng(seed), def, 6, 0, undefined, {}, {});
      expect(roll.items.some((i) => i.kind === 'lore' && i.ref === BOSS_ID)).toBe(true);
    }
  });

  it('files what killed you, and reads entries written before deaths existed', () => {
    const b: BestiaryState = {};
    recordDeath(b, 'ghoul');
    recordDeath(b, 'ghoul');
    expect(bestiaryEntry(b, 'ghoul').deaths).toBe(2);
    expect(isSeen(b, 'ghoul')).toBe(true);
    // An entry from before the field existed must still read cleanly.
    const legacy = { rat: { kills: 4, known: true } } as unknown as BestiaryState;
    expect(bestiaryEntry(legacy, 'rat')).toEqual({ kills: 4, deaths: 0, bestHit: 0, worstHit: 0, known: true });
    recordDeath(legacy, 'rat');
    expect(bestiaryEntry(legacy, 'rat').deaths).toBe(1);
  });

  it('keeps counting kills and deaths while the entry is still locked', () => {
    // The tallies have to be waiting the moment the notes are read, otherwise
    // unlocking shows a pair of zeroes for a creature you have fought for hours.
    const b: BestiaryState = {};
    recordKill(b, 'spider');
    recordKill(b, 'spider');
    recordDeath(b, 'spider');
    expect(isKnown(b, 'spider')).toBe(false);
    expect(bestiaryEntry(b, 'spider')).toMatchObject({ kills: 2, deaths: 1 });
    unlockEntry(b, 'spider');
    expect(bestiaryEntry(b, 'spider')).toEqual({ kills: 2, deaths: 1, bestHit: 0, worstHit: 0, known: true });
  });

  it('keeps only the hardest blow in each direction', () => {
    const b: BestiaryState = {};
    for (const n of [12, 40, 7]) recordDamageDealt(b, 'ghoul', n);
    for (const n of [5, 31, 22]) recordDamageTaken(b, 'ghoul', n);
    expect(bestiaryEntry(b, 'ghoul')).toMatchObject({ bestHit: 40, worstHit: 31 });
    // A softer blow never lowers the record.
    recordDamageDealt(b, 'ghoul', 1);
    expect(bestiaryEntry(b, 'ghoul').bestHit).toBe(40);
  });

  it('counts progress across the codex', () => {
    const b = {};
    expect(bestiaryProgress(b)).toMatchObject({ known: 0, seen: 0, total: ENEMIES.length });
    recordKill(b, 'rat');
    unlockEntry(b, 'goblin');
    expect(bestiaryProgress(b)).toMatchObject({ known: 1, seen: 2 });
  });

  it('gives a new game an empty codex and migrates an old save into one', () => {
    expect(newGame(createRng(1)).bestiary).toEqual({});
    // A save written before the codex existed must load, not break.
    const old = newGame(createRng(2)) as unknown as Record<string, unknown>;
    delete old.bestiary;
    old.revision = 11;
    const migrated = migrateSave(old as never);
    expect(migrated.bestiary).toEqual({});
  });
});
