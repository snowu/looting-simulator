import { RunSummary } from '../state/game-state';
import { findOath } from '../data/oaths';
import { gold, h, itemSlot, btn } from './dom';
import { patchNotesButton } from './patch-notes';
import { settingsGearButton } from './settings';

const titleTaglines = [
  'Every treasure has a body count',
  'Fortune favors the prepared',
  'Delve Deep. Die Rich.',
];
const titleTagline = titleTaglines[Math.floor(Math.random() * titleTaglines.length)];

export function titleScreen(slots: HTMLElement, build = '', account?: HTMLElement, dev?: HTMLElement | null, onSettings?: () => void): HTMLElement {
  const controls = h('details', { class: 'title-controls' },
    h('summary', { text: 'How to survive' }),
    h('div', { class: 'help' },
      ...[['W / S', 'step'], ['A / D', 'turn'], ['Q / E', 'strafe'], ['Space · LMB', 'attack'], ['Shift · RMB', 'block / parry'], ['F', 'interact'], ['I · M', 'pack / map']].map(([key, label]) =>
        h('div', {}, h('kbd', { text: key }), label)),
    ),
    h('p', { text: 'Touch controls on mobile. Controllers welcome.' }),
  );
  return h('div', { class: 'title-screen' },
    h('div', { class: 'title-layout' },
      h('header', { class: 'title-hero' },
        h('div', { class: 'title-eyebrow', text: 'A dungeon crawler of risk & riches' }),
        h('h1', {}, h('span', { text: 'Looting' }), h('span', { text: 'Simulator' })),
        h('div', { class: 'prepare', text: 'Prepare to die' }),
        h('p', { class: 'tag', text: titleTagline }),
        h('div', { class: 'title-rule' }),
        h('p', { class: 'title-intro', text: 'The dark is full of fortune. Take what you can. Make it home.' }),
      ),
      h('section', { class: 'title-panel', attrs: { 'aria-label': 'Choose your save' } },
        h('div', { class: 'title-section-head' }, h('h2', { text: 'Choose your story' }), h('span', { text: '03 SAVE SLOTS' })),
        slots,
        account ?? null,
        controls,
        dev ?? null,
      ),
      h('footer', { class: 'title-footer' },
        h('span', { class: 'title-scene-label', text: '◆  Somewhere beneath Bleakmere' }),
        h('span', { text: 'Sound on. Lights off.' }),
        build ? h('span', { class: 'title-build', text: `v${build.replace(/^v/, '')}` }) : null,
      ),
    ),
    onSettings ? h('div', { class: 'corner-gear' }, settingsGearButton(onSettings, 'Settings — sound, cloud saves')) : null,
    h('div', { class: 'patch-corner' }, patchNotesButton()),
  );
}

export function summaryScreen(sum: RunSummary, onContinue: () => void): HTMLElement {
  const home = sum.outcome === 'extracted';
  // A Hardcore death ends the playthrough, so nothing comes home, no new day
  // dawns for this hero, and the way out leads back to the title.
  const fallen = !!sum.fallen;
  return h(
    'div',
    { class: 'town' },
    h(
      'div',
      { class: `summary frame${home ? ' gold' : ''}` },
      h('h1', {
        text: home ? (sum.bossKilled ? 'Kingslayer' : sum.dayTurned ? 'Home Alive' : 'Turned Back') : fallen ? 'Fallen' : 'Slain',
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
      fallen ? h('p', { class: 'red-t', text: 'Hardcore: there was only one life. This hero is dead for good, and the save stays as their headstone.' }) : null,
      sum.oaths ? oathsLine(sum.oaths) : sum.oath ? oathLine(sum.oath) : null,
      sum.seals ? h('p', { style: 'color:#c080ff', text: `Under ${sum.seals.count} Ashen Seal${sum.seals.count === 1 ? '' : 's'}.${sum.seals.record ? ' A new record: the King slain under more Seals than ever before.' : ''}` }) : null,
      sum.keptPack ? h('p', { style: 'color:#9ab8ff', text: 'Normal: your pack came home with you. Only a tenth of the coin you carried was lost.' }) : null,
      sum.graveDepth ? h('p', { style: 'color:#9ab8ff', text: sum.keptPack
        ? `The coin you dropped waits at depth ${sum.graveDepth}, held by your Shade.`
        : `What you lost waits at depth ${sum.graveDepth}, held by your Shade. Go back for it before you fall again.` }) : null,
      sum.items.length && !fallen ? h('h3', { text: home ? 'Brought home' : sum.keptPack ? 'Carried home' : 'Saved by the Soul Pouch' }) : null,
      sum.items.length && !fallen ? h('div', { class: 'items' }, ...sum.items.map((it) => itemSlot(it, { size: 44 }))) : null,
      sum.lost.length ? h('h3', { class: 'red-t', text: 'Lost in the dark' }) : null,
      sum.lost.length ? h('div', { class: 'items', style: 'opacity:0.6' }, ...sum.lost.map((it) => itemSlot(it, { size: 44 }))) : null,
      fallen ? null : h('p', {
        class: 'dim',
        style: 'margin:10px 0',
        text: sum.dayTurned
          ? 'A new day dawns. Prices have moved and the guild has posted new work.'
          : 'Still the same day in Bleakmere: the same prices, the same work on the board. Renown and a turn of the day are for those who actually go down.',
      }),
      btn(fallen ? 'Back to the title' : 'Back to town', onContinue, 'primary big'),
    ),
  );
}

/** How the delve's oath ended, on the results screen. */
function oathLine(o: { id: string; kept: boolean; renown: number }): HTMLElement | null {
  const def = findOath(o.id);
  if (!def) return null;
  return h('p', {
    style: `color:${o.kept ? def.color : '#9a9aa8'}`,
    text: o.kept
      ? o.renown
        ? `Oath kept: ${def.name}. You have learned every inscription, so it pays ${o.renown} renown instead.`
        : `Oath kept: ${def.name}. ${def.tier === 'hard' ? 'Two inscriptions wait' : 'An inscription waits'} for you in Bleakmere: choose from three.`
      : `Oath broken: ${def.name}. It costs you nothing but the reward.`,
  });
}

/** How the delve's oaths ended, on the results screen. */
function oathsLine(o: { results: { id: string; kept: boolean }[]; picks: number; renown: number; bonus: boolean }): HTMLElement {
  const parts = o.results.map((r) => `${findOath(r.id)?.name ?? r.id} ${r.kept ? 'kept' : 'broken'}`);
  const pay = o.picks
    ? ` ${o.picks} inscription${o.picks === 1 ? '' : 's'} wait${o.picks === 1 ? 's' : ''} for you in Bleakmere${o.bonus ? ', one of them for keeping every oath' : ''}.`
    : o.renown ? ` You know every inscription, so they pay ${o.renown} renown instead.` : ' They cost you nothing but the reward.';
  return h('p', { style: `color:${o.results.some((r) => r.kept) ? '#e0c060' : '#9a9aa8'}`, text: `Oaths: ${parts.join(', ')}.${pay}` });
}
