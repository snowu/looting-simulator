/**
 * Display brightness: a per-device calibration, not save data.
 *
 * Why this lives apart from the save (same as audio volume): brightness
 * compensates for *your screen and your room* — a dimmed laptop at 1am, a
 * phone with night shift on, a bright desktop monitor. It follows the device,
 * never the playthrough, so it is stored in localStorage and never synced.
 *
 * Why gamma and not a linear gain: the dungeon's readability lives in the
 * shadow mids (torch-lit walls a few tiles out), while pure black (fog) and
 * peak white (hit flashes) are the artistic anchors. A gamma curve
 * `out = pow(in, 1 / b)` lifts the mids while pinning both ends — 0 stays 0,
 * 1 stays 1 — so turning it up never washes the fog grey or clips flashes
 * the way a linear multiplier would. That is also what most shipped games do
 * behind a "Brightness" slider with a barely-visible-logo calibration step.
 *
 * Cosmetic only: this never touches light radius, light intensity, fog
 * distances or enemy behaviour. A brighter screen does not see further —
 * the fog still starts at the same tile.
 */

export const BRIGHTNESS_MIN = 0.6;
export const BRIGHTNESS_MAX = 1.6;
export const BRIGHTNESS_DEFAULT = 1;

const BRIGHTNESS_KEY = 'looting-simulator-brightness';

function clamp(v: number): number {
  if (!Number.isFinite(v)) return BRIGHTNESS_DEFAULT;
  return Math.min(BRIGHTNESS_MAX, Math.max(BRIGHTNESS_MIN, v));
}

function loadStored(): number {
  try {
    const raw = localStorage.getItem(BRIGHTNESS_KEY);
    if (raw === null) return BRIGHTNESS_DEFAULT;
    return clamp(Number(raw));
  } catch {
    return BRIGHTNESS_DEFAULT;
  }
}

type Listener = (v: number) => void;

class Brightness {
  private value = loadStored();
  private listeners = new Set<Listener>();

  get(): number {
    return this.value;
  }

  /** Persist the choice; device preference, not save data. */
  set(v: number): number {
    this.value = clamp(v);
    try {
      localStorage.setItem(BRIGHTNESS_KEY, String(this.value));
    } catch {
      // Storage blocked: the game keeps running, the choice just won't stick.
    }
    for (const l of this.listeners) l(this.value);
    return this.value;
  }

  reset(): number {
    return this.set(BRIGHTNESS_DEFAULT);
  }

  onChange(l: Listener): () => void {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  }
}

export const brightness = new Brightness();

/**
 * The JS mirror of the post-shader curve, for the settings calibration
 * swatches and for tests. Keep in sync with POST_FRAG in render/ps1.ts:
 * `c = pow(c, 1 / uBrightness)`.
 */
export function applyBrightnessGain(channel: number, b = brightness.get()): number {
  const c = Math.min(1, Math.max(0, channel));
  if (b === 1) return c;
  return Math.pow(c, 1 / clamp(b));
}

/** Slider percent (60–160) ↔ internal gain. */
export function brightnessToPercent(b: number): number {
  return Math.round(clamp(b) * 100);
}

export function percentToBrightness(pct: number): number {
  if (!Number.isFinite(pct)) return BRIGHTNESS_DEFAULT;
  return clamp(pct / 100);
}
