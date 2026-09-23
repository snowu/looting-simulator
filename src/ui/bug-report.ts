import { ReportSource, defaultTitle, detailsMarkdown, issueUrl } from '../systems/bug-report';
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
    open.href = issueUrl(defaultTitle(src, box.value), box.value.trim(), details);
  };
  box.addEventListener('input', refresh);
  refresh();
  open.addEventListener('click', () => {
    if (!shot) return;
    void copyImage(shot).then((ok) =>
      ctx.toast(ok ? 'Screenshot copied: paste it into the Screenshot box on GitHub.' : 'Could not copy the screenshot. Use "Save screenshot" and attach the file.', ok ? '#9ab0d8' : '#d8a060'),
    );
  });

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
      h('pre', { class: 'small', text: details }),
    ),
    h('div', { class: 'row report-actions' }, open, shot ? saveBtn : null),
    h('p', {
      class: 'dim small',
      text: 'Opens a GitHub issue in a new tab with all of this filled in. You need a GitHub account, and issues are public. Your save never leaves this device.',
    }),
  );
}
