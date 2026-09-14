import { describe, it, expect } from 'vitest';
import { healCostFor, quoteHeal, wornGearValue } from '../systems/heal';
import { emptyEquipment } from '../systems/player';
import { makeEquipment } from '../systems/items';
import { Rarity } from '../types';

describe('physicker pricing', () => {
  it('scales with max health', () => {
    const low = healCostFor({ maxHp: 70, gearValue: 0, cursed: false, depth: 1 });
    const high = healCostFor({ maxHp: 135, gearValue: 0, cursed: false, depth: 1 });
    expect(high).toBeGreaterThan(low);
  });

  it('scales with gear value', () => {
    const naked = healCostFor({ maxHp: 70, gearValue: 0, cursed: false, depth: 1 });
    const geared = healCostFor({ maxHp: 70, gearValue: 2000, cursed: false, depth: 1 });
    expect(geared).toBeGreaterThan(naked);
  });

  it('charges more when cursed (x1.5)', () => {
    const clean = healCostFor({ maxHp: 100, gearValue: 500, cursed: false, depth: 3 });
    const cursed = healCostFor({ maxHp: 100, gearValue: 500, cursed: true, depth: 3 });
    // Ceilings on each side can differ by a coin; the ratio is what matters.
    expect(cursed / clean).toBeCloseTo(1.5, 1);
  });

  it('charges more the deeper you are', () => {
    const shallow = healCostFor({ maxHp: 100, gearValue: 500, cursed: false, depth: 1 });
    const deep = healCostFor({ maxHp: 100, gearValue: 500, cursed: false, depth: 6 });
    expect(deep).toBeGreaterThan(shallow);
  });

  it('lands in the documented bands', () => {
    // Early: ~60–120g. Late uncursed (~6000 worn value): 500–800g.
    // Cursed late: ~50% more again.
    const early = healCostFor({ maxHp: 70, gearValue: 150, cursed: false, depth: 1 });
    expect(early).toBeGreaterThanOrEqual(60);
    expect(early).toBeLessThanOrEqual(130);
    const late = healCostFor({ maxHp: 135, gearValue: 6000, cursed: false, depth: 6 });
    expect(late).toBeGreaterThan(500);
    expect(late).toBeLessThanOrEqual(800);
    const cursedLate = healCostFor({ maxHp: 135, gearValue: 6000, cursed: true, depth: 6 });
    expect(cursedLate / late).toBeCloseTo(1.5, 1);
  });

  it('quotes missing HP from real equipment', () => {
    const eq = emptyEquipment();
    eq.weapon = makeEquipment({ baseId: 'long_sword', materialId: 'iron', rarity: Rarity.Common, ilvl: 4, quality: 1 });
    expect(wornGearValue(eq)).toBeGreaterThan(0);
    const q = quoteHeal({ equipment: eq, maxHp: 100, hp: 40, cursed: false, depth: 2 });
    expect(q.missing).toBe(60);
    expect(q.cost).toBe(healCostFor({ maxHp: 100, gearValue: wornGearValue(eq), cursed: false, depth: 2 }));
    const whole = quoteHeal({ equipment: eq, maxHp: 100, hp: 100, cursed: false, depth: 2 });
    expect(whole.missing).toBe(0);
  });
});
