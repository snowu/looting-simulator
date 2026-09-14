import { describe, expect, it } from 'vitest';
import { parseSave } from '../state/save-format';
import { SAVE_REVISION, migrateSave } from '../state/migrations';
import { SAVE_VERSION, newGame } from '../state/game-state';
import { createRng } from '../core/rng';
import { addItem, createContainer } from '../state/inventory';
import { loadGame, saveGame, setScratchMode } from '../state/persistence';
import { startRun, syncLoadout } from '../systems/run';
import { backpackCapacity } from '../systems/meta';
import { Rarity } from '../types';
import { GameState } from '../state/game-state';
import { makeBlueprint, makeEquipment } from '../systems/items';
import { MATERIALS } from '../data/materials';
import { commoditySellPrice } from '../systems/market';

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
    expect(s.recipeRanks.r_short_sword).toBe(1);
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
    expect(s.market.commodities.sunstone).toEqual({ price: 104, supply: 0, stock: 0, history: [104] });
  });

  it('adds new commodities to a recent save without resetting its market', () => {
    const recent = newGame(createRng(9));
    recent.revision = 9;
    const iron = { ...recent.market.commodities.iron, history: [...recent.market.commodities.iron.history] };
    delete recent.market.commodities.sunstone;
    const loaded = parseSave(JSON.stringify(recent))!;
    expect(loaded.market.commodities.sunstone).toEqual({ price: 104, supply: 0, stock: 0, history: [104] });
    expect(loaded.market.commodities.iron).toEqual(iron);
  });

  it('stacks duplicate blueprints already stored in a save', () => {
    const recent = parseSave(LEGACY)!;
    recent.revision = 10;
    for (const container of [recent.stash, recent.loadout, recent.run!.backpack]) {
      container.items.push(makeBlueprint('r_long_sword'), makeBlueprint('r_long_sword'));
    }

    const loaded = parseSave(JSON.stringify(recent))!;
    for (const container of [loaded.stash, loaded.loadout, loaded.run!.backpack]) {
      const blueprints = container.items.filter((item) => item.kind === 'blueprint' && item.ref === 'r_long_sword');
      expect(blueprints).toHaveLength(1);
      expect(blueprints[0].qty).toBe(2);
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
    expect(s.recipeRanks.r_short_sword).toBe(1);
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

  it('migrates every previously known recipe to rank one', () => {
    const old = JSON.parse(LEGACY);
    old.knownRecipes.push('r_long_sword', 'r_long_sword');
    const s = parseSave(JSON.stringify(old))!;
    expect(s.recipeRanks.r_long_sword).toBe(1);
    expect(s.recipeRanks.r_short_sword).toBe(1);
    expect('knownRecipes' in s).toBe(false);
  });

  it('starts every starter recipe at rank one', () => {
    const s = newGame(createRng(2));
    expect(s.recipeRanks.r_dagger).toBe(1);
    expect(s.recipeRanks.r_short_sword).toBe(1);
    expect(s.recipeRanks.r_long_sword).toBeUndefined();
  });

  it('is idempotent — migrating twice changes nothing', () => {
    const once = parseSave(LEGACY)!;
    const twice = migrateSave(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  /**
   * The bug this pins: a material added to MATERIALS shipped without a
   * commodity row for saves that had already passed revision 10, and the town
   * screen reads `commodities[id].price` for every material the instant it
   * renders. Every save in existence crashed on entering town. A save at the
   * current revision is exactly the case the old backfill did not cover.
   */
  it('gives every material a commodity row, at any revision a save can be at', () => {
    for (const revision of [0, 10, SAVE_REVISION - 1, SAVE_REVISION]) {
      const s = newGame(createRng(3));
      s.revision = revision;
      delete (s.market.commodities as Record<string, unknown>).wardstone;
      const back = migrateSave(JSON.parse(JSON.stringify(s)));
      for (const m of MATERIALS) {
        expect(back.market.commodities[m.id], `${m.id} at revision ${revision}`).toBeDefined();
        expect(commoditySellPrice(back.market, m.id, 0)).toBeGreaterThan(0);
      }
    }
  });

  it('leaves a commodity row the player has already traded exactly as it was', () => {
    const s = newGame(createRng(4));
    s.revision = 0;
    s.market.commodities.iron = { price: 999, supply: 7, stock: 3, history: [1, 2, 999] };
    const back = migrateSave(JSON.parse(JSON.stringify(s)));
    expect(back.market.commodities.iron).toEqual({ price: 999, supply: 7, stock: 3, history: [1, 2, 999] });
  });

  it('round-trips a fresh game', () => {
    const fresh = newGame(createRng(1));
    const back = parseSave(JSON.stringify(fresh))!;
    expect(back.revision).toBe(SAVE_REVISION);
    expect(back.gold).toBe(fresh.gold);
  });
});

describe('shrinking the backpack', () => {
  it('never eats what an old save was already carrying', () => {
    // BASE_BACKPACK went 16 -> 12 in the balance pass. A save written before
    // that has a town loadout sized for the old pack, and the one thing this
    // project never does is lose a player's items.
    const s = newGame(createRng(1));
    s.loadout = createContainer(16);
    // Equipment, not materials: materials of one kind stack into a single slot,
    // which is also most of why the pack stopped filling in the first place.
    for (let i = 0; i < 16; i++) {
      addItem(s.loadout, makeEquipment({ baseId: 'club', materialId: 'timber', rarity: Rarity.Common, ilvl: 1 }));
    }
    const before = s.loadout.items.length + s.stash.items.length;

    syncLoadout(s); // town redraw: capacity snaps down to the new size
    expect(s.loadout.capacity).toBe(backpackCapacity(s.meta));
    expect(s.loadout.items).toHaveLength(16); // nothing dropped on the floor

    startRun(s, 7);
    const after = s.run!.backpack.items.length + s.stash.items.length;
    expect(after).toBe(before);
    expect(s.run!.backpack.items.length).toBeLessThanOrEqual(s.run!.backpack.capacity);
  });
});

describe('scratch mode', () => {
  /** vitest runs without a DOM, and saveGame swallows the missing-storage error. */
  function withStorage<T>(fn: () => T): T {
    const store = new Map<string, string>();
    const g = globalThis as unknown as { localStorage?: unknown };
    const had = 'localStorage' in g;
    const prev = g.localStorage;
    g.localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
    try {
      return fn();
    } finally {
      if (had) g.localStorage = prev;
      else delete g.localStorage;
    }
  }

  it('refuses to write a slot at all', () => withStorage(() => {
    // The dev boss arena hands out endgame gear and maxed renown on a throwaway
    // game. Guarding the call sites was not enough — `beforeunload` wrote
    // straight past it and ate a save — so the lock is on the storage door.
    const s = newGame(createRng(1));
    s.gold = 4242;
    saveGame(s, 1);
    expect(loadGame(1)?.gold).toBe(4242);

    setScratchMode(true);
    try {
      const junk = newGame(createRng(2));
      junk.gold = 999999;
      saveGame(junk, 1);
      expect(loadGame(1)?.gold, 'the real save is untouched').toBe(4242);
    } finally {
      setScratchMode(false);
    }

    const after = newGame(createRng(3));
    after.gold = 77;
    saveGame(after, 1);
    expect(loadGame(1)?.gold, 'and writing works again once it is off').toBe(77);
  }));
});
