/**
 * Tilt to strafe: roll the phone like a steering wheel and the Warden
 * sidesteps that way, for as long as it stays rolled.
 *
 * The roll is read from where "up" points across the *screen*, not from one
 * raw sensor axis. deviceorientation reports beta and gamma in the phone's
 * portrait frame, so in landscape the axis you steer with is a different one,
 * and which way it runs flips between the two landscape sides. Turning the
 * sensor into an up vector and projecting it onto the screen's horizontal
 * handles portrait, both landscapes, and any forward pitch alike: leaning the
 * top of the phone towards you changes nothing, only the roll counts.
 */

export type TiltDir = 'left' | 'right';

export type TiltSensitivity = 'low' | 'medium' | 'high';

/**
 * Roll past `on` degrees starts the move, and it keeps going until the roll
 * comes back inside `off`. The gap is hysteresis, so a wobble at the edge
 * doesn't stutter. Low is where the feature started (20°), which play on a
 * phone found too far to lean; medium is the default.
 */
export const TILT_THRESHOLDS: Record<TiltSensitivity, { on: number; off: number }> = {
  low: { on: 20, off: 12 },
  medium: { on: 12, off: 7 },
  high: { on: 7, off: 4 },
};

const RAD = Math.PI / 180;

/**
 * How far the phone is rolled, in degrees, positive when the right edge of
 * the screen is lower. `beta` and `gamma` are the deviceorientation angles,
 * `screenAngle` is screen.orientation.angle (0, 90, 180 or 270).
 */
export function tiltRoll(beta: number, gamma: number, screenAngle: number): number {
  // Earth's up in the device frame, from the W3C Z-X'-Y'' rotation.
  const b = beta * RAD, g = gamma * RAD, s = screenAngle * RAD;
  const ux = -Math.sin(g) * Math.cos(b);
  const uy = Math.sin(b);
  // The screen's right-hand direction in device coordinates is (cos s, -sin s).
  const across = ux * Math.cos(s) - uy * Math.sin(s);
  // Right edge down tips "up" towards the left edge, so negate.
  return Math.asin(Math.max(-1, Math.min(1, -across))) / RAD;
}

/** Which way this roll asks to go, if any. */
export function tiltDir(roll: number, current: TiltDir | null, sensitivity: TiltSensitivity = 'medium'): TiltDir | null {
  const { on, off } = TILT_THRESHOLDS[sensitivity];
  const mag = Math.abs(roll);
  const side: TiltDir = roll > 0 ? 'right' : 'left';
  if (current === side && mag > off) return current;
  return mag >= on ? side : null;
}

function screenAngle(): number {
  const a = screen.orientation?.angle;
  if (typeof a === 'number') return a;
  // Older iOS: window.orientation is 0, 90, -90 or 180.
  const legacy = (window as { orientation?: number }).orientation;
  return typeof legacy === 'number' ? (legacy + 360) % 360 : 0;
}

type PermissionedOrientation = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

/** True where the page has to ask before it can read the sensor (iOS 13+). */
export function tiltNeedsPermission(): boolean {
  return typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as PermissionedOrientation).requestPermission === 'function';
}

/**
 * Ask for the motion sensor. Must be called from a tap (a click or touchend
 * handler) or iOS refuses without showing the prompt. Resolves true when the
 * sensor can be read; elsewhere there is nothing to ask and it resolves true.
 */
export async function requestTilt(): Promise<boolean> {
  if (typeof DeviceOrientationEvent === 'undefined') return false;
  const req = (DeviceOrientationEvent as PermissionedOrientation).requestPermission;
  if (typeof req !== 'function') return true;
  try {
    return (await req.call(DeviceOrientationEvent)) === 'granted';
  } catch {
    return false;
  }
}

/** Listens to the sensor while enabled; `dir` is what the tilt asks for right now. */
export class TiltStrafe {
  dir: TiltDir | null = null;
  sensitivity: TiltSensitivity = 'medium';
  private on = false;
  private readonly listener = (e: DeviceOrientationEvent) => {
    if (e.beta === null || e.gamma === null) return;
    this.dir = tiltDir(tiltRoll(e.beta, e.gamma, screenAngle()), this.dir, this.sensitivity);
  };

  get enabled(): boolean {
    return this.on;
  }

  set enabled(v: boolean) {
    if (v === this.on) return;
    this.on = v;
    this.dir = null;
    if (v) window.addEventListener('deviceorientation', this.listener);
    else window.removeEventListener('deviceorientation', this.listener);
  }
}
