import { GameState } from './game-state';
import { Inventory } from './inventory';

const SAVE_KEY = 'looting-simulator-save';

export function saveGame(state: GameState): void {
  const data = JSON.stringify(state, (_key, value) => {
    if (value instanceof Map) return { __type: 'Map', entries: [...value] };
    return value;
  });
  localStorage.setItem(SAVE_KEY, data);
}

function hydrateInventory(raw: Record<string, unknown>): Inventory {
  const inv = new Inventory();
  if (Array.isArray(raw.items)) {
    for (const item of raw.items) inv.addItem(item);
  }
  if (raw.materials instanceof Map) {
    for (const [id, qty] of raw.materials) inv.addMaterial(id, qty as number);
  }
  return inv;
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw, (_key, value) => {
    if (value?.__type === 'Map') return new Map(value.entries);
    return value;
  });
  const state = new GameState();
  state.stash = hydrateInventory(parsed.stash ?? {});
  state.gold = parsed.gold ?? 100;
  state.meta = parsed.meta ?? state.meta;
  state.runState = null;
  return state;
}
