import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { GameState, newGame } from '../state/game-state';
import { addItem } from '../state/inventory';
import { migrateSave } from '../state/migrations';
import { EnemyState } from '../systems/dungeon';
import { enemyDef, enemyView } from '../data/enemies';
import { SHADE_ID, SHADE_MIN_DISTANCE } from '../systems/grave';
import { endRun, startRun } from '../systems/run';
import { makeEquipment, makeMaterial } from '../systems/items';
import { Rarity } from '../types';
import { World } from '../world/world';

interface Private {
  changeFloor(dir: 'down' | 'up'): void;
  killEnemy(e: EnemyState): void;
}
const priv = (w: World) => w as unknown as Private;

/** Start a delve, carry iron and coin down to `depth`, and die there. */
function dieAt(state: GameState, depth: number, seed: number): void {
  startRun(state, seed);
  const w = new World(state);
  for (let d = 1; d < depth; d++) priv(w).changeFloor('down');
  addItem(state.run!.backpack, makeMaterial('iron', 7));
  state.run!.gold = 40;
  endRun(state, 'dead');
}

describe('dying', () => {
  it('digs a grave on the depth you fell with what you lost', () => {
    const state = newGame(createRng(601));
    state.equipment.weapon = makeEquipment({ baseId: 'mace', materialId: 'iron', rarity: Rarity.Common, ilvl: 2, identified: true });
    dieAt(state, 2, 601);
    expect(state.grave?.depth).toBe(2);
    expect(state.grave?.items.some((i) => i.ref === 'iron' && i.qty === 7)).toBe(true);
    expect(state.grave?.gold).toBe(40);
    expect(state.grave?.damageType).toBe('blunt');
    expect(state.lastRun?.graveDepth).toBe(2);
  });

  it('a second death before reclaiming replaces the grave', () => {
    const state = newGame(createRng(602));
    dieAt(state, 2, 602);
    dieAt(state, 1, 603);
    expect(state.grave?.depth).toBe(1);
  });

  it('coming home leaves the grave where it is', () => {
    const state = newGame(createRng(604));
    dieAt(state, 2, 604);
    startRun(state, 605);
    endRun(state, 'extracted');
    expect(state.grave?.depth).toBe(2);
  });

  it('never on Hardcore', () => {
    const state = newGame(createRng(606));
    state.difficulty = 'hardcore';
    dieAt(state, 1, 606);
    expect(state.grave ?? null).toBeNull();
  });

  it('migrates an older save with no grave', () => {
    const s = newGame(createRng(607)) as unknown as Record<string, unknown>;
    delete s.grave;
    s.revision = 26;
    migrateSave(s as never);
    expect(s.grave).toBeNull();
  });
});

describe('the Shade', () => {
  it('waits on the grave\'s depth, far from the stair, once per delve', () => {
    const state = newGame(createRng(608));
    dieAt(state, 3, 608);
    startRun(state, 609);
    const w = new World(state);
    expect(w.floor.enemies.some((e) => e.def === SHADE_ID)).toBe(false);
    priv(w).changeFloor('down');
    priv(w).changeFloor('down');
    const shades = w.floor.enemies.filter((e) => e.def === SHADE_ID);
    expect(shades).toHaveLength(1);
    const up = w.floor.stairs.find((s) => !s.down)!;
    expect(Math.abs(shades[0].x - up.x) + Math.abs(shades[0].y - up.y)).toBeGreaterThanOrEqual(SHADE_MIN_DISTANCE);
    expect(w.run.shadePlaced).toBe(true);
  });

  it('on depth 1, is there from the start', () => {
    const state = newGame(createRng(610));
    dieAt(state, 1, 610);
    startRun(state, 611);
    expect(state.run!.floors[0]!.enemies.filter((e) => e.def === SHADE_ID)).toHaveLength(1);
    expect(state.run!.shadePlaced).toBe(true);
  });

  it('strikes with your weapon\'s damage type', () => {
    const view = enemyView(enemyDef(SHADE_ID), 10, 10, { shadeType: 'pierce' });
    expect(view.damageType).toBe('pierce');
  });

  it('killing it gives back the whole pack and clears the grave', () => {
    const state = newGame(createRng(612));
    dieAt(state, 1, 612);
    startRun(state, 613);
    const w = new World(state);
    const shade = w.floor.enemies.find((e) => e.def === SHADE_ID)!;
    priv(w).killEnemy(shade);
    expect(state.grave).toBeNull();
    const pile = w.floor.pickups.find((p) => p.x === shade.x && p.y === shade.y)!;
    expect(pile.items.some((i) => i.ref === 'iron' && i.qty === 7)).toBe(true);
    expect(pile.gold).toBeGreaterThanOrEqual(40);
  });
});
