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

/**
 * Two states, exactly as the bestiary has met-vs-recorded.
 *
 * **Held** is the ledger of relics that have actually been in your pack. It is
 * what the Ashen King's promise reads, so "one you have never held" means what
 * it says — dying on the way out, or leaving it on the floor, does not count.
 *
 * **Named** is what the codex opens on, and it needs the relic identified. A
 * relic recovered but not yet appraised shows as a shape you are carrying and
 * nothing more: the name is supposed to land at the appraiser, and a codex that
 * spoils it hands you the identification for free.
 */
export function isFound(seen: string[] | undefined, id: string): boolean {
  return !!seen?.includes(id);
}

export function isNamed(known: string[] | undefined, id: string): boolean {
  return !!known?.includes(id);
}

/** Record a relic as identified. Returns false when it was already named. */
export function nameRelic(known: string[], id: string): boolean {
  if (known.includes(id)) return false;
  known.push(id);
  return true;
}

export function forgetRelicName(known: string[], id: string): boolean {
  const at = known.indexOf(id);
  if (at < 0) return false;
  known.splice(at, 1);
  return true;
}

export interface RelicProgress {
  found: number;
  named: number;
  total: number;
}

export function relicProgress(seen: string[] | undefined, known: string[] | undefined): RelicProgress {
  return {
    found: RELIC_ORDER.filter((u) => isFound(seen, u.id)).length,
    named: RELIC_ORDER.filter((u) => isNamed(known, u.id)).length,
    total: RELIC_ORDER.length,
  };
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
