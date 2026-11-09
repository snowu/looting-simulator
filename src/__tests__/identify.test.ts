import { describe, it, expect } from 'vitest';
import { World } from '../world/world';
import { addItem, createContainer, findItem } from '../state/inventory';
import { equipFrom } from '../systems/equip';
import { emptyEquipment } from '../systems/player';
import { identify, itemStats, makeConsumable, makeEquipment } from '../systems/items';
import { Rarity } from '../types';
import { room } from './harness';

const arena = (seed = 77): World => room({ seed });

function unidSword() {
  return makeEquipment({ baseId: 'long_sword', materialId: 'iron', rarity: Rarity.Rare, ilvl: 4, affixes: [{ id: 'sharp', value: 4 }], identified: false });
}

describe('unidentified gear is unusable', () => {
  it('grants no stats until identified', () => {
    const it = unidSword();
    expect(Object.values(itemStats(it)).every((v) => v === 0)).toBe(true);
    identify(it);
    expect(itemStats(it).attack).toBeGreaterThan(0);
  });

  it('cannot be equipped until identified', () => {
    const eq = emptyEquipment();
    const pack = createContainer(10);
    const it = unidSword();
    addItem(pack, it);
    const stored = findItem(pack, it.uid)!;
    expect(equipFrom(eq, pack, it.uid)).toMatch(/nidentified/i);
    expect(eq.weapon).toBeNull();
    expect(findItem(pack, it.uid)).toBe(stored);
    identify(stored);
    expect(equipFrom(eq, pack, it.uid)).toBeNull();
    expect(eq.weapon).toBe(stored);
  });
});

describe('scroll of identify chooses its target', () => {
  /** Uid of the scroll stack in the pack (stacks merge, so resolve it there). */
  function scrollUid(w: World): string {
    const found = w.run.backpack.items.find((i) => i.kind === 'consumable' && i.ref === 'scroll_identify');
    if (!found) throw new Error('no scroll in pack');
    return found.uid;
  }

  it('identifies the named item and leaves the rest unknown', () => {
    const w = arena();
    const first = unidSword();
    const second = unidSword();
    addItem(w.run.backpack, first);
    addItem(w.run.backpack, second);
    addItem(w.run.backpack, makeConsumable('scroll_identify'));
    const storedFirst = findItem(w.run.backpack, first.uid)!;
    const storedSecond = findItem(w.run.backpack, second.uid)!;
    const sid = scrollUid(w);
    const before = findItem(w.run.backpack, sid)!.qty;
    w.use(sid, second.uid);
    expect(storedSecond.identified).toBe(true);
    expect(storedFirst.identified).toBe(false);
    expect(findItem(w.run.backpack, sid)?.qty ?? 0).toBeLessThan(before);
  });

  it('does not consume the scroll when there is nothing — or no valid target — to identify', () => {
    const w = arena();
    addItem(w.run.backpack, makeConsumable('scroll_identify'));
    const stocked = w.run.backpack.items.filter((i) => i.kind === 'consumable' && i.ref === 'scroll_identify')
      .reduce((n, i) => n + i.qty, 0);
    w.use(scrollUid(w));
    expect(
      w.run.backpack.items.filter((i) => i.kind === 'consumable' && i.ref === 'scroll_identify')
        .reduce((n, i) => n + i.qty, 0),
    ).toBe(stocked);

    const sword = unidSword();
    addItem(w.run.backpack, sword);
    w.use(scrollUid(w), 'no-such-item');
    expect(findItem(w.run.backpack, sword.uid)!.identified).toBe(false);
    expect(
      w.run.backpack.items.filter((i) => i.kind === 'consumable' && i.ref === 'scroll_identify')
        .reduce((n, i) => n + i.qty, 0),
    ).toBe(stocked);
  });
});
