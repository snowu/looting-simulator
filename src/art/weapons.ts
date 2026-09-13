import { rows, stamp } from './helpers';

/**
 * Weapons that more than one creature carries, drawn once.
 *
 * A goblin, a skeleton and four elemental archers are different creatures with
 * the same job, and the player has to read that job in one glance across a dark
 * room. So the bow is authored here and stamped into all six: same silhouette,
 * same rest, same draw, only the wood and the arrowhead change.
 *
 * Shared parts use UPPERCASE palette characters (`Y` `Z` `X` `P`) so they can
 * never collide with a creature's own lowercase ramp. Every user supplies them:
 *
 *   Y  bow limb, dark side      X  string
 *   Z  bow limb, lit side       P  arrowhead
 *   F  the archer's fist        H  the light in the arrowhead
 *
 * `k`, the outline, is the one lowercase character every creature palette
 * already has.
 */

/**
 * Carried across the chest: limbs curving out to the left, string straight down
 * the right. Two things make it a bow rather than a rope loop at this size —
 * the wood is thicker and brighter than the string, and it is four times as
 * tall as it is wide. The old side bow was filled solid and read as a shield.
 */
export const BOW_REST = rows(`
  ..kY..
  .kZY..
  .kZY.X
  .kZ..X
  kZY..X
  kZY..X
  kZY..X
  kZY..X
  kZY..X
  kZY..X
  kZY..X
  kZY..X
  kZY..X
  kZY..X
  kZY..X
  kZY..X
  .kZ..X
  .kZY.X
  .kZY..
  ..kY..
`);

/**
 * Drawn, seen from the front: the limbs stay where they were and the string
 * pulls back into a long V. An archer aiming at you is almost edge-on in
 * reality, which reads as nothing at all, so the bow is turned a few degrees
 * toward the player — the usual pixel-art cheat, and the only version of this
 * pose that survives being 30 pixels tall on a dark wall.
 */
export const BOW_DRAWN = rows(`
  ..kY..........
  .kZY.X........
  .kZY..X.......
  .kZ....X......
  kZY.....X.....
  kZY......X....
  kZY.......X...
  kZY........X..
  kZY.........X.
  kZY.........X.
  kZY........X..
  kZY.......X...
  kZY......X....
  kZY.....X.....
  .kZ....X......
  .kZY..X.......
  .kZY.X........
  ..kY..........
`);

/**
 * The head of the nocked shaft, pointed at you. A solid diamond, and small:
 * anything bigger stops being an arrowhead and becomes a spell in both hands.
 */
export const ARROW_NOCKED = rows(`
  .kPk.
  kPHPk
  PHHHP
  kPHPk
  .kPk.
`);

/** Held ready in the off hand, head up, so an idle archer still reads as one. */
export const ARROW_HELD = rows(`
  .kPk.
  kPHPk
  .kPk.
  .kYk.
  .kYk.
  .kYk.
  .kYk.
  .kk..
`);


/** Closed on the riser or the string. Small: the sleeve hides the rest of the arm. */
const FIST = rows(`
  kkk.
  kFFk
  kFFk
  kkk.
`);

/**
 * The two archer poses, composed once for every creature that draws a bow.
 *
 * A goblin, a skeleton and four elemental archers are different creatures
 * doing the same job, and the player has to read that job in one glance across
 * a dark room — so they do not merely carry the same bow, they carry it the
 * same way, in the same hand, and move it along the same path when they shoot.
 * Pass `dy` to sit the bow correctly on a shorter body.
 */
export function bowAtRest(body: string[], dy = 0): string[] {
  return stamp(stamp(stamp(body, BOW_REST, 8, 7 + dy), FIST, 8, 16 + dy), ARROW_HELD, 22, 14 + dy);
}

export function bowDrawn(body: string[], dy = 0): string[] {
  return stamp(
    stamp(stamp(stamp(body, BOW_DRAWN, 5, 8 + dy), FIST, 5, 16 + dy), ARROW_NOCKED, 16, 16 + dy),
    FIST, 20, 16 + dy,
  );
}
