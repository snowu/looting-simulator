import { Item, ItemKind, RARITY_ORDER } from '../types';
import { consumable } from '../data/items';
import { itemName, itemRarity, newUid } from '../systems/items';

/** A slot-limited bag (backpack) or an unlimited one (stash, capacity <= 0). */
export interface Container {
  capacity: number;
  items: Item[];
}

export const MATERIAL_STACK = 20;

export function createContainer(capacity = 0): Container {
  return { capacity, items: [] };
}

export function isUnlimited(c: Container): boolean {
  return c.capacity <= 0;
}

export function stackLimit(item: Item, c?: Container): number {
  if (item.kind === 'equipment') return 1;
  if (c && isUnlimited(c)) return Infinity;
  if (item.kind === 'material' || item.kind === 'blueprint') return MATERIAL_STACK;
  if (item.kind === 'lore') return 1;
  return consumable(item.ref).stack;
}

function stacksWith(a: Item, b: Item): boolean {
  return a.kind === b.kind && a.ref === b.ref && (a.kind === 'material' || a.kind === 'consumable' || a.kind === 'blueprint');
}

export function freeSlots(c: Container): number {
  return isUnlimited(c) ? Infinity : Math.max(0, c.capacity - c.items.length);
}

/** How many units of `item` would fit right now. */
export function roomFor(c: Container, item: Item): number {
  const limit = stackLimit(item, c);
  if (limit === Infinity) return Infinity;
  let room = 0;
  if (limit > 1) {
    for (const s of c.items) if (stacksWith(s, item)) room += Math.max(0, limit - s.qty);
  }
  return room + freeSlots(c) * limit;
}

export function canFit(c: Container, item: Item): boolean {
  return roomFor(c, item) >= item.qty;
}

/**
 * Add as much of `item` as fits, merging into existing stacks first.
 * Returns the quantity that did NOT fit (0 = everything was added).
 */
export function addItem(c: Container, item: Item): number {
  let remaining = item.qty;
  const limit = stackLimit(item, c);
  if (limit > 1) {
    for (const s of c.items) {
      if (remaining <= 0) break;
      if (!stacksWith(s, item)) continue;
      const n = Math.min(limit - s.qty, remaining);
      if (n <= 0) continue;
      s.qty += n;
      remaining -= n;
    }
  }
  let first = true;
  while (remaining > 0) {
    if (!isUnlimited(c) && c.items.length >= c.capacity) break;
    const n = Math.min(limit, remaining);
    // Keep the original uid for the first new stack (equipment identity).
    c.items.push({ ...item, qty: n, uid: first && remaining === item.qty ? item.uid : newUid() });
    first = false;
    remaining -= n;
  }
  return remaining;
}

export function findItem(c: Container, uid: string): Item | undefined {
  return c.items.find((i) => i.uid === uid);
}

export function removeItem(c: Container, uid: string): Item | null {
  const i = c.items.findIndex((it) => it.uid === uid);
  if (i < 0) return null;
  return c.items.splice(i, 1)[0];
}

/** Remove `qty` units from the stack `uid`, returning them as a new item. */
export function takeQty(c: Container, uid: string, qty: number): Item | null {
  const it = findItem(c, uid);
  if (!it || qty <= 0) return null;
  if (qty >= it.qty) return removeItem(c, uid);
  it.qty -= qty;
  return { ...it, qty, uid: newUid() };
}

export function countOf(c: Container, kind: ItemKind, ref: string): number {
  let n = 0;
  for (const it of c.items) if (it.kind === kind && it.ref === ref) n += it.qty;
  return n;
}

/** Remove `qty` units across stacks. All-or-nothing; returns false if short. */
export function removeOf(c: Container, kind: ItemKind, ref: string, qty: number): boolean {
  if (countOf(c, kind, ref) < qty) return false;
  let left = qty;
  // Drain the smallest stacks first so the bag stays tidy.
  const stacks = c.items.filter((it) => it.kind === kind && it.ref === ref).sort((a, b) => a.qty - b.qty);
  for (const s of stacks) {
    if (left <= 0) break;
    const n = Math.min(s.qty, left);
    s.qty -= n;
    left -= n;
  }
  c.items = c.items.filter((it) => it.qty > 0);
  return true;
}

const KIND_ORDER: Record<ItemKind, number> = { equipment: 0, consumable: 1, blueprint: 2, lore: 3, material: 4 };

export function sortContainer(c: Container): void {
  c.items.sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      RARITY_ORDER[itemRarity(b)] - RARITY_ORDER[itemRarity(a)] ||
      itemName(a).localeCompare(itemName(b)),
  );
}
