import { GameState } from '../state/game-state';
import { DIFFICULTIES, DIFFICULTY_IDS, difficultyOf } from '../data/difficulty';
import { audio } from '../audio/sfx';
import { btn, h } from './dom';

/**
 * Settings, behind the gear in the town header.
 *
 * Two things live here rather than in town itself: the difficulty switch,
 * which does not need to be visible on every visit, and the full account
 * panel, whose sign-in flow wants room the header never had. The header keeps
 * only the compact sync status (or a Connect button). Same overlay pattern as
 * the patch notes: backdrop or Escape closes it.
 */

export interface SettingsCtx {
  state: () => GameState;
  save: () => void;
  toast: (text: string, color?: string) => void;
  /** The persistent account element, moved in here while open. */
  account: () => HTMLElement | null;
  /** Town refreshes behind the modal (e.g. the header sync status). */
  onClose: () => void;
}

export function openSettings(ctx: SettingsCtx): void {
  closeSettings();
  audio.play('ui');
  const wrap = h('div', { class: 'modal-wrap settings-wrap' });
  const difficultyBox = h('div', {});
  const accountBox = h('div', {});

  /**
   * One row per difficulty, both always rendered: button on the left, what it
   * means on the right. Switching only flips the highlight class in place, so
   * the text below never moves — the two descriptions are very different
   * lengths, and swapping one for the other shoved the whole modal around.
   */
  function renderDifficulty(): void {
    const s = ctx.state();
    const running = !!s.run && s.run.outcome === 'active';
    // Mid-delve the highlight follows the run snapshot, not town state — the
    // buttons are locked anyway, so this is just saying what you are on.
    const current = running ? difficultyOf(s.run?.difficulty ?? s.difficulty).id : s.difficulty;
    difficultyBox.replaceChildren(
      h('h3', { text: 'Difficulty' }),
      ...DIFFICULTY_IDS.map((id) => {
        const def = DIFFICULTIES[id];
        const el = btn(
          def.name,
          () => {
            if (ctx.state().run?.outcome === 'active') return;
            ctx.state().difficulty = id;
            ctx.save();
            ctx.toast(`Difficulty: ${def.name}. ${def.tagline}`, '#9ab0d8');
            paintSelection();
          },
          'small',
          running,
        );
        el.title = running ? `${def.name} (locked mid-delve)` : `Play on ${def.name}`;
        return h(
          'div',
          { class: 'diff-row' },
          el,
          h('span', { class: 'dim small', text: def.description }),
        );
      }),
      ...(running
        ? [h('p', {
            class: 'dim small',
            text: `Delving on ${DIFFICULTIES[current].name} — locked until you return to town, so a bad fight cannot be softened halfway.`,
          })]
        : []),
    );
    paintSelection();
  }

  /** Flip the highlight without rebuilding: no reflow, no jumping text. */
  function paintSelection(): void {
    const s = ctx.state();
    const running = !!s.run && s.run.outcome === 'active';
    const current = running ? difficultyOf(s.run?.difficulty ?? s.difficulty).id : s.difficulty;
    const rows = difficultyBox.querySelectorAll('.diff-row');
    DIFFICULTY_IDS.forEach((id, i) => {
      rows[i]?.querySelector('button')?.classList.toggle('primary', current === id);
    });
  }

  const modal = h(
    'div',
    { class: 'modal frame gold settings-modal' },
    h(
      'div',
      { class: 'row' },
      h('h2', { class: 'grow', text: 'Settings' }),
      btn('Close', () => closeSettings(), 'small'),
    ),
    difficultyBox,
    h('h3', { style: 'margin-top:10px', text: 'Cloud saves' }),
    h('p', { class: 'dim small', text: 'Optional. Signed out, the game plays exactly as it always has.' }),
    accountBox,
  );
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeSettings();
    }
  };
  wrap.addEventListener('pointerdown', (e) => {
    if (e.target === wrap) closeSettings();
  });
  window.addEventListener('keydown', onKey, true);
  (wrap as unknown as Record<string, unknown>).__close = () => {
    window.removeEventListener('keydown', onKey, true);
    ctx.onClose();
  };
  // The account panel is one persistent element shared with the title screen:
  // appending it here moves it, it does not copy it, so its sign-in state and
  // any half-typed code survive the trip.
  const acc = ctx.account();
  if (acc) accountBox.append(acc);
  wrap.append(modal);
  document.getElementById('app')?.append(wrap) ?? document.body.append(wrap);
  renderDifficulty();
}

export function closeSettings(): void {
  for (const el of document.querySelectorAll('.settings-wrap')) {
    (el as unknown as Record<string, (() => void) | undefined>).__close?.();
    el.remove();
  }
}
