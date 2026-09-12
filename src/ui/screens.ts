import { RunSummary } from '../state/game-state';
import { gold, h, itemSlot, btn } from './dom';

export function titleScreen(slots: HTMLElement, build = '', account?: HTMLElement): HTMLElement {
  return h(
    'div',
    { class: 'title-screen' },
    h(
      'div',
      { class: 'frame', style: 'padding:18px 36px 24px' },
      h('h1', { text: 'Looting Simulator' }),
      h('div', { class: 'tag', text: 'Go down. Bring it back. Sell it high.' }),
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
      account ?? null,
      build ? h('p', { class: 'faint small', text: `build ${build}` }) : null,
    ),
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
