import { GameState } from '../state/game-state';
import { findItem } from '../state/inventory';
import { EQUIP_SLOTS, Item } from '../types';
import { itemBase } from '../data/items';
import { INSCRIBE_COST, PROPERTY_IDS, PropertyId, findProperty } from '../data/properties';
import { uniqueOf } from './items';

/** Learn a property. Returns false if it was already known or does not exist. */
export function learnProperty(state: GameState, id: string): boolean {
  if (!findProperty(id)) return false;
  state.properties ??= [];
  if (state.properties.includes(id)) return false;
  state.properties.push(id);
  return true;
}

/** Properties not yet learned, in their fixed order. */
export function unlearnedProperties(state: GameState): PropertyId[] {
  const known = state.properties ?? [];
  return PROPERTY_IDS.filter((id) => !known.includes(id));
}

/** Can this item carry this property at all? Gear of a fitting slot, identified, and not a relic. */
export function canCarry(item: Item | null | undefined, id: string): boolean {
  const def = findProperty(id);
  if (!def || !item || item.kind !== 'equipment' || item.identified === false || uniqueOf(item)) return false;
  return def.slots.includes(itemBase(item.ref).slot);
}

/** Every item in town that could take `id`: worn gear first, then the stash. */
export function inscribeTargets(state: GameState, id: string): Item[] {
  const worn = EQUIP_SLOTS.map((slot) => state.equipment[slot]).filter((it): it is Item => canCarry(it, id));
  const stash = state.stash.items.filter((it) => canCarry(it, id));
  return [...worn, ...stash];
}

export type InscribeResult = 'ok' | 'unknown' | 'unfit' | 'already' | 'gold' | 'missing';

/**
 * Inscribe a learned property onto an item, worn or in the stash, for
 * `INSCRIBE_COST` gold. Replaces whatever property the item had.
 */
export function inscribe(state: GameState, uid: string, id: string): InscribeResult {
  if (!(state.properties ?? []).includes(id)) return 'unknown';
  const item = EQUIP_SLOTS.map((slot) => state.equipment[slot]).find((it) => it?.uid === uid) ?? findItem(state.stash, uid);
  if (!item) return 'missing';
  if (!canCarry(item, id)) return 'unfit';
  if (item.property === id) return 'already';
  if (state.gold < INSCRIBE_COST) return 'gold';
  state.gold -= INSCRIBE_COST;
  item.property = id;
  return 'ok';
}
