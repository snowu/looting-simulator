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
      if (d.exitFullscreen) await d.exitFullscreen();
      else await d.webkitExitFullscreen?.();
      return 'off';
    }
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return 'unsupported';
    // Orientation lock only works while fullscreen (Android Chrome); elsewhere it just rejects.
    await orientation()?.lock?.('landscape').catch(() => undefined);
    return 'on';
  } catch {
    return 'unsupported';
  }
}

export const FULLSCREEN_HELP =
  'This browser can\'t go fullscreen. On iPhone: tap Share → Add to Home Screen, then play from the new icon.';

const ICON_ENTER =
  '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M1 1h5v2H3v3H1zM10 1h5v5h-2V3h-3zM1 10h2v3h3v2H1zM13 10h2v5h-5v-2h3z"/></svg>';
const ICON_EXIT =
  '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M4 1h2v5H1V4h3zM10 1h2v3h3v2h-5zM1 10h5v5H4v-3H1zM10 10h5v2h-3v3h-2z"/></svg>';

/**
 * One fullscreen toggle pinned to the corner of every screen, above panels,
 * so you can always get in and out.
 */
export function mountFullscreenButton(parent: HTMLElement, onUnsupported: () => void): HTMLButtonElement | null {
  if (isStandalone()) return null;
  const b = document.createElement('button');
  b.id = 'fs-btn';
  const update = () => {
    const on = isFullscreen();
    b.innerHTML = on ? ICON_EXIT : ICON_ENTER;
    b.title = on ? 'Exit fullscreen' : 'Fullscreen';
    b.setAttribute('aria-label', b.title);
  };
  b.addEventListener('pointerdown', (e) => e.preventDefault());
  b.addEventListener('click', () => {
    void toggleFullscreen().then((r) => {
      if (r === 'unsupported') onUnsupported();
      update();
    });
  });
  document.addEventListener('fullscreenchange', update);
  document.addEventListener('webkitfullscreenchange', update);
  update();
  parent.append(b);
  return b;
}
