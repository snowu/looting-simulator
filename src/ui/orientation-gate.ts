import { h } from './dom';
import { fullscreenSupported, isFullscreen, isStandalone, lockLandscape, toggleFullscreen } from './fullscreen';

/**
 * The game is landscape only. Where the browser lets a page hold the screen
 * sideways (Android: an installed app, or fullscreen) it is locked; where it
 * cannot (iPhone Safari has neither fullscreen nor a lock), this gate covers
 * everything in portrait and asks for the phone to be turned. A tap on it
 * tries the lock again, which on Android is also the gesture fullscreen needs.
 *
 * Only for coarse pointers: a touch laptop in a tall window is not a phone
 * held the wrong way up.
 */
const QUERY = '(orientation: portrait) and (pointer: coarse)';

export class OrientationGate {
  readonly el = h(
    'div',
    { class: 'rotate-gate' },
    h('div', { class: 'rotate-phone', attrs: { 'aria-hidden': 'true' } }),
    h('div', { class: 'rotate-title', text: 'Turn your phone sideways' }),
    h('div', { class: 'rotate-sub', text: 'Looting Simulator plays in landscape.' }),
  );
  private mq = matchMedia(QUERY);

  constructor(parent: HTMLElement, onChange: (blocked: boolean) => void) {
    this.el.hidden = !this.blocked;
    this.mq.addEventListener('change', () => {
      this.el.hidden = !this.blocked;
      onChange(this.blocked);
    });
    this.el.addEventListener('click', () => void landscapeNow());
    parent.append(this.el);
  }

  /** True while the phone is upright and the game is covered. */
  get blocked(): boolean {
    return this.mq.matches;
  }
}

let pending: Promise<void> | null = null;

/**
 * Lock landscape from a tap. Outside an installed app the lock needs
 * fullscreen first, and fullscreen needs a user gesture, so this goes through
 * the same toggle as the corner button.
 */
export function landscapeNow(): Promise<void> {
  // One tap can reach this twice (the first-touch hook and the gate's own
  // click); a second fullscreen toggle mid-request would undo the first.
  pending ??= (async () => {
    if (isStandalone() || isFullscreen()) await lockLandscape();
    else if (fullscreenSupported()) await toggleFullscreen();
  })().finally(() => {
    pending = null;
  });
  return pending;
}

