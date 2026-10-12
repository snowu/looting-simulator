/**
 * Pointer lock while delving: the cursor disappears and the mouse stays
 * pinned to the view, so there is no arrow drifting over the dungeon (or
 * onto the next monitor). The game never aims with the mouse — it only
 * clicks to swing and block — so locking changes nothing but the cursor.
 *
 * The browser owns the exit: Esc always lets go, and opening any overlay
 * lets go too, so menus and the HUD stay clickable. Clicking the view locks
 * again. Where the API is missing or refuses (touch devices, iframes
 * without permission), every call is a silent no-op and the cursor stays.
 */
export class PointerLock {
  constructor(private canvas: HTMLElement) {}

  /** Pin the mouse. Call from a click gesture, when play input is live. */
  request(): void {
    if (typeof document === 'undefined') return;
    if (document.pointerLockElement === this.canvas) return;
    try {
      const done = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (done && typeof done.catch === 'function') done.catch(() => {});
    } catch {
      // Refused: the cursor just stays.
    }
  }

  /** Let go, if held. */
  release(): void {
    if (typeof document === 'undefined') return;
    if (document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {
        // Nothing to do: there is no cursor to free.
      }
    }
  }

  get locked(): boolean {
    return typeof document !== 'undefined' && document.pointerLockElement === this.canvas;
  }
}
