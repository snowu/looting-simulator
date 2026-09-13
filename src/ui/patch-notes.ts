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
 * Full-screen overlay listing every patch. One patch is one commit:
 * `short`/`hash` is the source commit, `summary` the player-facing note.
 * Rendered on demand so the title screen stays cheap; closed by the button,
 * the backdrop, or Escape.
 */
export function openPatchNotes(): void {
  closePatchNotes();
  const wrap = h('div', { class: 'modal-wrap patch-wrap' });
  const search = h('input', {
    class: 'field patch-search',
    attrs: { placeholder: 'Search patches…', type: 'search' },
  }) as HTMLInputElement;
  const list = h('div', { class: 'patch-list' });
  const count = h('span', { class: 'dim small' });

  function render(): void {
    const q = search.value.trim().toLowerCase();
    const shown = q
      ? PATCHES.filter((p) =>
          `patch ${p.n} ${p.title} ${p.summary} ${p.short} ${p.tags.join(' ')}`.toLowerCase().includes(q),
        )
      : PATCHES;
    count.textContent = `${shown.length} of ${PATCHES.length} patches`;
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
          p.tags.length
            ? h('div', { class: 'patch-tags' }, ...p.tags.map((t) => h('span', { class: 'patch-tag', text: t })))
            : null,
        ),
      );
    }
    if (!shown.length) list.append(h('p', { class: 'dim', text: 'No patches match that search.' }));
  }

  search.addEventListener('input', render);
  const modal = h(
    'div',
    { class: 'modal frame gold patch-modal' },
    h(
      'div',
      { class: 'row patch-top' },
      h('h2', { class: 'grow', text: 'Patch notes' }),
      count,
      btn('Close', closePatchNotes, 'small'),
    ),
    h('p', { class: 'dim small', text: 'Gameplay changes only, newest first. Patch numbers are stable — Patch 1 is the oldest.' }),
    search,
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
  search.focus();
}

export function closePatchNotes(): void {
  for (const el of document.querySelectorAll('.patch-wrap')) {
    (el as unknown as Record<string, (() => void) | undefined>).__close?.();
    el.remove();
  }
}
