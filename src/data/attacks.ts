/**
 * Attack moves: what a creature does when it commits, rather than when.
 *
 * Every melee monster used to own exactly one beat — `def.windup` seconds of
 * lean, a blow on the tile in front, `def.recovery` seconds of settle. Two
 * monsters differed only in how long that beat lasted, so learning to meet a
 * skeleton taught you how to meet everything in the dungeon.
 *
 * A move set is a small weighted list of attacks. The creature rolls one when
 * it starts its wind-up, and the *move* decides the beat: how long the tell
 * runs, how far the blow reaches, how hard it lands, whether a second one is
 * already coming.
 *
 * Nothing here takes anything away. A def with no `moves` gets {@link BASIC},
 * whose every multiplier is 1 — which is exactly, to the frame, what that
 * creature did before this file existed. Feel is opt-in, one creature at a
 * time.
 *
 * The balance rule for adding one: a move pays for reach, power or a second
 * strike in wind-up or recovery, so a full move set lands within a few percent
 * of the same creature's basic-only damage over time. These are different
 * problems to solve, not harder ones. `npm run tables` prints the comparison.
 */

export interface AttackMove {
  id: string;
  /** Shown in the bestiary and in the hit message. */
  name: string;
  /** Multiplier on the creature's `windup`. */
  windup: number;
  /** Multiplier on the creature's `recovery`, and so on the gap before its next swing. */
  recovery: number;
  /** Multiplier on the creature's `attack`. */
  power: number;
  /**
   * Tiles ahead the blow lands on. 1 is the adjacent tile every attack used to
   * hit; 2 reaches over the gap you just made by stepping back.
   */
  reach: number;
  /**
   * Also strikes the two tiles flanking the target — the ones a sidestep goes
   * to. Aimed squarely at circling: a sweep is how a big thing answers being
   * walked around.
   */
  sweep?: boolean;
  /**
   * Extra strikes after this one, each on {@link COMBO_BEAT} seconds. The
   * follow-ups track you, so walking out mid-flurry is a real escape rather
   * than a free one — the first blow is what you cannot dodge.
   */
  combo?: number;
  /**
   * The lean stalls partway through and restarts. What it costs you is the
   * parry you spent on the stall; what it costs the creature is the longest
   * tell in the game.
   */
  feint?: boolean;
  /** The colour the wind-up glows. Read `tellFor` before picking a new one. */
  tell: string;
  /** Sprite growth at the peak of the wind-up. 0 for everything that is not a slam. */
  swell?: number;
}

/**
 * Seconds between the strikes of a combo. Short enough to read as one attack,
 * long enough that a parry catches only the blow it was aimed at.
 */
export const COMBO_BEAT = 0.26;

/**
 * How far into a feint's wind-up the lean stalls, and for what fraction of the
 * whole wind-up it holds. Tuned so the stall lands close to where an ordinary
 * wind-up would have struck: that is the bait.
 */
export const FEINT_AT = 0.55;
export const FEINT_HOLD = 0.22;

/**
 * The beat every creature had before move sets, and still has unless it is
 * given a set. Every multiplier is 1 on purpose — this is the identity move,
 * and `attacks.test.ts` pins it that way.
 */
export const BASIC: AttackMove = {
  id: 'basic', name: 'a blow',
  windup: 1, recovery: 1, power: 1, reach: 1,
  // The red flicker a wind-up has always had. Changing it would repaint every
  // creature in the game that has not been given a move set.
  tell: '#ff331a',
};

export const MOVES: Record<string, AttackMove> = {
  basic: BASIC,
  /**
   * Faster than a step. You cannot walk out of a jab once it starts, which is
   * the point: small quick things should punish standing at range one and
   * thinking, rather than being slow things with less health.
   */
  jab: {
    id: 'jab', name: 'a quick jab',
    windup: 0.55, recovery: 0.7, power: 0.65, reach: 1,
    tell: '#fff0b0',
  },
  /**
   * Three blows on one commitment, each weak, and a recovery long enough to
   * lose a fight in. The whole encounter turns on the gap afterwards.
   */
  flurry: {
    id: 'flurry', name: 'a flurry',
    windup: 0.8, recovery: 1.8, power: 0.44, reach: 1, combo: 2,
    tell: '#ffb0d0',
  },
  /**
   * Reach 2. Backing off one tile — the answer to everything else in the
   * game — walks you into it instead of out of it.
   */
  thrust: {
    id: 'thrust', name: 'a long thrust',
    windup: 1.15, recovery: 1.1, power: 1.1, reach: 2,
    tell: '#a0d8ff',
  },
  /**
   * The flanks as well as the front. A shield covers one tile and a sidestep
   * goes to the next one; this is the attack that knows that.
   *
   * It is the one move priced deliberately *under* neutral (about −10%): what
   * it really sells is taking a dodge away, and paying for that in damage as
   * well would make circling a big thing simply wrong rather than risky.
   */
  sweep: {
    id: 'sweep', name: 'a wide sweep',
    windup: 1.3, recovery: 1.25, power: 1.15, reach: 1, sweep: true,
    tell: '#ffc070',
  },
  /**
   * Nearly two seconds of tell on most things that own it, and nearly twice
   * the damage. It is not a blow to trade with, it is a blow to not be there
   * for — or to parry, if you want the riposte badly enough.
   */
  slam: {
    id: 'slam', name: 'an overhead slam',
    windup: 2.1, recovery: 1.8, power: 1.9, reach: 1,
    tell: '#ff7a5a', swell: 0.16,
  },
  /**
   * The lean stutters. Everything a feint costs you is spent on the stutter,
   * and everything it costs the creature is the time it spends selling it —
   * which is why the blow at the end of it is the hardest non-slam in the
   * game. Reading it has to be worth something.
   */
  feint: {
    id: 'feint', name: 'a feint',
    windup: 1.6, recovery: 0.8, power: 1.35, reach: 1, feint: true,
    tell: '#c8a0ff',
  },
};

/**
 * Damage per second of one move, relative to the same creature throwing plain
 * blows for ever. 1 is neutral.
 *
 * A move's whole cycle is its wind-up plus its recovery, and a combo's extra
 * strikes land *inside* the recovery, so they cost no time — which is exactly
 * why a flurry has to be weak per blow and slow to come out of.
 *
 * This is the function `attacks.test.ts` holds every move to, and the one the
 * balance tables print. A new move that scores outside 0.9–1.1 is a difficulty
 * change wearing a variety change's clothes, and needs to say so out loud.
 */
export function relativeDps(move: AttackMove): number {
  const hits = 1 + (move.combo ?? 0);
  const time = move.windup * (move.feint ? 1 + FEINT_HOLD : 1) + move.recovery;
  const basic = BASIC.power / (BASIC.windup + BASIC.recovery);
  return (move.power * hits) / time / basic;
}

export type MoveId = keyof typeof MOVES;

/** A move and how often this creature reaches for it. */
export interface MoveWeight {
  id: string;
  weight: number;
}

export function moveById(id: string | undefined): AttackMove {
  return (id && MOVES[id]) || BASIC;
}

/**
 * Pick a move from a set. Called at the moment of commitment, so a creature
 * that is interrupted and comes back may well answer with something else.
 *
 * `pick` takes the total weight and returns a roll below it, which is how the
 * world's seeded rng gets in without this module importing it.
 */
export function chooseMove(moves: MoveWeight[] | undefined, roll: (total: number) => number): AttackMove {
  if (!moves?.length) return BASIC;
  let total = 0;
  for (const m of moves) total += m.weight;
  if (total <= 0) return BASIC;
  let r = roll(total);
  for (const m of moves) {
    r -= m.weight;
    if (r <= 0) return moveById(m.id);
  }
  return moveById(moves[moves.length - 1].id);
}

/**
 * The furthest any of this creature's moves reaches. What the chase logic asks
 * before deciding whether standing two tiles away is safe.
 */
export function meleeReach(def: { moves?: MoveWeight[] }): number {
  let reach = 1;
  for (const m of def.moves ?? []) reach = Math.max(reach, moveById(m.id).reach);
  return reach;
}

/**
 * Named move sets, so the roster reads as characterisation rather than as
 * tables of numbers. A creature's set is chosen by what it *is*.
 */
export const MOVE_SETS: Record<string, MoveWeight[]> = {
  /** Small, fast, and in your face. */
  vermin: [{ id: 'jab', weight: 3 }, { id: 'basic', weight: 2 }],
  /** Frantic: it would rather land four bad blows than one good one. */
  frenzied: [{ id: 'flurry', weight: 3 }, { id: 'jab', weight: 2 }, { id: 'basic', weight: 2 }],
  /** A pole-arm or a long jaw. Reach is the whole identity. */
  reaching: [{ id: 'thrust', weight: 3 }, { id: 'basic', weight: 3 }],
  /** Cunning rather than strong: it knows you are watching for the lean. */
  cunning: [{ id: 'feint', weight: 2 }, { id: 'jab', weight: 2 }, { id: 'basic', weight: 3 }],
  /** Big and unhurried. It makes you move your feet. */
  brute: [{ id: 'slam', weight: 2 }, { id: 'sweep', weight: 3 }, { id: 'basic', weight: 4 }],
  /** A champion: everything, and it commits to the big one more often. */
  champion: [{ id: 'slam', weight: 3 }, { id: 'sweep', weight: 3 }, { id: 'thrust', weight: 2 }, { id: 'basic', weight: 3 }],
  /** Armoured and deliberate — it trades reach and width, never speed. */
  guardian: [{ id: 'thrust', weight: 3 }, { id: 'sweep', weight: 2 }, { id: 'basic', weight: 4 }],
  /** A drilled soldier: two crisp blows, then back behind the shield. */
  drilled: [{ id: 'jab', weight: 2 }, { id: 'flurry', weight: 2 }, { id: 'basic', weight: 4 }],
};
