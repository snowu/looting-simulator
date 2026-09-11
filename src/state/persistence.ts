import { GameState, SAVE_VERSION } from './game-state';
import { AFFIXES } from '../data/affixes';
import { BLESSINGS } from '../world/world';

const SAVE_KEY = 'looting-simulator-save-v2';
const AFFIX_IDS = new Set(AFFIXES.map((a) => a.id));

/** Game state is plain data, so a save is just JSON. */
export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the game keeps running, it just won't persist.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    // Drop affixes that no longer exist (e.g. the removed "of Mending").
    const parsed = JSON.parse(raw, (key, value) =>
      key === 'affixes' && Array.isArray(value) ? value.filter((a: { id?: string }) => a && AFFIX_IDS.has(a.id ?? '')) : value,
    ) as GameState;
    if (parsed.version !== SAVE_VERSION) return null;
    if (parsed.run?.blessing && !(parsed.run.blessing in BLESSINGS)) parsed.run.blessing = null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
