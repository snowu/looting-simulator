import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { newGame } from '../state/game-state';
import { bankCarriedGold, endRun, startRun, syncLoadout } from '../systems/run';
import { World } from '../world/world';
import { FLOOR, createEnemy } from '../systems/dungeon';
import { BOSS_ID, enemyDef } from '../data/enemies';
import { addItem } from '../state/inventory';
import { makeConsumable, makeEquipment, makeMaterial } from '../systems/items';
import { Rarity } from '../types';

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
  for (let y = 2; y < f.height - 6; y++) for (let x = 2; x < f.width - 6; x++) {
    for (const d of DIRS) {
      let ok = free(x, y) && free(x - DX[d], y - DY[d]);
      for (let k = 1; k <= 4 && ok; k++) ok = free(x + DX[d] * k, y + DY[d] * k);
      if (ok) {
        Object.assign(w.player, { x, y, facing: d });
        Object.assign(w.anim, { fromX: x, fromY: y, yaw: (d * Math.PI) / 2, yawTo: (d * Math.PI) / 2 });
        return w;
      }
    }
  }
  throw new Error('no arena');
}

describe('the boss hoard', () => {
  it('does not land under the portal it opens', () => {
    const w = arena(5);
    const t = w.frontTile(1);
    const boss = createEnemy(enemyDef(BOSS_ID), t.x, t.y, turnAround(w.player.facing), 'king', 6);
    w.floor.enemies.push(boss);
    (w as unknown as { killEnemy(e: typeof boss): void }).killEnemy(boss);

    const portal = w.floor.props.find((p) => p.kind === 'portal')!;
    expect(portal).toBeTruthy();
    const hoard = w.floor.pickups.filter((p) => p.items.length || p.gold > 0);
    expect(hoard.length).toBeGreaterThan(0);
    for (const pile of hoard) expect(pile.x === portal.x && pile.y === portal.y).toBe(false);
  });

  it('drops the hoard somewhere you can walk to', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const w = arena(seed);
      const t = w.frontTile(1);
      const boss = createEnemy(enemyDef(BOSS_ID), t.x, t.y, turnAround(w.player.facing), 'king', 6);
      w.floor.enemies.push(boss);
      (w as unknown as { killEnemy(e: typeof boss): void }).killEnemy(boss);
      for (const pile of w.floor.pickups.filter((p) => p.items.length)) {
        expect(w.floor.tiles[pile.y * w.floor.width + pile.x]).toBe(FLOOR);
      }
    }
  });

  it('still lets you loot a pile that shares the portal tile', () => {
    // Covers saves where the hoard is already stuck under a portal.
    const w = arena(7);
    const t = w.frontTile(1);
    w.floor.props.push({ id: 'p_old', kind: 'portal', x: t.x, y: t.y, used: false, tier: 'none', blocking: false });
    w.floor.pickups.push({ id: 'stuck', x: t.x, y: t.y, items: [makeMaterial('star_iron', 1)], gold: 0 });
    expect(w.interactionHint()).toBe('Search');
  });
});

describe('the town portal', () => {
  function openPortal(w: World): void {
    addItem(w.run.backpack, makeConsumable('scroll_recall', 1));
    const scroll = w.run.backpack.items.find((i) => i.ref === 'scroll_recall')!;
    w.use(scroll.uid);
    tick(w, 6);
  }

  it('opens a portal instead of ending the run', () => {
    const w = arena(11);
    openPortal(w);
    expect(w.run.outcome).toBe('active');
    expect(w.run.portal).toBeTruthy();
    expect(w.floor.props.some((p) => p.kind === 'town_portal')).toBe(true);
  });

  it('remembers the depth it was opened on', () => {
    const w = arena(12);
    w.changeFloorForTest('down');
    openPortal(w);
    expect(w.run.portal!.depth).toBe(2);
  });

  it('offers the way home when you face it', () => {
    const w = arena(13);
    openPortal(w);
    const p = w.floor.props.find((q) => q.kind === 'town_portal')!;
    Object.assign(w.player, { x: p.x, y: p.y });
    expect(w.interactionHint()).toBe('Step through to Hollowmere');
  });

  it('collapses when you come back through, and only once', () => {
    const w = arena(14);
    openPortal(w);
    const depth = w.run.portal!.depth;
    w.closeTownPortal();
    expect(w.run.portal).toBeNull();
    expect(w.run.floors[depth - 1]!.props.some((p) => p.kind === 'town_portal')).toBe(false);
    // Closing again is harmless.
    w.closeTownPortal();
    expect(w.run.portal).toBeNull();
  });

  it('keeps only one portal open', () => {
    const w = arena(15);
    openPortal(w);
    const first = { ...w.run.portal! };
    w.press('forward');
    w.release('forward');
    tick(w, 0.5);
    openPortal(w);
    const all = w.run.floors.flatMap((f) => f?.props.filter((p) => p.kind === 'town_portal') ?? []);
    expect(all.length).toBe(1);
    expect(w.run.portal).not.toEqual(first);
  });

  it('does not open on top of the boss portal', () => {
    const w = arena(16);
    const here = { x: w.player.x, y: w.player.y };
    w.floor.props.push({ id: 'boss_p', kind: 'portal', x: here.x, y: here.y, used: false, tier: 'none', blocking: false });
    openPortal(w);
    const town = w.floor.props.find((p) => p.kind === 'town_portal')!;
    expect(town.x === here.x && town.y === here.y).toBe(false);
  });
});

describe('banking on a portal trip', () => {
  it('moves carried coin into the town purse', () => {
    const state = newGame(createRng(21));
    startRun(state, 21);
    state.run!.gold = 340;
    const purse = state.gold;
    expect(bankCarriedGold(state)).toBe(340);
    expect(state.gold).toBe(purse + 340);
    expect(state.run!.gold).toBe(0);
  });

  it('is a no-op with an empty purse or no run', () => {
    const state = newGame(createRng(22));
    expect(bankCarriedGold(state)).toBe(0);
    startRun(state, 22);
    expect(bankCarriedGold(state)).toBe(0);
  });

  it('does not pay out twice when the run later ends', () => {
    const state = newGame(createRng(23));
    startRun(state, 23);
    state.run!.gold = 200;
    bankCarriedGold(state);
    const purse = state.gold;
    endRun(state, 'extracted');
    expect(state.gold).toBe(purse);
  });
});

describe('packing for a delve', () => {
  it('carries the loadout down as the backpack', () => {
    const state = newGame(createRng(3));
    const pack = syncLoadout(state);
    addItem(pack, makeConsumable('healing_draught', 3));
    addItem(pack, makeConsumable('scroll_recall', 1));
    startRun(state, 3);
    const carried = state.run!.backpack.items;
    expect(carried.some((i) => i.ref === 'healing_draught')).toBe(true);
    expect(carried.some((i) => i.ref === 'scroll_recall')).toBe(true);
    // The loadout is emptied, not duplicated.
    expect(state.loadout.items.length).toBe(0);
  });

  it('grows with Pack Mule', () => {
    const state = newGame(createRng(3));
    const before = syncLoadout(state).capacity;
    state.meta.pack_mule = 2;
    expect(syncLoadout(state).capacity).toBe(before + 8);
  });

  it('sends anything that no longer fits back to the stash', () => {
    const state = newGame(createRng(4));
    const pack = syncLoadout(state);
    for (let i = 0; i < pack.capacity; i++) {
      addItem(pack, makeEquipment({ baseId: 'dagger', materialId: 'copper', rarity: Rarity.Common, ilvl: 1, quality: 1 }));
    }
    const overflow = pack.items.length;
    state.meta.supply_crate = 1; // takes a slot in the new backpack
    const stashBefore = state.stash.items.length;
    startRun(state, 4);
    expect(state.run!.backpack.items.length).toBeLessThanOrEqual(state.run!.backpack.capacity);
    expect(state.stash.items.length).toBeGreaterThan(stashBefore);
    expect(state.loadout.items.length).toBe(0);
    expect(overflow).toBeGreaterThan(0);
  });
});
