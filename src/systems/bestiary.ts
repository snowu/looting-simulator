import { ENEMIES, enemyDef } from '../data/enemies';
import { EnemyDef } from '../types';

/**
 * What the codex remembers about one creature. `kills` accrues from the first
 * time you put one down; `known` is what a field-notes drop buys you, and is
 * the line between a silhouette and the full entry.
 */
export interface BestiaryEntry {
  kills: number;
  known: boolean;
}

export type BestiaryState = Record<string, BestiaryEntry>;

/** Everything that can appear in the codex, shallowest first. */
export const BESTIARY_ORDER: EnemyDef[] = [...ENEMIES].sort(
  (a, b) => a.minDepth - b.minDepth || a.name.localeCompare(b.name),
);

export function bestiaryEntry(b: BestiaryState | undefined, id: string): BestiaryEntry {
  return b?.[id] ?? { kills: 0, known: false };
}

export function isKnown(b: BestiaryState | undefined, id: string): boolean {
  return bestiaryEntry(b, id).known;
}

/** Whether this creature has ever been met, which is what reveals the silhouette. */
export function isSeen(b: BestiaryState | undefined, id: string): boolean {
  const e = bestiaryEntry(b, id);
  return e.kills > 0 || e.known;
}

export function recordKill(b: BestiaryState, id: string): void {
  const e = (b[id] ??= { kills: 0, known: false });
  e.kills += 1;
}

/** Read a field-notes drop. Returns false when the page was already in the codex. */
export function unlockEntry(b: BestiaryState, id: string): boolean {
  const e = (b[id] ??= { kills: 0, known: false });
  if (e.known) return false;
  e.known = true;
  return true;
}

export function loreName(id: string): string {
  return `Field Notes: ${enemyDef(id).name}`;
}

export interface BestiaryProgress {
  known: number;
  seen: number;
  total: number;
}

export function bestiaryProgress(b: BestiaryState | undefined): BestiaryProgress {
  return {
    known: BESTIARY_ORDER.filter((e) => isKnown(b, e.id)).length,
    seen: BESTIARY_ORDER.filter((e) => isSeen(b, e.id)).length,
    total: BESTIARY_ORDER.length,
  };
}
