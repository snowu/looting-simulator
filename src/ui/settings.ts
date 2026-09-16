import { GameState } from '../state/game-state';
import { DIFFICULTIES, DIFFICULTY_IDS, difficultyOf } from '../data/difficulty';
import { audio } from '../audio/sfx';
import { BRIGHTNESS_MAX, BRIGHTNESS_MIN, applyBrightnessGain, brightness, brightnessToPercent, percentToBrightness } from '../render/brightness';
import { artImg, btn, h } from './dom';

/**
 * Settings, behind the gear in the town header, on the title screen, and in
 * the dungeon HUD.
 *
 * Bleakmere shows everything: the difficulty switch, audio, and the full
 * account panel. The title screen and the dungeon show only audio and login —
 * difficulty lives in Bleakmere alone, so it can only be changed between
 * delves, never mid-run or before a save exists. The header keeps only the
 * compact sync status (or a Connect button). Same overlay pattern as the
 * patch notes: backdrop or Escape closes it.
 */

export interface SettingsCtx {
  state: () => GameState;
  save: () => void;
  toast: (text: string, color?: string) => void;
  /** The persistent account element, moved in here while open. */
  account: () => HTMLElement | null;
  /** Town refreshes behind the modal (e.g. the header sync status). */
  onClose: () => void;
  /**
   * Show the difficulty switch. True in Bleakmere, false everywhere else —
   * the title screen and the dungeon get audio + login only.
   */
  showDifficulty?: boolean;
}

/** True while the settings modal is open. The dungeon loop uses it to pause. */
export function isSettingsOpen(): boolean {
  return document.querySelector('.settings-wrap') !== null;
}

/**
 * The gear button, shared by town, title and dungeon so all three open the
 * same modal. The icon comes from the sprite sheet, not an emoji, so it reads
 * at 28px without blurring.
 */
export function settingsGearButton(onOpen: () => void, title: string, size = 28): HTMLButtonElement {
  const el = btn('', onOpen, 'small icon-btn');
  el.title = title;
  el.setAttribute('aria-label', title);
  el.append(artImg('ic_gear', undefined, size));
  return el;
}

export function openSettings(ctx: SettingsCtx): void {
  closeSettings();
  audio.play('ui');
  const showDifficulty = ctx.showDifficulty ?? true;
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

  /**
   * Volume slider plus mute toggle. Dragging the slider above zero unmutes —
   * a slider at 60 that stays silent is a bug report waiting to happen — and
   * the preview blip fires on release, not on every tick, so dragging does
   * not stutter the very thing being adjusted.
   */
  function audioBox(): HTMLElement {
    const muteBtn = btn(audio.muted ? '🔇 Muted' : '🔊 Sound on', () => {
      audio.unlock();
      audio.toggleMute();
      syncAudio();
      audio.play('ui');
    }, 'small');
    const pct = h('span', { class: 'dim small audio-pct' });
    const slider = h('input', {
      class: 'audio-slider',
      attrs: { type: 'range', min: '0', max: '100', step: '1', value: String(Math.round(audio.volume * 100)) },
    }) as HTMLInputElement;
    slider.title = 'Volume';
    slider.setAttribute('aria-label', 'Volume');

    function syncAudio(): void {
      slider.value = String(Math.round(audio.volume * 100));
      pct.textContent = audio.muted ? 'Muted' : `${slider.value}%`;
      muteBtn.textContent = audio.muted ? '🔇 Muted' : '🔊 Sound on';
      muteBtn.classList.toggle('primary', !audio.muted);
    }

    slider.addEventListener('input', () => {
      audio.unlock();
      audio.setVolume(Number(slider.value) / 100);
      if (Number(slider.value) > 0 && audio.muted) audio.setMuted(false);
      syncAudio();
    });
    slider.addEventListener('change', () => audio.play('ui'));
    syncAudio();
    return h(
      'div',
      {},
      h('h3', { style: 'margin-top:10px', text: 'Audio' }),
      h('div', { class: 'audio-row' }, muteBtn, slider, pct),
    );
  }

  /**
   * Display brightness: a gamma lift on the 3D view, live as you drag.
   * The strip below is the AAA calibration pattern in miniature — drag until
   * the left square is barely visible and the middle one is clear. That lands
   * the black level for *this* screen in *this* light, which is the whole
   * point: brightness is a property of the device and the room, so it is
   * stored on the device (like volume) and never in the save. Cosmetic only:
   * it moves no fog plane and grants no light radius.
   */
  function displayBox(): HTMLElement {
    const pct = h('span', { class: 'dim small audio-pct' });
    const slider = h('input', {
      class: 'audio-slider',
      attrs: {
        type: 'range',
        min: String(Math.round(BRIGHTNESS_MIN * 100)),
        max: String(Math.round(BRIGHTNESS_MAX * 100)),
        step: '1',
        value: String(brightnessToPercent(brightness.get())),
      },
    }) as HTMLInputElement;
    slider.title = 'Brightness';
    slider.setAttribute('aria-label', 'Brightness');
    const resetBtn = btn('Reset', () => {
      brightness.reset();
      syncDisplay();
    }, 'small');
    // Near-black, dark, mid: the curve pins 0 and 1 and moves these.
    const bases = [0.015, 0.06, 0.16];
    const swatches = bases.map((g) => h('div', { class: 'brightness-swatch' }));
    const strip = h('div', { class: 'brightness-calib' }, ...swatches);

    function paintSwatches(b: number): void {
      swatches.forEach((el, i) => {
        const g = Math.round(applyBrightnessGain(bases[i], b) * 255);
        el.style.background = `rgb(${g},${g},${g})`;
        el.title = `Reference ${(bases[i] * 100).toFixed(1)}% grey → ${Math.round((g / 255) * 100)}% on this setting`;
      });
    }

    function syncDisplay(): void {
      const b = brightness.get();
      slider.value = String(brightnessToPercent(b));
      pct.textContent = `${slider.value}%`;
      resetBtn.disabled = brightnessToPercent(b) === 100;
      paintSwatches(b);
    }

    slider.addEventListener('input', () => {
      brightness.set(percentToBrightness(Number(slider.value)));
      syncDisplay();
    });
    syncDisplay();
    return h(
      'div',
      {},
      h('h3', { style: 'margin-top:10px', text: 'Display' }),
      h('div', { class: 'audio-row' }, resetBtn, slider, pct),
      strip,
      h('p', {
        class: 'dim small',
        text: 'Drag until the left square is barely visible. Display only — no extra light radius, no easier fights. Stored on this device.',
      }),
    );
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
    ...(showDifficulty ? [difficultyBox] : []),
    audioBox(),
    displayBox(),
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
  if (showDifficulty) renderDifficulty();
}

export function closeSettings(): void {
  for (const el of document.querySelectorAll('.settings-wrap')) {
    // Remove first, then run the close callback: on the title screen onClose
    // re-enters the title, which itself calls closeSettings — if the wrap were
    // still attached that would recurse forever and the modal would never go
    // away.
    el.remove();
    (el as unknown as Record<string, (() => void) | undefined>).__close?.();
  }
}
