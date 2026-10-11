import { PATCHES } from '../data/patches';
import { btn, closeOverlays, h, mountOverlay } from './dom';

/** Pixel scroll, matching the 16px gear/fullscreen icons without an emoji-font dependency. */
const SCROLL_ICON = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M4 1h9v1h1v1h1v3h-3v7h-1v1H9v1H2v-1H1v-4h3V1zm2 2v7h3v3h1V3H6zm6 0v1h1V3h-1zM3 12v1h4v-1H3z"/><path fill="currentColor" d="M7 5h2v1H7zM7 7h2v1H7z"/></svg>';

/** Scroll icon button for the title's corner toolbar. */
export function patchNotesButton(): HTMLElement {
  return h('button', {
    class: 'corner-btn patch-open',
    title: 'Patch notes — every change, newest first',
    attrs: { 'aria-label': 'Patch notes' },
    html: SCROLL_ICON,
    onclick: () => openPatchNotes(),
  });
}

/**
 * Full-screen overlay listing every patch. One patch is one curated entry:
 * `short`/`hash` name the newest commit it covers (`also` lists the rest) and
 * `summary` is the player-facing note.
 * Rendered on demand so the title screen stays cheap; closed by the button,
 * the backdrop, or Escape.
 */
export function openPatchNotes(): void {
  closePatchNotes();
  const wrap = h('div', { class: 'modal-wrap patch-wrap' });
  const list = h('div', { class: 'patch-list' });

  function render(): void {
    const shown = PATCHES;
    list.replaceChildren();
    let lastDate = '';
    for (const p of shown) {
      if (p.date !== lastDate) {
        lastDate = p.date;
        list.append(h('div', { class: 'patch-day', text: p.date }));
      }
      list.append(
        h(
          'div',
          { class: 'patch' },
          h(
            'div',
            { class: 'row patch-head' },
            h('span', { class: 'patch-num', text: `Patch ${p.n}` }),
            h('span', { class: 'patch-title grow', text: p.title }),
            h('span', { class: 'patch-hash', text: p.short }),
          ),
          h('p', { class: 'patch-summary', text: p.summary }),
          p.details?.length
            ? h('ul', { class: 'patch-points' }, ...p.details.map((d) => h('li', { text: d })))
            : null,
          p.tags.length
            ? h('div', { class: 'patch-tags' }, ...p.tags.map((t) => h('span', { class: 'patch-tag', text: t })))
            : null,
        ),
      );
    }
    if (!shown.length) list.append(h('p', { class: 'dim', text: 'No patches yet.' }));
  }

  const modal = h(
    'div',
    { class: 'modal frame gold patch-modal' },
    h(
      'div',
      { class: 'row patch-top' },
      h('h2', { class: 'grow', text: 'Patch notes' }),
      h('span', { class: 'dim small', text: `${PATCHES.length} patches` }),
      btn('Close', closePatchNotes, 'small'),
    ),
    h('p', { class: 'dim small', text: 'Gameplay changes only, newest first. Patch numbers are stable — Patch 1 is the oldest.' }),
    list,
  );
  wrap.append(modal);
  mountOverlay(wrap, closePatchNotes);
  render();
}

export function closePatchNotes(): void {
  closeOverlays('.patch-wrap');
}
