import { describe, expect, it } from 'vitest';
import { parseSave } from '../state/save-format';
import { SAVE_REVISION, migrateSave } from '../state/migrations';
import { SAVE_VERSION, newGame } from '../state/game-state';
import { createRng } from '../core/rng';
import { GameState } from '../state/game-state';

/**
 * A real save captured from the build of 2026-09-12, before revisions existed.
 * It stands in for a save sitting in a player's browser: if a change to the
 * schema breaks this, it breaks theirs.
 */
import legacySave from './fixtures/save-legacy.json';
const LEGACY = JSON.stringify(legacySave);

describe('loading an old save', () => {
  it('accepts a save written before revisions existed', () => {
    const s = parseSave(LEGACY);
    expect(s).not.toBeNull();
    expect(s!.revision).toBe(SAVE_REVISION);
  });

  it('keeps the town progress intact', () => {
    const s = parseSave(LEGACY)!;
    expect(s.gold).toBe(840);
    expect(s.renown).toBe(31);
    expect(s.meta).toEqual({ pack: 2, tough: 3, smith: 1, appraiser: 1 });
    expect(s.lifetime.kills).toBe(137);
    expect(s.lifetime.bestDepth).toBe(5);
    expect(s.stash.items.length).toBeGreaterThan(0);
    expect(s.knownRecipes.length).toBeGreaterThan(0);
    expect(s.equipment.weapon).toBeTruthy();
  });

  it('keeps a run in progress resumable', () => {
    const s = parseSave(LEGACY)!;
    const run = s.run!;
    expect(run.depth).toBe(2);
    expect(run.outcome).toBe('active');
    expect(run.gold).toBe(210);
    expect(run.player.hp).toBe(54);
    expect(run.backpack.items.length).toBe(3);
    expect(run.floors.length).toBe(2);
    for (const f of run.floors) {
      expect(f).toBeTruthy();
      expect(f!.tiles.length).toBe(f!.width * f!.height);
      expect(f!.rooms.length).toBeGreaterThan(0);
      expect(f!.stairs.length).toBeGreaterThan(0);
      expect(Array.isArray(f!.props)).toBe(true);
      expect(Array.isArray(f!.enemies)).toBe(true);
    }
  });

  it('backfills fields added after the save was written', () => {
    const s = parseSave(LEGACY)!;
    // Floors generated before traps existed get none rather than being
    // regenerated, which would move the walls under a player mid-run.
    for (const f of s.run!.floors) expect(f!.traps).toEqual([]);
    // The town-side pack and the town portal both arrived after this save.
    expect(s.loadout.items).toEqual([]);
    expect(s.loadout.capacity).toBeGreaterThan(0);
    expect(s.run!.portal).toBeNull();
    for (const f of s.run!.floors) for (const e of f!.enemies) expect(e.vuln).toBe(0);
    // Chests already seen in an old run do not change under the player.
    for (const f of s.run!.floors) for (const p of f!.props) expect(p.mimic).toBe(false);
    // Curses and shrine flavours both arrived after this save was written.
    expect(s.run!.curse).toBeNull();
    for (const f of s.run!.floors) {
      for (const p of f!.props) if (p.kind === 'shrine') expect(['font', 'idol', 'coffer']).toContain(p.shrine);
    }
  });

  it('treats a summary written before the rule as a day that turned', () => {
    const withRun = JSON.parse(LEGACY);
    withRun.lastRun = { outcome: 'extracted', day: 3, depth: 4, gold: 120, items: [], lost: [], renown: 10, kills: 8, bossKilled: false };
    const s = parseSave(JSON.stringify(withRun))!;
    expect(s.lastRun!.dayTurned).toBe(true);
  });

  it('refuses a save from an older format family', () => {
    const old = JSON.parse(LEGACY);
    old.version = SAVE_VERSION - 1;
    expect(parseSave(JSON.stringify(old))).toBeNull();
  });

  it('leaves a save from a newer build alone', () => {
    const future = JSON.parse(LEGACY) as GameState & { revision: number };
    future.revision = SAVE_REVISION + 5;
    const s = parseSave(JSON.stringify(future))!;
    expect(s.revision).toBe(SAVE_REVISION + 5);
  });

  it('survives a save missing whole sections', () => {
    const gutted = JSON.parse(LEGACY);
    delete gutted.meta;
    delete gutted.knownRecipes;
    delete gutted.lifetime;
    delete gutted.lastRun;
    delete gutted.run.keys;
    const s = parseSave(JSON.stringify(gutted))!;
    expect(s).not.toBeNull();
    expect(s.meta).toEqual({});
    expect(s.knownRecipes).toEqual([]);
    expect(s.lifetime.runs).toBe(0);
    expect(s.run!.keys).toEqual([]);
  });

  it('gives a save written before ids existed an identity', () => {
    const s = parseSave(LEGACY)!;
    expect(typeof s.saveId).toBe('string');
    expect(s.saveId!.length).toBeGreaterThan(8);
  });

  it('never re-identifies a save that already has an id', () => {
    // The id is how sync recognises this playthrough on another device. If
    // loading could change it, the same game would start syncing as two.
    const once = parseSave(LEGACY)!;
    const again = parseSave(JSON.stringify(once))!;
    expect(again.saveId).toBe(once.saveId);
  });

  it('gives separate games separate identities', () => {
    const a = newGame(createRng(1));
    const b = newGame(createRng(1));
    expect(a.saveId).not.toBe(b.saveId);
  });

  it('is idempotent — migrating twice changes nothing', () => {
    const once = parseSave(LEGACY)!;
    const twice = migrateSave(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('round-trips a fresh game', () => {
    const fresh = newGame(createRng(1));
    const back = parseSave(JSON.stringify(fresh))!;
    expect(back.revision).toBe(SAVE_REVISION);
    expect(back.gold).toBe(fresh.gold);
  });
});
