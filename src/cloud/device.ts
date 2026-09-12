const DEVICE_KEY = 'looting-simulator-device';

/**
 * A stable id for this browser, kept deliberately outside `GameState`.
 *
 * It rides along with an upload so a save can say which device wrote it — "you
 * last played this on your phone" — and it must survive a reset, which wipes
 * the game state. Keeping it in its own key is what makes that true. It is a
 * random opaque value and identifies a browser, not a person.
 */
export function deviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    // Private mode or blocked storage: a per-tab id still labels the upload.
    return 'ephemeral';
  }
}
