import { EnemyAI } from '../systems/dungeon';

/**
 * One place decides what a creature looks like mid-attack: which of its two or
 * three drawn frames is showing, and how far it has thrown its body at you.
 *
 * The renderer used to infer "it just hit me" from `ai === 'recover'`, but
 * `recover` is also where a staggered, parried or phase-broken creature is
 * parked — so a skeleton knocked out of its wind-up played the follow-through
 * of a blow it never threw. The strike stamp (`sinceStrike`) is set only by an
 * actual swing, so reeling and recovering no longer look the same.
 *
 * It is also what the dev art sheet drives its preview loop with, which means
 * the sheet shows the cadence the dungeon shows.
 */

export type EnemyFrame = '0' | 'atk' | 'block';

export interface PoseInput {
  ai: EnemyAI;
  /** Seconds left in the current AI state. */
  timer: number;
  /** Seconds since this creature's last swing or loosed shot; Infinity if never. */
  sinceStrike: number;
  /** Absent (or 'down') means no shield is up. */
  guard?: 'down' | 'raising' | 'up';
  /** Whether the creature has a drawn guard frame at all. */
  hasShield: boolean;
  /** Bows and casters release on the strike; everything else swings through it. */
  ranged: boolean;
  windup: number;
  recovery: number;
}

export interface EnemyPose {
  frame: EnemyFrame;
  /** Tiles thrown toward the player. Negative is a flinch away from you. */
  lunge: number;
}

/** How far into the wind-up the weapon comes up. The tell has to outlast a reaction. */
const TELL_AT = 0.3;
/** Tiles of lean gathered over a wind-up, and the extra thrown at the blow. */
const LEAN = 0.25;
const PUNCH = 0.46;
/** The blow is fast and the settle is slow: seconds out, seconds back. */
const PUNCH_OUT = 0.07;
const PUNCH_BACK = 0.34;
/** An archer braces instead of leaning, and rocks back off the string. */
const BRACE = 0.09;
const RECOIL = 0.14;
const RECOIL_OUT = 0.05;
const RECOIL_BACK = 0.22;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The arc a strike throws the body along: out fast, back slow, and clipped to
 * the recovery so a quick creature is standing again before it can swing next.
 */
function strikeLunge(sinceStrike: number, recovery: number, ranged: boolean): number {
  const peak = ranged ? -RECOIL : PUNCH;
  const out = ranged ? RECOIL_OUT : PUNCH_OUT;
  const back = Math.max(0.08, Math.min(ranged ? RECOIL_BACK : PUNCH_BACK, recovery - out));
  if (sinceStrike < 0 || sinceStrike >= out + back) return 0;
  if (sinceStrike < out) return peak * (sinceStrike / out);
  return peak * (1 - (sinceStrike - out) / back);
}

export function enemyPose(i: PoseInput): EnemyPose {
  if (i.ai === 'dead') return { frame: '0', lunge: 0 };
  const rest: EnemyFrame = i.hasShield && (i.guard ?? 'down') !== 'down' ? 'block' : '0';
  if (i.ai === 'windup') {
    const u = clamp01(1 - i.timer / Math.max(0.01, i.windup));
    // Squared, so the lean gathers late: the creature commits, rather than
    // drifting at you for the whole wind-up.
    const lean = i.ranged ? -BRACE * u : LEAN * u * u;
    return { frame: u >= TELL_AT ? 'atk' : rest, lunge: lean };
  }
  // Past the strike the weapon is already down — the drawn frames are raised
  // weapons, so holding one after impact reads as winding up a second time.
  // The body carries the blow instead.
  return { frame: rest, lunge: strikeLunge(i.sinceStrike, i.recovery, i.ranged) };
}
