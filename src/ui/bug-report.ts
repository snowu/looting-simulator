import { ReportSource, detailsMarkdown, encodeRepro, issueUrl, reportRows, reportTitle, reproOf } from '../systems/bug-report';
import type { OutgoingReport, SendResult } from '../cloud/bug-report';
import { btn, h } from './dom';

/**
 * Settings → Report a bug. Lives inside the settings modal rather than as a
 * modal of its own, so the dungeon stays paused and keys typed into the box
 * never reach the game: both already hang off "settings is open".
 *
 * The screenshot is taken when this panel opens, so it shows what was on
 * screen when you reached for the report, not the form.
 */
export interface BugReportCtx {
  source: () => ReportSource;
  /** The game screen as a PNG, taken as the panel opens; resolves null if it fails. */
  screenshot?: () => Promise<Blob | null> | null;
  toast: (text: string, color?: string) => void;
  back: () => void;
  /**
   * Sending straight to GitHub through the report server, for signed-in
   * players. Absent (or unavailable) means the prefilled GitHub link is the
   * only way, which is also the fallback when sending fails.
   */
  direct?: { available: () => Promise<boolean>; send: (r: OutgoingReport) => Promise<SendResult> };
}

/** Chrome and Safari both take a promise here; that keeps the write inside the click. */
async function copyImage(shot: Promise<Blob | null>): Promise<boolean> {
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': shot.then((b) => b ?? Promise.reject(new Error('no screenshot'))) }),
    ]);
    return true;
  } catch {
    return false;
  }
}

function saveImage(blob: Blob): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `looting-simulator-bug-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** The same facts as the issue's markdown table, as a compact table to read here. */
function detailsTable(src: ReportSource): HTMLElement {
  const rows = reportRows(src).map(([k, v]) => h('tr', {}, h('th', { text: k }), h('td', { text: v })));
  if (src.mode === 'dungeon' && src.world) {
    rows.push(h('tr', {}, h('th', { text: 'Repro' }), h('td', { text: encodeRepro(reproOf(src.world)) })));
  }
  return h('table', { class: 'report-facts' }, h('tbody', {}, ...rows));
}

export function bugReportPanel(ctx: BugReportCtx): HTMLElement {
  const src = ctx.source();
  const details = detailsMarkdown(src);
  const shot = ctx.screenshot?.() ?? null;

  const box = h('textarea', {
    class: 'report-text',
    attrs: { rows: '5', maxlength: '4000', placeholder: 'What happened, and what did you expect? Any language is fine.' },
  }) as HTMLTextAreaElement;

  // A real link, not window.open(): a link click is never popup-blocked, on
  // any browser, and it opens a new tab the same way everywhere.
  const open = h('a', { class: 'btn small primary', text: 'Open on GitHub', attrs: { target: '_blank', rel: 'noopener' } }) as HTMLAnchorElement;
  const refresh = () => {
    open.href = issueUrl(box.value.trim(), details);
  };
  box.addEventListener('input', refresh);
  refresh();
  // Copy first, then open. Opening the tab first moves focus away, and a
  // clipboard write from an unfocused page is refused, silently. The click's
  // user activation outlives the copy (a few seconds), so the tab still opens
  // as the player's own action rather than a blocked popup; if a browser
  // blocks it anyway, the link is still there to click again.
  const noteCopy = (ok: boolean) =>
    ctx.toast(ok ? 'Screenshot copied: paste it into the issue with Ctrl+V.' : 'Could not copy the screenshot. Use "Save screenshot" and attach the file.', ok ? '#9ab0d8' : '#d8a060');
  let copiedOnce = false;
  open.addEventListener('click', (e) => {
    if (!shot || copiedOnce) return;
    e.preventDefault();
    void copyImage(shot).then((ok) => {
      copiedOnce = true;
      noteCopy(ok);
      if (!window.open(open.href, '_blank', 'noopener')) ctx.toast('Your browser blocked the new tab: press Open on GitHub again.', '#d8a060');
      // A later click is a plain link again: the screenshot is already on the clipboard.
      setTimeout(() => (copiedOnce = false), 3000);
    });
  });
  const copyBtn = btn('Copy screenshot', () => void (shot && copyImage(shot).then(noteCopy)), 'small', true);

  const preview = h('div', { class: 'report-shot' }, h('span', { class: 'dim small', text: 'Taking a screenshot…' }));
  const saveBtn = btn('Save screenshot', () => void shot?.then((b) => b && saveImage(b)), 'small', true);
  if (shot) {
    void shot.then((b) => {
      if (!b) {
        preview.replaceChildren(h('span', { class: 'dim small', text: 'The screenshot failed: take one yourself and paste it into the issue.' }));
        return;
      }
      const img = h('img', { attrs: { alt: 'Screenshot that will be attached' } }) as HTMLImageElement;
      img.src = URL.createObjectURL(b);
      preview.replaceChildren(img);
      saveBtn.disabled = false;
      copyBtn.disabled = false;
    });
  }

  const note = h('p', {
    class: 'dim small',
    text: 'Opens a GitHub issue in a new tab with all of this filled in. You need a GitHub account, and issues are public. Your save never leaves this device.',
  });
  const actions = h('div', { class: 'row report-actions' }, open, shot ? copyBtn : null, shot ? saveBtn : null);

  // Signed in: one button files the issue, screenshot and all, and the link
  // steps back to a plain fallback. Checked after the panel is up, so a slow
  // session lookup never delays the form.
  if (ctx.direct) {
    const direct = ctx.direct;
    const send = btn('Send report', () => void submit(), 'small primary', true);
    const syncSend = () => {
      send.disabled = !box.value.trim();
    };
    box.addEventListener('input', syncSend);
    const submit = async (): Promise<void> => {
      const what = box.value.trim();
      if (!what) return;
      send.disabled = true;
      box.disabled = true;
      send.textContent = 'Sending…';
      const res = await direct.send({ title: reportTitle(src), what, details, screenshot: shot ? await shot : null });
      if (res.ok) {
        const link = h('a', { text: `#${res.number}`, attrs: { href: res.url, target: '_blank', rel: 'noopener' } });
        actions.replaceChildren(h('span', { class: 'small' }, 'Sent, thank you! It is issue ', link, '.'));
        note.textContent = 'Anyone can read it on GitHub. Add more there any time.';
        ctx.toast(`Bug report sent as #${res.number}. Thank you!`, '#9ad8a0');
        return;
      }
      box.disabled = false;
      send.textContent = 'Send report';
      syncSend();
      note.textContent = `${res.message} The GitHub link still works.`;
      ctx.toast(res.message, '#d8a060');
    };
    void direct.available().then((ok) => {
      if (ok) {
        open.classList.remove('primary');
        actions.prepend(send);
        syncSend();
        note.textContent = 'Send report files it on GitHub for you, with the screenshot and game details. Issues are public; your email and your save are not included.';
      } else {
        note.textContent += ' Signed in under Cloud saves, you could send it straight from here instead.';
      }
    });
  }

  return h(
    'div',
    { class: 'report-panel' },
    h('div', { class: 'row' }, h('h2', { class: 'grow', text: 'Report a bug' }), btn('Back', () => ctx.back(), 'small')),
    shot ? preview : null,
    box,
    h(
      'details',
      { class: 'report-details' },
      h('summary', { class: 'small', text: 'Game details that will be attached' }),
      detailsTable(src),
    ),
    actions,
    note,
  );
}
