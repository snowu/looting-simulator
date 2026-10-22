import { PATCHES } from '../data/patches';
import { btn, closeOverlays, h, mountOverlay } from './dom';
import { markPatchesSeen, newSinceLastVisit, unreadPatchCount } from './patch-seen';

/**
 * Scroll icon button for the home (title) page. Opens the patch-notes overlay.
 * While the player has patches they haven't opened yet, it says how many.
 */
export function patchNotesButton(): HTMLElement {
  const button = h('button', {
    class: 'btn patch-open',
    title: 'Patch notes — every change, newest first',
    onclick: () => openPatchNotes(),
  });
  paintPatchButton(button);
  return button;
}

/** Keep every open-patch-notes button in step with what has been read. */
function refreshPatchButtons(): void {
  for (const b of document.querySelectorAll<HTMLElement>('.patch-open')) paintPatchButton(b);
}

function paintPatchButton(button: HTMLElement): void {
  const unread = unreadPatchCount();
  button.classList.toggle('patch-unread', unread > 0);
  button.replaceChildren(
    h('span', { class: 'patch-scroll', text: '📜' }),
    unread > 0 ? ` Patch notes · ${unread} new` : ' Patch notes',
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
  // Highlights are the patches added since the player's last visit, fixed for
  // this page load so they stay marked after the notes are opened.
  const fresh = new Set(newSinceLastVisit().map((p) => p.n));

  function render(): void {
    const shown = PATCHES;
    list.replaceChildren();
    let lastDate = '';
    for (const p of shown) {
      const isNew = fresh.has(p.n);
      if (p.date !== lastDate) {
        lastDate = p.date;
        list.append(h('div', { class: 'patch-day', text: p.date }));
      }
      list.append(
        h(
          'div',
          { class: isNew ? 'patch patch-new' : 'patch' },
          h(
            'div',
            { class: 'row patch-head' },
            h('span', { class: 'patch-num', text: `Patch ${p.n}` }),
            isNew ? h('span', { class: 'patch-new-tag', text: 'New' }) : null,
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
    fresh.size
      ? h('p', { class: 'patch-since', text: `${fresh.size} new since your last visit — highlighted below.` })
      : null,
    list,
  );
  wrap.append(modal);
  mountOverlay(wrap, closePatchNotes);
  render();
  // Opening the notes is reading them: the title button stops counting these.
  markPatchesSeen();
  refreshPatchButtons();
}

export function closePatchNotes(): void {
  closeOverlays('.patch-wrap');
}
