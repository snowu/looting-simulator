import { CONDUIT_SPELLS, ConduitSpellId, findConduitSpell } from '../data/conduit-spells';
import { GameState } from '../state/game-state';
import { Container, findItem, removeItem } from '../state/inventory';
import { Item } from '../types';
import { newUid } from './items';

export function makeTome(id: ConduitSpellId): Item {
  if (!findConduitSpell(id)) throw new Error(`unknown conduit spell ${id}`);
  return { uid: newUid(), kind: 'tome', ref: id, qty: 1 };
}

/** Spells neither known nor already on their way home as a tome. */
export function unknownConduitSpells(known: readonly string[], carried: readonly string[] = []): ConduitSpellId[] {
  return CONDUIT_SPELLS.map((s) => s.id).filter((id) => !known.includes(id) && !carried.includes(id));
}

/** The spells loaded right now, as far as a conduit with `slots` holds them. */
export function loadedSpells(state: GameState, slots: number): ConduitSpellId[] {
  const known = state.spellbook ?? [];
  return (state.loadedSpells ?? [])
    .filter((id, i, all) => known.includes(id) && !!findConduitSpell(id) && all.indexOf(id) === i)
    .slice(0, Math.max(0, slots)) as ConduitSpellId[];
}

/** Read a tome: it is consumed and the spell is yours for good. */
export function learnTome(state: GameState, container: Container, uid: string): boolean {
  const item = findItem(container, uid);
  if (!item || item.kind !== 'tome' || !findConduitSpell(item.ref)) return false;
  state.spellbook ??= [];
  if (!state.spellbook.includes(item.ref)) state.spellbook.push(item.ref);
  removeItem(container, uid);
  return true;
}

/** Only in town, or with a portal open: the same rule as sigil attunement. */
export function loadoutLocked(state: GameState): boolean {
  return !!state.run && !state.run.portal;
}

/**
 * Load or unload one spell. Loading appends it, so the order you load in is
 * the order the cast input cycles through; the conduit reads the first as
 * many as it has slots, so a Rod-sized loadout survives a swap to a Wand.
 */
export function toggleLoaded(state: GameState, id: string): boolean {
  if (loadoutLocked(state) || !(state.spellbook ?? []).includes(id) || !findConduitSpell(id)) return false;
  state.loadedSpells ??= [];
  const at = state.loadedSpells.indexOf(id);
  if (at >= 0) state.loadedSpells.splice(at, 1);
  else state.loadedSpells.push(id);
  if (state.run?.conduit) state.run.conduit.sel = 0;
  return true;
}
