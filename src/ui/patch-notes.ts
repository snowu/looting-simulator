import { PATCHES } from '../data/patches';
import { btn, h } from './dom';

/** Scroll icon button for the home (title) page. Opens the patch-notes overlay. */
export function patchNotesButton(): HTMLElement {
  return h(
    'button',
    {
      class: 'btn patch-open',
      title: 'Patch notes — every change, newest first',
      onclick: () => openPatchNotes(),
    },
    h('span', { class: 'patch-scroll', text: '📜' }),
    ' Patch notes',
  );
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
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closePatchNotes();
    }
  };
  wrap.addEventListener('pointerdown', (e) => {
    if (e.target === wrap) closePatchNotes();
  });
  // Capture so the dungeon key handler (if any) does not see the Escape first.
  window.addEventListener('keydown', onKey, true);
  (wrap as unknown as Record<string, unknown>).__close = () =>
    window.removeEventListener('keydown', onKey, true);
  wrap.append(modal);
  document.getElementById('app')?.append(wrap) ?? document.body.append(wrap);
  render();
}

export function closePatchNotes(): void {
  for (const el of document.querySelectorAll('.patch-wrap')) {
    (el as unknown as Record<string, (() => void) | undefined>).__close?.();
    el.remove();
  }
}
