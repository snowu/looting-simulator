import { UNIQUES, UniqueDef } from '../data/uniques';

/**
 * The other half of the codex.
 *
 * Where the bestiary records what has tried to kill you, this records what the
 * dungeon has handed over: the bespoke legendaries, in the order they exist to
 * be found. The state itself is `lifetime.uniquesSeen` on the save — one flat
 * list of ids — because the same list is what makes the Ashen King's drop a new
 * one each time. The codex is a reader of that list, not a second copy of it.
 */
export const RELIC_ORDER: UniqueDef[] = [...UNIQUES].sort(
  (a, b) => a.minDepth - b.minDepth || a.name.localeCompare(b.name),
);

export function isFound(seen: string[] | undefined, id: string): boolean {
  return !!seen?.includes(id);
}

export interface RelicProgress {
  found: number;
  total: number;
}

export function relicProgress(seen: string[] | undefined): RelicProgress {
  return { found: RELIC_ORDER.filter((u) => isFound(seen, u.id)).length, total: RELIC_ORDER.length };
}

/** Record a relic as found. Returns false when it was already in the list. */
export function findRelic(seen: string[], id: string): boolean {
  if (seen.includes(id)) return false;
  seen.push(id);
  return true;
}

/** Forget one. Only the dev bench does this, so a drop can be checked twice. */
export function forgetRelic(seen: string[], id: string): boolean {
  const at = seen.indexOf(id);
  if (at < 0) return false;
  seen.splice(at, 1);
  return true;
}
