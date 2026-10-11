import type { Element } from '../types';

/**
 * Battle spells: what a conduit casts. Not sigils — a sigil is one utility
 * stone carried alone on a long cooldown (`spells.ts`); these are learned into
 * a spellbook, several are loaded into the conduit in your offhand at once,
 * and they share its pool of charges. See docs/NEXT.md §4 and MECHANICS.md.
 *
 * A cast is scored like a throw: the conduit's own Power stands in for
 * Attack, and your matching elemental stat rides along, so fire gear makes an
 * Ember Bolt hit harder and a Rime Lance not at all.
 */
export type ConduitSpellId = 'ember_bolt' | 'rime_lance';

export interface ConduitSpellDef {
  id: ConduitSpellId;
  name: string;
  element: Element;
  /** Art id of the bolt in flight, drawn head-first along its path. */
  sprite: string;
  /** Art id of the spell in the HUD, the forge and the touch Cast button. */
  icon: string;
  /** Glow the bolt casts as it flies. */
  light: string;
  /** Multiplier on the conduit's Power for the hit itself. */
  power: number;
  /** Charges the cast spends from the conduit's shared pool. */
  charges: number;
  stamina: number;
  /** Seconds from press to release, and after it before you can act. */
  windup: number;
  recovery: number;
  /** Tiles per second, and tiles before it fizzles. */
  speed: number;
  range: number;
  /** Colour of floats, the wash and the HUD. */
  color: string;
  description: string;
  /** Known from the start; the rest come from tomes. */
  starter?: boolean;
}

/** Ember Bolt's burn: a share of the hit, dealt again over this many seconds. */
export const BURN_SECONDS = 3;
export const BURN_SHARE = 0.45;
/** Rime Lance: the target's next wind-up runs this much longer while chilled. */
export const CHILL_SECONDS = 4;
export const CHILL_WINDUP = 1.5;

export const CONDUIT_SPELLS: readonly ConduitSpellDef[] = [
  {
    id: 'ember_bolt', name: 'Ember Bolt', element: 'fire', sprite: 'proj_fireball', icon: 'ic_spell_ember', light: '#ff8a30',
    power: 1, charges: 1, stamina: 14, windup: 0.22, recovery: 0.3, speed: 9, range: 5,
    color: '#ff9a50', starter: true,
    description: 'A bolt of fire. What it hits keeps burning for a few seconds.',
  },
  {
    id: 'rime_lance', name: 'Rime Lance', element: 'frost', sprite: 'proj_icicle', icon: 'ic_spell_rime', light: '#7ab8ff',
    power: 0.6, charges: 1, stamina: 12, windup: 0.2, recovery: 0.3, speed: 11, range: 5,
    color: '#9ad0ff',
    description: 'A shard of frost. What it hits is chilled: its next wind-up is half as long again, which makes the parry easier to land.',
  },
];

const BY_ID = new Map(CONDUIT_SPELLS.map((s) => [s.id, s]));

export function findConduitSpell(id: string | null | undefined): ConduitSpellDef | undefined {
  return id ? BY_ID.get(id as ConduitSpellId) : undefined;
}

export function conduitSpell(id: string): ConduitSpellDef {
  const def = findConduitSpell(id);
  if (!def) throw new Error(`unknown conduit spell ${id}`);
  return def;
}

export const STARTER_CONDUIT_SPELLS: ConduitSpellId[] = CONDUIT_SPELLS.filter((s) => s.starter).map((s) => s.id);

/**
 * Weave, the battlemage rule. A spell that lands charges your weapon with its
 * element for the next blow inside `WEAVE_SECONDS`; a melee blow that lands
 * takes `WEAVE_REGROW` off the conduit's regrow. Cast, close, strike, cast.
 */
export const WEAVE_SECONDS = 3;
/** The weave's elemental bonus, as a fraction of the conduit's Power. */
export const WEAVE_SHARE = 0.5;
export const WEAVE_REGROW = 2;
