import { EquipSlot, EQUIP_SLOTS, Item, slotOf } from '../types';
import { itemBase } from '../data/items';
import { Container, addItem, canFit, findItem, removeItem } from '../state/inventory';
import { Equipment } from './player';

/** The slot an item goes into by default (rings fill the first free ring slot). */
export function defaultSlot(item: Item, eq: Equipment): EquipSlot | null {
  if (item.kind !== 'equipment') return null;
  const slot = itemBase(item.ref).slot;
  if (slot === 'ring') return !eq.ring1 ? 'ring1' : !eq.ring2 ? 'ring2' : 'ring1';
  return EQUIP_SLOTS.find((s) => slotOf(s) === slot) ?? null;
}

/** Equip an item from a container, swapping any current item back into it. Returns an error or null. */
export function equipFrom(eq: Equipment, c: Container, uid: string, slot?: EquipSlot): string | null {
  const item = findItem(c, uid);
  if (!item || item.kind !== 'equipment') return 'That can\'t be equipped.';
  // Diablo rule: an unidentified item cannot be worn at all. Identify it first.
  if (item.identified === false) return 'Unidentified — use a Scroll of Identify or see the appraiser first.';
  const target = slot ?? defaultSlot(item, eq);
  if (!target || slotOf(target) !== itemBase(item.ref).slot) return 'Wrong slot.';
  removeItem(c, uid);
  const prev = eq[target];
  eq[target] = item;
  if (prev) addItem(c, prev);
  return null;
}

export function unequipTo(eq: Equipment, slot: EquipSlot, c: Container): string | null {
  const item = eq[slot];
  if (!item) return null;
  if (!canFit(c, item)) return 'No room in your pack.';
  addItem(c, item);
  eq[slot] = null;
  return null;
}
