import { TILT_THRESHOLDS, TiltSensitivity } from './tilt';

/**
 * Touch control preferences: which strafe controls a phone shows, and whether
 * a sideways swipe turns or strafes.
 *
 * Like brightness and volume these follow the device, not the playthrough:
 * whether you want to tilt a phone has nothing to do with which save is
 * loaded. Stored in localStorage and never synced.
 */

export interface TouchPrefs {
  /** Two on-screen buttons on the screen edges: hold to strafe (or turn, see padSwipe). */
  strafeButtons: boolean;
  /** Roll the phone to strafe (or turn, see padSwipe). Off by default: it needs a sensor, and on iOS a permission. */
  tilt: boolean;
  /**
   * Swiping left/right on the view turns (the original control) or strafes.
   * Whichever it is, the edge buttons and tilt do the other.
   */
  padSwipe: 'turn' | 'strafe';
  /** How far the phone has to roll before tilt moves you. */
  tiltSensitivity: TiltSensitivity;
}

export const TOUCH_PREFS_DEFAULT: TouchPrefs = { strafeButtons: true, tilt: false, padSwipe: 'turn', tiltSensitivity: 'medium' };

const KEY = 'looting-simulator-touch-prefs';

function load(): TouchPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...TOUCH_PREFS_DEFAULT };
    const v = JSON.parse(raw) as Partial<TouchPrefs>;
    return {
      strafeButtons: typeof v.strafeButtons === 'boolean' ? v.strafeButtons : TOUCH_PREFS_DEFAULT.strafeButtons,
      tilt: typeof v.tilt === 'boolean' ? v.tilt : TOUCH_PREFS_DEFAULT.tilt,
      padSwipe: v.padSwipe === 'strafe' || v.padSwipe === 'turn' ? v.padSwipe : TOUCH_PREFS_DEFAULT.padSwipe,
      tiltSensitivity: v.tiltSensitivity && v.tiltSensitivity in TILT_THRESHOLDS ? v.tiltSensitivity : TOUCH_PREFS_DEFAULT.tiltSensitivity,
    };
  } catch {
    return { ...TOUCH_PREFS_DEFAULT };
  }
}

type Listener = (p: TouchPrefs) => void;

class TouchPrefStore {
  private value = load();
  private listeners = new Set<Listener>();

  get(): TouchPrefs {
    return this.value;
  }

  set(patch: Partial<TouchPrefs>): TouchPrefs {
    this.value = { ...this.value, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.value));
    } catch {
      // Storage blocked: the choice holds for this session only.
    }
    for (const l of this.listeners) l(this.value);
    return this.value;
  }

  onChange(l: Listener): () => void {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }
}

export const touchPrefs = new TouchPrefStore();

/** What a sideways swipe on the view does. The strafe buttons and tilt do the other one. */
export type PadSwipe = TouchPrefs['padSwipe'];

/**
 * The move a sideways control makes. The pad does what `padSwipe` says; the
 * edge buttons and tilt ("extra") do the other, so between them a phone can
 * always both turn and strafe.
 */
export function sideMove(side: 'left' | 'right', source: 'pad' | 'extra', swipe: PadSwipe): 'left' | 'right' | 'turnLeft' | 'turnRight' {
  const strafe = (source === 'pad') === (swipe === 'strafe');
  if (strafe) return side;
  return side === 'left' ? 'turnLeft' : 'turnRight';
}
