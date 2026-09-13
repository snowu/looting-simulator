/**
 * Escape a string for interpolation into an HTML template.
 *
 * Save data is attacker-influenced (console injection, hand-edited
 * localStorage, a tampered cloud row on the player's own account), so any
 * save-derived string rendered through `innerHTML` must go through this
 * first. Prefer `text:` / `textContent` where possible and reserve this for
 * the tooltip/preview builders that genuinely need markup.
 */
export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
