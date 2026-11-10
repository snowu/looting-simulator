import { describe, it, expect } from 'vitest';
import { addItem } from '../state/inventory';
import { makeConsumable } from '../systems/items';
import { invariants } from '../../scripts/invariants';
import { formatFuzz, fuzz } from '../../scripts/fuzz';
import { room, spawnAt } from './harness';

describe('simulation fuzzer', () => {
  it('flags health that is not a whole number, and an item in two places', () => {
    const w = room();
    expect(invariants(w, { items: true })).toEqual([]);
    w.player.hp = 10.5;
    const draught = makeConsumable('healing_draught', 1);
    addItem(w.run.backpack, draught);
    w.floor.pickups.push({ id: 'dup', x: w.player.x, y: w.player.y, items: [draught], gold: 0 });
    expect(invariants(w, { items: true }).map((v) => v.key)).toEqual(['player hp not whole', 'one item in two places']);
  });

  it('flags two monsters on one tile and a flask past its charges', () => {
    const w = room();
    spawnAt(w, 'rat', w.player.x, w.player.y - 2);
    spawnAt(w, 'rat', w.player.x, w.player.y - 2);
    w.run.flask.charges = 99;
    const keys = invariants(w).map((v) => v.key);
    expect(keys).toContain('two monsters on one tile');
    expect(keys).toContain('flask charges out of range');
  });

  it('plays a delve per profile with random inputs and breaks nothing', () => {
    const report = fuzz({ seeds: 1, chaos: [0.05], itemEvery: 60 });
    expect(report.runs).toBe(3);
    expect(report.ticks).toBeGreaterThan(20_000);
    expect(report.crashes, formatFuzz(report)).toEqual([]);
    expect(report.findings, formatFuzz(report)).toEqual([]);
  }, 120_000);
});
