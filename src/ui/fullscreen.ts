type FSDoc = Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> | void };
type FSEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

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

export async function toggleFullscreen(): Promise<'on' | 'off' | 'unsupported'> {
  const d = document as FSDoc;
  const el = document.documentElement as FSEl;
  try {
    if (isFullscreen()) {
      if (d.exitFullscreen) await d.exitFullscreen();
      else await d.webkitExitFullscreen?.();
      return 'off';
    }
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return 'unsupported';
    return 'on';
  } catch {
    return 'unsupported';
  }
}

export const FULLSCREEN_HELP =
  'This browser can\'t go fullscreen. On iPhone: tap Share → Add to Home Screen, then play from the new icon.';
