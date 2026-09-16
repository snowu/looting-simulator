import { MATERIALS } from '../data/materials';
import { GameState } from '../state/game-state';
import { addItem } from '../state/inventory';
import { makeMaterial } from '../systems/items';

/** Shared by the Lab button and the reusable browser-console script. */
export function giveMaterials(state: GameState, quantity = 99): number {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100000) {
    throw new Error('Choose a whole-number quantity between 1 and 100000.');
  }
  for (const material of MATERIALS) {
    addItem(state.stash, makeMaterial(material.id, quantity));
  }
  return MATERIALS.length;
}
