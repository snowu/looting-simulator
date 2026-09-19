/**
 * Pane help registry: every "?" in the UI points here.
 *
 * Each entry is the explanation for one pane, keyed by a stable id. The "?"
 * buttons (`helpButton` in `src/ui/dom.ts`) reference these ids, and the
 * inline help block (`helpBlock`) renders the entry's body. Content lives in
 * exactly one place so the wording stays consistent wherever it appears.
 *
 * Future direction (no code for it yet): a full game-guide modal that renders
 * every entry in this registry, where a pane's "?" jumps straight to its
 * entry and highlights it — the registry is already the table of contents,
 * so that PR only adds presentation, never content or call sites. To grow
 * toward it, keep adding entries here (one per pane) instead of inlining
 * explanation strings in UI code.
 */
export type HelpId = 'oaths';

export interface HelpEntry {
  /** The pane the entry explains, shown if the entry ever gets a heading. */
  title: string;
  /** The explanation itself, plain text. */
  body: string;
}

export const HELP: Record<HelpId, HelpEntry> = {
  oaths: {
    title: 'The Oath Stone',
    body: `Today's oaths: two hard, three medium, and they change with the days. Swear as many as you dare, or none. Each kept oath pays inscriptions you have not learned (one for medium, two for hard), keep every one of two or more and you learn one more, and a broken oath loses only its own reward.`,
  },
};
