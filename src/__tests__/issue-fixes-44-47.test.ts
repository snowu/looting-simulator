import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { affix } from '../data/affixes';
import { addItem, createContainer } from '../state/inventory';
import { newGame } from '../state/game-state';
import { migrateSave } from '../state/migrations';
import { itemStats, makeEquipment, rollEquipment } from '../systems/items';
import { advanceDay, commodityTrend, createMarket, eventStockTarget, materialStockTarget } from '../systems/market';
import { derivePlayer, emptyEquipment, thrownView } from '../systems/player';
import { material } from '../data/materials';
import { Rarity, RARITY_ORDER } from '../types';

const BELTS = ['throwing_knives', 'throwing_axes', 'javelins'];

// #47: "epic but same stats as base green". No affix named the thrown slot,
// so every belt rolled none and rarity changed nothing but the name's colour.
describe('thrown belts roll affixes (#47)', () => {
  it('rolls as many affixes as its rarity promises, at every depth', () => {
    for (const baseId of BELTS) {
      for (let depth = 2; depth <= 6; depth++) {
        for (const rarity of [Rarity.Uncommon, Rarity.Rare, Rarity.Epic]) {
          for (let seed = 0; seed < 40; seed++) {
            const it = rollEquipment(createRng(seed * 31 + depth), depth, 0, { baseId, rarity, identifyBelow: Rarity.Legendary });
            expect(it.affixes?.length, `${rarity} ${baseId} at depth ${depth}`).toBe(RARITY_ORDER[rarity]);
          }
        }
      }
    }
  });

  it('only rolls what a throw can use', () => {
    for (let seed = 0; seed < 300; seed++) {
      const it = rollEquipment(createRng(seed), 6, 0, { baseId: 'javelins', rarity: Rarity.Epic, identifyBelow: Rarity.Legendary });
      for (const a of it.affixes ?? []) expect(['attack', 'fire', 'frost', 'shadow', 'holy', 'leech']).toContain(affix(a.id).stat);
    }
  });

  it('an Epic belt throws harder than the same belt in green', () => {
    const belt = (rarity: Rarity, affixes: { id: string; value: number }[]) =>
      makeEquipment({ baseId: 'javelins', materialId: 'iron', rarity, ilvl: 8, quality: 1, affixes, identified: true });
    const green = derivePlayer({ ...emptyEquipment(), thrown: belt(Rarity.Uncommon, [{ id: 'sharp', value: 4 }]) }, {});
    const epic = derivePlayer({ ...emptyEquipment(), thrown: belt(Rarity.Epic, [{ id: 'brutal', value: 12 }, { id: 'blazing', value: 8 }, { id: 'leeching', value: 3 }]) }, {});
    expect(epic.thrownAttack).toBeGreaterThan(green.thrownAttack);
    const throwing = thrownView(epic);
    expect(throwing.stats.fire).toBe(8);
    expect(throwing.stats.leech).toBe(3);
    // The belt is ammunition: none of it reaches you or your sword.
    expect(epic.stats.fire).toBe(0);
    expect(epic.stats.leech).toBe(0);
    expect(epic.attack).toBe(green.attack);
  });

  it('migrates belts already found, once and the same way every time', () => {
    const save = () => {
      const s = newGame(createRng(1));
      s.revision = 31;
      const stale = makeEquipment({ baseId: 'throwing_axes', materialId: 'iron', rarity: Rarity.Epic, ilvl: 8, identified: true });
      stale.uid = 'belt-1';
      stale.affixes = [];
      const common = makeEquipment({ baseId: 'throwing_knives', materialId: 'iron', rarity: Rarity.Common, ilvl: 4, identified: true });
      s.stash = createContainer(40);
      addItem(s.stash, stale);
      addItem(s.stash, common);
      s.equipment.thrown = makeEquipment({ baseId: 'javelins', materialId: 'iron', rarity: Rarity.Rare, ilvl: 8, identified: true });
      s.equipment.thrown.affixes = [{ id: 'sharp', value: 5 }];
      return s;
    };
    const a = migrateSave(save());
    const b = migrateSave(save());
    const axes = a.stash.items.find((i) => i.uid === 'belt-1')!;
    expect(axes.affixes).toHaveLength(3);
    expect(b.stash.items.find((i) => i.uid === 'belt-1')!.affixes).toEqual(axes.affixes);
    expect(a.stash.items.find((i) => i.ref === 'throwing_knives')!.affixes ?? []).toHaveLength(0);
    // A partly filled belt keeps what it had and is topped up.
    expect(a.equipment.thrown!.affixes![0]).toEqual({ id: 'sharp', value: 5 });
    expect(a.equipment.thrown!.affixes).toHaveLength(2);
    expect(new Set(a.equipment.thrown!.affixes!.map((x) => affix(x.id).stat)).size).toBe(2);
    expect(itemStats(axes).attack).toBeGreaterThan(0);
  });
});

// #44: "iron shortage but market goes down", and the merchant still had a
// full shelf of low-tier metal.
describe('market events move price, trend and stock together (#44)', () => {
  function shortageDays(seeds: number) {
    const out: { m: ReturnType<typeof createMarket>; prev: number; day: number }[] = [];
    for (let seed = 1; seed <= seeds; seed++) {
      const rng = createRng(seed);
      const m = createMarket(rng);
      for (let d = 0; d < 60; d++) {
        const prev = m.commodities.iron.price;
        advanceDay(m, rng, 3);
        const ev = m.events.find((e) => e.id === 'iron_shortage');
        if (ev) out.push({ m: structuredClone(m), prev, day: m.day - (ev.started ?? m.day) });
      }
    }
    return out;
  }

  it('a shortage never turns a price down while it is still climbing to its level', () => {
    for (const { m, prev } of shortageDays(120)) {
      const fair = material('iron').value * 1.5;
      if (prev < fair * 0.9 && !m.events.some((e) => e.id !== 'iron_shortage')) expect(m.commodities.iron.price).toBeGreaterThanOrEqual(prev);
    }
  });

  it('the trend arrow under a shortage is almost never red', () => {
    const days = shortageDays(200);
    const red = days.filter(({ m }) => commodityTrend(m, 'iron') < -2).length;
    expect(red / days.length).toBeLessThan(0.01);
  });

  it('a shortage thins the shelf, and a glut fills it', () => {
    expect(eventStockTarget(40, 1.5)).toBe(18);
    expect(eventStockTarget(14, 0.55)).toBe(46);
    expect(eventStockTarget(40, 1)).toBe(40);
    const days = shortageDays(80);
    const base = materialStockTarget(material('iron'));
    for (const { m } of days) expect(m.commodities.iron.stock).toBeLessThanOrEqual(eventStockTarget(base, 1.5));
  });
});
