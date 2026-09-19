/**
 * Necromancy: the Gravecaller, and what it does with your kills.
 *
 * A Gravecaller keeps its distance and, instead of fighting, **channels over a
 * fallen undead** for `RAISE_CHANNEL` seconds: a glow rises from the body and a
 * chant plays. If the channel completes, the corpse stands back up at
 * `RAISE_HP` of its health, `risen`, so it pays nothing a second time.
 *
 * Three answers, all of them readable:
 *
 * 1. **Interrupt it.** Any damage breaks the channel, and it is light enough to
 *    stagger. A thrown shaft or a reflected bolt reaches it at range.
 * 2. **Shatter the remains.** A blunt killing blow, or one that overkills by
 *    `SHATTER_OVERKILL` of the monster's health, leaves bones nothing can raise.
 * 3. **Sanctify them.** A killing blow carrying holy damage, or one struck from
 *    Threshold's consecrated ground, leaves remains that stay down.
 *
 * Only the undead can be raised: a goblin stays dead.
 */

/** Seconds of chanting over the corpse before it stands. */
export const RAISE_CHANNEL = 2;
/** How far (Manhattan) a Gravecaller reaches for a corpse. */
export const RAISE_REACH = 4;
/** Seconds between one raising and the next attempt. */
export const RAISE_COOLDOWN = 6;
/** How many it can raise in one life. */
export const RAISE_LIMIT = 3;
/** The share of its health a raised corpse stands up with. */
export const RAISE_HP = 0.5;
/** A raised corpse's beat before it may wind up: it does not come up swinging. */
export const RAISE_BEAT = 0.8;
/** Overkill, as a share of max health, that shatters remains whatever the weapon. */
export const SHATTER_OVERKILL = 0.25;

/** Floors with bones enough to call. */
export const GRAVE_BIOMES = new Set(['crypt', 'catacombs']);

/** The chance an Ossuary or Catacombs floor has a Gravecaller. None on the first floor. */
export function gravecallerChance(depth: number): number {
  return depth < 2 || depth > 5 ? 0 : 0.5 + 0.1 * (depth - 2);
}
