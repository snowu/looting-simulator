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
export type ConduitSpellId = 'ember_bolt' | 'rime_lance' | 'smite' | 'hex';

export interface ConduitSpellDef {
  id: ConduitSpellId;
  name: string;
  element: Element;
  /**
   * Art id of the bolt in flight, drawn head-first along its path. For a
   * hitscan spell, the mark it leaves on what it strikes instead.
   */
  sprite: string;
  /**
   * Lands at once on the first monster in your line, up to `range` tiles, and
   * never flies: no bolt, no `speed`. Walls and the King's threshold still stop it.
   */
  hitscan?: boolean;
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
  /** Tiles per second (unused by a hitscan spell), and tiles before it fizzles. */
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
/**
 * Hex: seconds as a penguin. It cannot attack, guard, steal or chant, it
 * waddles at this many seconds a step, and it keeps every point of health.
 */
export const HEX_SECONDS = 15;
export const PENGUIN_STEP = 0.7;

export const CONDUIT_SPELLS: readonly ConduitSpellDef[] = [
  {
    id: 'ember_bolt', name: 'Ember Bolt', element: 'fire', sprite: 'proj_fireball', icon: 'ic_spell_ember', light: '#ff8a30',
    power: 1, charges: 1, stamina: 18, windup: 0.28, recovery: 0.38, speed: 9, range: 5,
    color: '#ff9a50', starter: true,
    description: 'A bolt of fire. What it hits keeps burning for a few seconds.',
  },
  {
    id: 'rime_lance', name: 'Rime Lance', element: 'frost', sprite: 'proj_icicle', icon: 'ic_spell_rime', light: '#7ab8ff',
    power: 0.6, charges: 1, stamina: 16, windup: 0.26, recovery: 0.36, speed: 11, range: 5,
    color: '#9ad0ff',
    description: 'A shard of frost. What it hits is chilled: its next wind-up is half as long again, which makes the parry easier to land.',
  },
  // Hitscan, both: they land the instant the cast releases, on the first
  // monster in your line. Smite's ×2 on the undead is their holy resistance
  // (every undead stat block already takes holy at ×1.5–2), not a second rule.
  {
    id: 'smite', name: 'Smite', element: 'holy', sprite: 'fx_smite', icon: 'ic_spell_smite', light: '#fff0b0',
    hitscan: true,
    power: 0.9, charges: 1, stamina: 18, windup: 0.32, recovery: 0.38, speed: 0, range: 5,
    color: '#ffe8a0',
    description: 'A streak of light straight down on the first thing in your line. The undead take it double, and one it kills is sanctified: nothing will raise it again.',
  },
  {
    id: 'hex', name: 'Hex', element: 'shadow', sprite: 'fx_poof', icon: 'ic_spell_hex', light: '#b080ff',
    hitscan: true,
    power: 0, charges: 2, stamina: 22, windup: 0.38, recovery: 0.44, speed: 0, range: 5,
    color: '#c8a0ff',
    description: 'The first thing in your line becomes a penguin for 15 seconds. It cannot fight back, and hitting it does not break the spell. Elites are not spared; the King and the floor lieutenants refuse it.',
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
export const WEAVE_REGROW = 1.5;
