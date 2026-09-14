import { SIGILS, SigilId, findSigil } from '../data/spells';
import { GameState } from '../state/game-state';
import { Container, findItem, removeItem } from '../state/inventory';
import { Item } from '../types';
import { newUid } from './items';

export function makeSigil(id: SigilId): Item {
  if (!findSigil(id)) throw new Error(`unknown sigil ${id}`);
  return { uid: newUid(), kind: 'sigil', ref: id, qty: 1 };
}

export function unknownSigils(known: readonly string[], carried: readonly string[] = []): SigilId[] {
  return SIGILS.map((s) => s.id).filter((id) => !known.includes(id) && !carried.includes(id));
}

/** Consume a recovered stone and permanently add it to this playthrough. */
export function inscribeSigil(state: GameState, container: Container, uid: string): boolean {
  const item = findItem(container, uid);
  if (!item || item.kind !== 'sigil' || !findSigil(item.ref)) return false;
  state.spells ??= [];
  if (!state.spells.includes(item.ref)) state.spells.push(item.ref);
  removeItem(container, uid);
  return true;
}

/** Change attunement without resetting an open run's shared remaining cooldown. */
export function attuneSigil(state: GameState, id: string | null): boolean {
  if (id !== null && (!(state.spells ?? []).includes(id) || !findSigil(id))) return false;
  if (state.run && !state.run.portal) return false;
  state.attuned = id;
  if (state.run) {
    const cd = state.run.sigil?.cd ?? 0;
    state.run.sigil = id ? { id, cd } : null;
  }
  return true;
}
