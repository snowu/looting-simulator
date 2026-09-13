import { RunSummary } from '../state/game-state';
import { artImg, gold, h, itemSlot, btn } from './dom';
import { patchNotesButton } from './patch-notes';

const titleTaglines = [
  'Every treasure has a body count',
  'Fortune favors',
  'Delve Deep. Die Rich.',
];
const titleTagline = titleTaglines[Math.floor(Math.random() * titleTaglines.length)];

/**
 * The account panel's home on the title screen. Opening settings appends that
 * same element into the modal, which *moves* it — so closing puts it back
 * here. A named container means the restore does not have to know where in
 * the panel it sat.
 */
export const TITLE_ACCOUNT_SLOT = 'title-account';

export interface TitleOpts {
  build?: string;
  account?: HTMLElement;
  dev?: HTMLElement | null;
  /** Opens the settings modal. Omitted, the gear is not drawn. */
  onSettings?: () => void;
}

export function titleScreen(slots: HTMLElement, opts: TitleOpts = {}): HTMLElement {
  const { build = '', account, dev, onSettings } = opts;
  return h(
    'div',
    { class: 'title-screen' },
    onSettings
      ? h('div', { class: 'title-gear' }, h('button', {
          class: 'btn small icon-btn',
          title: 'Settings — cloud saves',
          onclick: () => onSettings(),
        }, artImg('ic_gear', undefined, 28)))
      : null,
    h(
      'div',
      { class: 'frame title-panel' },
      h('h1', { text: 'Looting Simulator' }),
      h('div', { class: 'prepare', text: 'Prepare To Die' }),
      h('div', { class: 'tag', text: titleTagline }),
      slots,
      h(
        'div',
        { class: 'help', style: 'margin-top:22px' },
        h('div', {}, h('kbd', { text: 'W / S' }), 'step'),
        h('div', {}, h('kbd', { text: 'A / D' }), 'turn'),
        h('div', {}, h('kbd', { text: 'Q / E' }), 'strafe'),
        h('div', {}, h('kbd', { text: 'Space · LMB' }), 'attack'),
        h('div', {}, h('kbd', { text: 'Shift · RMB' }), 'block · time it to parry'),
        h('div', {}, h('kbd', { text: 'F' }), 'interact'),
        h('div', {}, h('kbd', { text: 'I · M' }), 'pack · map'),
      ),
      h('p', { class: 'dim small', style: 'margin-top:14px', text: 'Sound on. Best with headphones and the lights off.' }),
      h('div', { class: TITLE_ACCOUNT_SLOT }, account ?? null),
      dev ?? null,
      build ? h('p', { class: 'faint small', text: `build ${build}` }) : null,
    ),
    h('div', { class: 'patch-corner' }, patchNotesButton()),
  );
}

export function summaryScreen(sum: RunSummary, onContinue: () => void): HTMLElement {
  const home = sum.outcome === 'extracted';
  return h(
    'div',
    { class: 'town' },
    h(
      'div',
      { class: `summary frame${home ? ' gold' : ''}` },
      h('h1', {
        text: home ? (sum.bossKilled ? 'Kingslayer' : sum.dayTurned ? 'Home Alive' : 'Turned Back') : 'Slain',
        style: home ? '' : 'color:#d0443a',
      }),
      h('p', {
        class: 'dim',
        text: !home
          ? `Fell at depth ${sum.depth}${sum.killedBy ? `, killed by ${sum.killedBy}` : ''}.`
          : sum.dayTurned
            ? `You climbed out of depth ${sum.depth} on day ${sum.day}.`
            : 'You barely crossed the threshold before turning round.',
      }),
      h(
        'div',
        { class: 'row', style: 'justify-content:center;gap:40px;margin:14px 0' },
        h('div', {}, h('div', { class: 'big-num gold-t', text: gold(sum.gold) }), h('div', { class: 'dim', text: 'coin banked' })),
        h('div', {}, h('div', { class: 'big-num violet-t', text: `✦ ${sum.renown}` }), h('div', { class: 'dim', text: 'renown' })),
        h('div', {}, h('div', { class: 'big-num', text: String(sum.kills) }), h('div', { class: 'dim', text: 'slain' })),
      ),
      sum.items.length ? h('h3', { text: home ? 'Brought home' : 'Saved by the Soul Pouch' }) : null,
      sum.items.length ? h('div', { class: 'items' }, ...sum.items.map((it) => itemSlot(it, { size: 44 }))) : null,
      sum.lost.length ? h('h3', { class: 'red-t', text: 'Lost in the dark' }) : null,
      sum.lost.length ? h('div', { class: 'items', style: 'opacity:0.6' }, ...sum.lost.map((it) => itemSlot(it, { size: 44 }))) : null,
      h('p', {
        class: 'dim',
        style: 'margin:10px 0',
        text: sum.dayTurned
          ? 'A new day dawns. Prices have moved and the guild has posted new work.'
          : 'Still the same day in Bleakmere: the same prices, the same work on the board. Renown and a turn of the day are for those who actually go down.',
      }),
      btn('Back to town', onContinue, 'primary big'),
    ),
  );
}
