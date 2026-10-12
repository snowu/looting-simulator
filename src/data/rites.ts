import type { Element } from '../types';

/**
 * Rites: sigils you draw. Rare, fight-changing, and cast by tracing —
 * never by a button. Ordinary spells stay on the button; a rite is saved
 * for the moment that matters. See docs/NEXT.md §6 and MECHANICS.md.
 *
 * A rite is learned for good by studying its carving, costs every charge
 * in the worn conduit, and answers once per floor. Drawing quality decides
 * the outcome: a clean trace lands the full rite, a sloppy one a weaker
 * one, a botch backfires.
 */
export type RiteId = 'meteor';

/** The depth whose vault holds Meteor's carving: late enough to be earned, early enough to matter. */
export const RITE_CARVING_DEPTH = 3;
export interface RiteDef {
  id: RiteId;
  name: string;
  element: Element;
  /** HUD and touch icon. */
  icon: string;
  /** The mark, as vertices in a 0..1 box: an M for the falling star. */
  template: readonly (readonly [number, number])[];
  description: string;
}

export const RITES: readonly RiteDef[] = [
  {
    id: 'meteor',
    name: 'Rite of Meteor',
    element: 'fire',
    icon: 'ic_rite_meteor',
    template: [
      [0.15, 0.8],
      [0.15, 0.2],
      [0.5, 0.55],
      [0.85, 0.2],
      [0.85, 0.8],
    ],
    description: 'Fire falls on every monster in the room. A sloppy trace brings less of it; a botched one brings it down on you.',
  },
];

const BY_ID = new Map(RITES.map((r) => [r.id, r]));

export function findRite(id: string | null | undefined): RiteDef | undefined {
  return id ? BY_ID.get(id as RiteId) : undefined;
}

export function rite(id: string): RiteDef {
  const def = findRite(id);
  if (!def) throw new Error(`unknown rite ${id}`);
  return def;
}
