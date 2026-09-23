import { EquipSlot, EQUIP_SLOTS, Item, slotOf } from '../types';
import { itemBase } from '../data/items';
import { Container, addItem, canFit, findItem, isUnlimited, removeItem } from '../state/inventory';
import { isTwoHanded } from './items';
import { Equipment } from './player';

/** The slot an item goes into by default (rings fill the first free ring slot). */
export function defaultSlot(item: Item, eq: Equipment): EquipSlot | null {
  if (item.kind !== 'equipment') return null;
  const slot = itemBase(item.ref).slot;
  if (slot === 'ring') return !eq.ring1 ? 'ring1' : !eq.ring2 ? 'ring2' : 'ring1';
  return EQUIP_SLOTS.find((s) => slotOf(s) === slot) ?? null;
}

/** What equipping an item would replace — the piece to compare it against. */
export function wornFor(item: Item, eq: Equipment): Item | null {
  const slot = defaultSlot(item, eq);
  return slot ? eq[slot] : null;
}

/**
 * The other piece a two-hander conflicts with, or null when there is no clash.
 *
 * Both directions live here rather than in the two screens that equip things,
 * because the town stash (`ui/town.ts`) and the dungeon pack (`ui/dungeon-ui.ts`)
 * both go through `equipFrom` and neither should have to know the rule.
 */
export function twoHandedConflict(eq: Equipment, item: Item, target: EquipSlot): Item | null {
  if (target === 'weapon') return isTwoHanded(item) ? eq.offhand : null;
  if (target === 'offhand') return isTwoHanded(eq.weapon) ? eq.weapon : null;
  return null;
}

/** Equip an item from a container, swapping any current item back into it. Returns an error or null. */
export function equipFrom(eq: Equipment, c: Container, uid: string, slot?: EquipSlot): string | null {
  const item = findItem(c, uid);
  if (!item || item.kind !== 'equipment') return 'That can\'t be equipped.';
  // Diablo rule: an unidentified item cannot be worn at all. Identify it first.
  if (item.identified === false) return 'Unidentified — use a Scroll of Identify or see the appraiser first.';
  const target = slot ?? defaultSlot(item, eq);
  if (!target || slotOf(target) !== itemBase(item.ref).slot) return 'Wrong slot.';
  // A two-hander and an offhand cannot both be worn, so equipping either one
  // sends the other back to the container the new piece came from. The room has
  // to be checked before anything moves, because `addItem` silently discards
  // what does not fit — an overflowing pack would eat the tower shield rather
  // than refuse the maul, and that is somebody's gear gone.
  //
  // The arithmetic: the new piece leaves the container (−1), whatever was in
  // the target slot comes back (+1 if there was one), and the displaced piece
  // comes back (+1). So the container must end at `n + (prev ? 1 : 0)` slots.
  const displaced = twoHandedConflict(eq, item, target);
  const prev = eq[target];
  if (displaced && !isUnlimited(c) && c.items.length + (prev ? 1 : 0) > c.capacity) {
    return target === 'weapon'
      ? 'Both hands are needed for that, and there is no room to stow your offhand.'
      : 'Your weapon needs both hands, and there is no room to stow it.';
  }
  removeItem(c, uid);
  eq[target] = item;
  if (prev) addItem(c, prev);
  if (displaced) {
    eq[target === 'weapon' ? 'offhand' : 'weapon'] = null;
    addItem(c, displaced);
  }
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
