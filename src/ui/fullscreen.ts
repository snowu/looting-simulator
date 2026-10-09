type FSDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> | void };
type FSEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void };

/** iPhone Safari has no element fullscreen at all; iPad has the webkit-prefixed one. */
export function fullscreenSupported(): boolean {
  const el = document.documentElement as FSEl;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

/** Launched from the home screen as an app: already fullscreen. */
export function isStandalone(): boolean {
  return (
    matchMedia('(display-mode: fullscreen)').matches ||
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isFullscreen(): boolean {
  const d = document as FSDoc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
}

function orientation(): LockableOrientation | undefined {
  return screen.orientation as LockableOrientation | undefined;
}

/**
 * Hold the screen in landscape where the browser allows it: an installed app
 * (Android) or element fullscreen. Everywhere else, iPhone Safari included,
 * the lock just rejects and the portrait gate asks the player to turn the phone.
 */
export async function lockLandscape(): Promise<boolean> {
  try {
    await orientation()?.lock?.('landscape');
    return !!orientation()?.lock;
  } catch {
    return false;
  }
}

/** Timestamp of the last button-initiated fullscreen exit (ms). */
let lastButtonExit = 0;

/**
 * True if fullscreen was left via the button just now rather than via Esc.
 * The exit handler pauses on Esc-driven exits only, so a deliberate click on
 * the button leaves cleanly. Recency-based: any exit event within the window
 * is that same button exit, since exits cannot happen twice.
 */
export function wasButtonExit(): boolean {
  return Date.now() - lastButtonExit < 1500;
}

/** Enter fullscreen and turn the phone sideways; or leave and release the lock. */
export async function toggleFullscreen(): Promise<'on' | 'off' | 'unsupported'> {
  const d = document as FSDoc;
  const el = document.documentElement as FSEl;
  try {
    if (isFullscreen()) {
      try {
        orientation()?.unlock?.();
      } catch {
        // not locked
      }
      unlockKeyboard();
      lastButtonExit = Date.now();
      if (d.exitFullscreen) await d.exitFullscreen();
      else await d.webkitExitFullscreen?.();
      return 'off';
    }
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return 'unsupported';
    // Orientation lock only works while fullscreen (Android Chrome); elsewhere it just rejects.
    await lockLandscape();
    lockEscape();
    return 'on';
  } catch {
    return 'unsupported';
  }
}

type LockableKeyboard = { lock?: (keys: string[]) => Promise<void>; unlock?: () => void };

function keyboard(): LockableKeyboard | undefined {
  try {
    return (navigator as Navigator & { keyboard?: LockableKeyboard }).keyboard;
  } catch {
    return undefined;
  }
}

/**
 * Keep Esc for the game while in element fullscreen.
 *
 * F11 fullscreen leaves Esc alone, but the element fullscreen above reserves
 * it as "leave fullscreen" — the browser eats the keypress, so the Esc you
 * meant as "pause" drops you to windowed mode with the fight still running
 * instead. Holding Esc captured (Chrome/Edge) makes it behave like F11: short
 * presses reach the game and pause, only a long hold leaves fullscreen. Where
 * the API is missing the lock call just fails, and the exit handler in main
 * pauses the delve on the way out, so one Esc press still means pause.
 */
function lockEscape(): void {
  try {
    const p = keyboard()?.lock?.(['Escape']);
    if (p) p.catch(() => undefined);
  } catch {
    // Unsupported browser: fullscreen exit pauses instead (see main).
  }
}

function unlockKeyboard(): void {
  try {
    keyboard()?.unlock?.();
  } catch {
    // ignore
  }
}

export const FULLSCREEN_HELP =
  'This browser can\'t go fullscreen. On iPhone: tap Share → Add to Home Screen, then play from the new icon.';

const ICON_ENTER =
  '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M1 1h5v2H3v3H1zM10 1h5v5h-2V3h-3zM1 10h2v3h3v2H1zM13 10h2v5h-5v-2h3z"/></svg>';
const ICON_EXIT =
  '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M4 1h2v5H1V4h3zM10 1h2v3h3v2h-5zM1 10h5v5H4v-3H1zM10 10h5v2h-3v3h-2z"/></svg>';

/**
 * Browser-chrome fullscreen (F11). The page can neither see it through the
 * Fullscreen API (`fullscreenElement` stays null) nor leave it
 * programmatically — only the browser chrome key gets out.
 */
function isDisplayFullscreen(): boolean {
  try {
    return window.matchMedia('(display-mode: fullscreen)').matches;
  } catch {
    return false;
  }
}

/**
 * One fullscreen toggle pinned to the corner of every screen, above panels,
 * so you can always get in and out.
 *
 * `onDisplayFullscreen` fires when the button is pressed while browser
 * (F11) fullscreen is active: requesting element fullscreen on top of that
 * changes nothing visible and just steals Esc, so the button says how to
 * leave instead of stacking a no-op fullscreen.
 */
export function mountFullscreenButton(parent: HTMLElement, onUnsupported: () => void, onDisplayFullscreen?: () => void): HTMLButtonElement | null {
  if (isStandalone()) return null;
  const b = document.createElement('button');
  b.id = 'fs-btn';
  b.className = 'corner-btn';
  const update = () => {
    const on = isFullscreen() || isDisplayFullscreen();
    b.innerHTML = on ? ICON_EXIT : ICON_ENTER;
    b.title = on ? 'Exit fullscreen' : 'Fullscreen';
    b.setAttribute('aria-label', b.title);
  };
  b.addEventListener('pointerdown', (e) => e.preventDefault());
  b.addEventListener('click', () => {
    if (!isFullscreen() && isDisplayFullscreen()) {
      (onDisplayFullscreen ?? onUnsupported)();
      update();
      return;
    }
    void toggleFullscreen().then((r) => {
      if (r === 'unsupported') onUnsupported();
      update();
    });
  });
  document.addEventListener('fullscreenchange', update);
  document.addEventListener('webkitfullscreenchange', update);
  try {
    window.matchMedia('(display-mode: fullscreen)').addEventListener('change', update);
  } catch {
    // Older browser: the icon still updates on click and fullscreenchange.
  }
  // Esc can tear down fullscreen without going through the button (and without
  // keyboard lock, without even telling the page) — never hold a stale lock.
  document.addEventListener('fullscreenchange', () => { if (!isFullscreen()) unlockKeyboard(); });
  document.addEventListener('webkitfullscreenchange', () => { if (!isFullscreen()) unlockKeyboard(); });
  update();
  parent.append(b);
  return b;
}
