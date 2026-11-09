/**
 * A fixed-step clock. Real time goes in, whole simulation steps come out.
 *
 * The dungeon used to advance by whatever time each display frame took, so a
 * 144 Hz monitor and a phone at 30 fps ran the same seed through different
 * ticks, and a recorded run could not be played back. Now the world only ever
 * advances by `SIM_STEP`, as many times as the real time banked allows. The
 * renderer draws between the last two steps (`alpha`), so a fast display
 * still moves smoothly. See src/render/interp.ts.
 */

/** Seconds per simulation step: 60 a second, the rate the game was tuned at. */
export const SIM_STEP = 1 / 60;

/**
 * Real time banked in one frame is capped, so a long hitch (a tab coming
 * back, a GC pause) costs at most this much simulated time instead of a burst
 * of catch-up steps. Below 10 fps the game runs slow rather than skipping.
 */
export const MAX_FRAME_SECONDS = 0.1;

export class FixedClock {
  private acc = 0;

  constructor(readonly step = SIM_STEP, readonly maxFrame = MAX_FRAME_SECONDS) {}

  /** Bank a frame's real time. */
  bank(elapsed: number): void {
    this.acc += Math.min(Math.max(0, elapsed), this.maxFrame);
  }

  /** Spend one step if one is due. */
  take(): boolean {
    // The epsilon keeps a frame of exactly one step from being lost to rounding.
    if (this.acc + 1e-9 < this.step) return false;
    this.acc = Math.max(0, this.acc - this.step);
    return true;
  }

  /** How far real time has got between the last step and the next, 0..1. */
  get alpha(): number {
    return Math.min(1, this.acc / this.step);
  }

  /** Drop banked time: after a pause, a new world, or a step that opened a menu. */
  reset(): void {
    this.acc = 0;
  }
}

/**
 * Bank `elapsed` and run every step that is due. `step` returns false to stop
 * early (a menu opened, the run ended), which also drops the time left over.
 * Returns how many steps ran.
 */
export function advance(clock: FixedClock, elapsed: number, step: () => boolean): number {
  clock.bank(elapsed);
  let n = 0;
  while (clock.take()) {
    n++;
    if (!step()) {
      clock.reset();
      break;
    }
  }
  return n;
}
