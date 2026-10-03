import { CONSUMABLES, ITEM_BASES } from '../data/items';
import { MATERIALS } from '../data/materials';
import { UNIQUES } from '../data/uniques';
import { createRng } from '../core/rng';
import { GameState } from '../state/game-state';
import { addItem } from '../state/inventory';
import { findRelic, nameRelic } from '../systems/relics';
import { makeConsumable, makeEquipment, makeUnique } from '../systems/items';
import { Rarity } from '../types';

const GEAR_ILVL = 16;

/** The highest-tier material a base can be made of, as the combat lab picks it. */
function bestMaterialFor(baseId: string): string {
  const base = ITEM_BASES.find((b) => b.id === baseId);
  const mat = base && MATERIALS
    .filter((m) => (base.primary as string[]).includes(m.category))
    .sort((a, b) => b.tier - a.tier || b.value - a.value)[0];
  return mat?.id ?? 'iron';
}

export interface GiveItemsResult {
  relics: number;
  gear: number;
  consumables: number;
}

/**
 * Put every relic, every gear base and every consumable in the stash, and
 * record the relics as found and named so the codex shows them too. The stash
 * is unlimited, so it all fits. Shared by the reusable browser-console script.
 */
export function giveItems(state: GameState, consumableQty = 10): GiveItemsResult {
  if (!Number.isSafeInteger(consumableQty) || consumableQty < 1 || consumableQty > 999) {
    throw new Error('Choose a whole-number quantity between 1 and 999.');
  }
  const rng = createRng(Date.now());
  let relics = 0;

  for (const def of UNIQUES) {
    // A tonic is a consumable, so the loop below hands it out like any other.
    if (def.kind === 'gear') {
      addItem(state.stash, makeUnique(def, rng, Math.max(def.minDepth, 6), true));
      relics++;
    }
    findRelic(state.lifetime.uniquesSeen ??= [], def.id);
    nameRelic(state.lifetime.uniquesKnown ??= [], def.id);
  }

  for (const base of ITEM_BASES) {
    addItem(state.stash, makeEquipment({
      baseId: base.id, materialId: bestMaterialFor(base.id),
      rarity: Rarity.Epic, ilvl: GEAR_ILVL, quality: 1, identified: true,
    }));
  }
  for (const c of CONSUMABLES) addItem(state.stash, makeConsumable(c.id, consumableQty));

  return { relics, gear: ITEM_BASES.length, consumables: CONSUMABLES.length };
}
