/**
 * A stable id for one playthrough.
 *
 * Slots are positions, not identities: the same game can sit in slot 1 here and
 * slot 3 on a phone. Sync matches on this instead, so a save is recognised as
 * itself wherever it happens to be filed.
 */
export function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Insecure context or an old engine: this only has to be unique among one
    // player's three saves, so a random string is plenty.
    return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}
