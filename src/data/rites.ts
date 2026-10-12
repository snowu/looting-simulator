import type { Element } from '../types';

/**
 * Rites: sigils you draw. Rare, fight-changing, and cast by tracing —
 * never by a button. Ordinary spells stay on the button; a rite is saved
 * for the moment that matters. See docs/NEXT.md §6 and MECHANICS.md.
 *
 * A rite is learned for good by studying its carving, costs two charges
 * in the worn conduit, and can be cast again as they recover. You never
 * pick one: holding the rite input opens one tablet, and the mark you draw
 * says which rite you meant. Drawing quality decides the outcome: a clean
 * trace lands the full rite, a sloppy one a weaker one, a botch backfires.
 */
export type RiteId = 'meteor' | 'glacial_tomb' | 'judgement' | 'penguining';

/** The first depth a carving can wait on: the opening floors keep their tuning. */
export const RITE_CARVING_DEPTH = 3;

export interface RiteDef {
  id: RiteId;
  name: string;
  /** What the float and the tablet's title call it once recognised. */
  short: string;
  element: Element;
  /** HUD and touch icon. */
  icon: string;
  /** The standing slab that teaches it, and the same slab once studied. */
  carving: string;
  carvingUsed: string;
  /** Tablet title, legend and messages. */
  color: string;
  /**
   * The mark, as vertices in a 0..1 box, drawn in one stroke. The four are
   * chosen to sit far apart for the point-cloud matcher (a V, a Z, a
   * triangle and a circle) so a sloppy one of each still reads as itself.
   */
  template: readonly (readonly [number, number])[];
  description: string;
}

/** A closed loop of `n` segments, starting at the top and running clockwise. */
function loop(cx: number, cy: number, rx: number, ry: number, n = 24): [number, number][] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [Math.round((cx + rx * Math.cos(a)) * 1000) / 1000, Math.round((cy + ry * Math.sin(a)) * 1000) / 1000];
  });
}

export const RITES: readonly RiteDef[] = [
  {
    id: 'meteor',
    name: 'Rite of Meteor',
    short: 'Meteor',
    element: 'fire',
    icon: 'ic_rite_meteor',
    carving: 'carving',
    carvingUsed: 'carving_used',
    color: '#ff9a50',
    // A single V: two trails meeting at the impact point.
    template: [
      [0.18, 0.16],
      [0.50, 0.86],
      [0.82, 0.16],
    ],
    description: 'Fire falls on every monster in the room. A sloppy trace brings less of it; a botched one brings it down on you.',
  },
  {
    id: 'glacial_tomb',
    name: 'Glacial Tomb',
    short: 'Glacial Tomb',
    element: 'frost',
    icon: 'ic_rite_glacial_tomb',
    carving: 'carving_glacial_tomb',
    carvingUsed: 'carving_glacial_tomb_used',
    color: '#9ad0ff',
    // A Z: the crack that runs through ice.
    template: [
      [0.16, 0.18],
      [0.84, 0.18],
      [0.16, 0.82],
      [0.84, 0.82],
    ],
    description: 'Everything in sight is frozen solid for five seconds — the King only slowed. A sloppy trace holds them half as long; a botched one freezes you.',
  },
  {
    id: 'judgement',
    name: 'Rite of Judgement',
    short: 'Judgement',
    element: 'holy',
    icon: 'ic_rite_judgement',
    carving: 'carving_judgement',
    carvingUsed: 'carving_judgement_used',
    color: '#fff0b0',
    // A closed triangle, apex up: the pillar's cone of light.
    template: [
      [0.50, 0.12],
      [0.86, 0.84],
      [0.14, 0.84],
      [0.50, 0.12],
    ],
    description: 'A pillar of light on every monster in the room. The undead die and stay dead; the living are struck with holy fire. A sloppy trace only wounds the undead; a botched one judges you.',
  },
  {
    id: 'penguining',
    name: 'The Great Penguining',
    short: 'Penguining',
    element: 'shadow',
    icon: 'ic_rite_penguining',
    carving: 'carving_penguining',
    carvingUsed: 'carving_penguining_used',
    color: '#c8a0ff',
    // An egg.
    template: loop(0.5, 0.52, 0.32, 0.38),
    description: 'Every monster in the room is a penguin for 15 seconds. The King and the floor lieutenants refuse it. A sloppy trace lasts half as long; a botched one drinks your conduit dry.',
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

/**
 * Pacing, after the flask shards: guaranteed carvings at milestones, which
 * stay guaranteed until they are studied, plus a small chance on every floor
 * from depth 3. At most one carving per delve, and never one you know.
 *
 * - Reaching depth 3 promises your first rite, depth 5 your second.
 * - Killing the King promises your third.
 * - Otherwise each floor from depth 3 rolls this chance, rising with depth.
 */
export const RITE_MILESTONES: readonly { depth: number; known: number }[] = [
  { depth: 3, known: 1 },
  { depth: 5, known: 2 },
];
export const RITE_KING_KNOWN = 3;
export function riteFloorChance(depth: number): number {
  if (depth < RITE_CARVING_DEPTH) return 0;
  return Math.min(0.05, 0.02 + (depth - RITE_CARVING_DEPTH) * 0.01);
}

/** Roads that teach their own rite when it is the one to come. */
export const ROAD_RITES: Readonly<Record<string, RiteId>> = { frostvault: 'glacial_tomb' };
