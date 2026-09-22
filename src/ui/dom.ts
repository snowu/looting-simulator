import { DEFAULT_CRIT_MULT, ELEMENTS, Item, RARITY_COLORS, STAT_KEYS, STAT_LABELS, Stats } from '../types';
import { findProperty } from '../data/properties';
import { consumable, itemBase } from '../data/items';
import { material } from '../data/materials';
import { affix } from '../data/affixes';
import { masteryBonus, recipe } from '../data/recipes';
import { findSigil } from '../data/spells';
import { HELP, HelpId } from '../data/help';
import { durability, isIdentified, itemCraftRank, itemIcon, itemName, itemRarity, itemStats, itemValue, thrownCapacity, uniqueOf } from '../systems/items';
import { artUrl } from '../render/art-cache';
import type { Ramp } from '../art/raster';

type Child = Node | string | number | null | undefined | false;

export interface Props {
  class?: string;
  text?: string;
  html?: string;
  title?: string;
  style?: string;
  onclick?: (e: MouseEvent) => void;
  attrs?: Record<string, string>;
  disabled?: boolean;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  if (props.html !== undefined) el.innerHTML = props.html;
  if (props.title) el.title = props.title;
  if (props.style) el.setAttribute('style', props.style);
  if (props.onclick) el.addEventListener('click', props.onclick as EventListener);
  if (props.disabled) (el as HTMLButtonElement).disabled = true;
  for (const [k, v] of Object.entries(props.attrs ?? {})) el.setAttribute(k, v);
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'number' ? String(c) : c);
  }
  return el;
}

export function btn(label: string, onclick: () => void, cls = '', disabled = false): HTMLButtonElement {
  return h('button', { class: `btn ${cls}`, text: label, onclick: () => onclick(), disabled });
}

// ---------------------------------------------------------------------------
// Pane help ("?" system).
// ---------------------------------------------------------------------------
//
// Panes with a paragraph of explanation (the Oath Stone's "today's oaths..."
// blurb was the first) keep the text behind a "?" button in the pane header,
// hidden by default, so repeat visits don't spend the room on words already
// read. One click expands it inline, with a separator between the text and
// the pane body.
//
// Content lives in the registry (`HELP` in `src/data/help.ts`), keyed by a
// stable id — never inline in UI code. Open/closed state lives in a
// module-level map keyed by the same id, so it survives re-renders (which
// rebuild every element) without touching save data: it is a UI preference,
// not game state, and resets with the page.
//
// To adopt it in another pane (future PRs welcome):
//   1. Add the pane's entry to `HELP` (title + body).
//   2. Put `helpButton(ID, () => this.render())` beside the pane's `h3`,
//      inside a `.pane-head` row. Play the 'ui' blip in the callback, the way
//      the pane's other toggles do.
//   3. Put `helpBlock(ID)` where the description used to be.
// That is the whole contract: the button flips the map and re-renders, the
// block renders only while open. `h()` already skips the nulls, so the call
// sites stay flat.
//
// Future direction: a full game-guide modal rendering every `HELP` entry,
// where a pane's "?" jumps straight to its entry and highlights it. The
// registry is already that modal's table of contents, and the open-behavior
// is centralized in `helpButton`, so that PR only adds presentation — these
// call sites won't change.

/** Open/closed help by pane id. Absent means closed: help is hidden by default. */
const helpOpenState = new Map<string, boolean>();

/** Whether a pane's help is currently expanded. */
export function helpOpen(id: string): boolean {
  return helpOpenState.get(id) ?? false;
}

/** Set a pane's help open or closed. The caller re-renders. */
export function setHelpOpen(id: string, open: boolean): void {
  helpOpenState.set(id, open);
}

/** The "?" button for a pane header. `rerender` is the pane owner's render. */
export function helpButton(id: HelpId, rerender: () => void): HTMLButtonElement {
  const open = helpOpen(id);
  return h('button', {
    class: `btn small help-btn${open ? ' on' : ''}`,
    text: '?',
    title: open ? 'Hide the explanation' : 'What is this?',
    onclick: () => { setHelpOpen(id, !open); rerender(); },
  });
}

/**
 * A pane's help block: its registry body, then a separator between the text
 * and the pane body. Null while its "?" is closed.
 */
export function helpBlock(id: HelpId): HTMLElement | null {
  const entry = HELP[id];
  if (!entry || !helpOpen(id)) return null;
  return h('div', { class: 'col' },
    h('p', { class: 'dim small', text: entry.body }),
    h('hr', { class: 'pane-sep' }),
  );
}

export function artImg(id: string, ramp?: Ramp, size = 32): HTMLImageElement {
  const img = h('img', { class: 'px', attrs: { src: artUrl(id, ramp), width: String(size), height: String(size), alt: '' } });
  return img;
}

import { esc } from '../core/escape';
export { esc };

export function gold(n: number): string {
  return `${Math.floor(n).toLocaleString()}g`;
}

export function rarityColor(item: Item): string {
  return RARITY_COLORS[itemRarity(item)];
}

// ---------------------------------------------------------------------------
// Touch: first tap shows the tooltip, second tap acts; long-press = right-click.
// ---------------------------------------------------------------------------

let touchMode = false;
let armed: HTMLElement | null = null;

export function setTouchMode(on: boolean): void {
  touchMode = on;
  document.body.classList.toggle('touch', on);
}

export function isTouchMode(): boolean {
  return touchMode;
}

document.addEventListener(
  'pointerdown',
  (e) => {
    if (!touchMode) return;
    const el = e.target as Element | null;
    // The tooltip is the detail switch under a finger, so a tap on it is not a
    // tap away from the item — dismissing here would eat the toggle.
    if (!el?.closest?.('.slot') && !el?.closest?.('.tooltip')) {
      armed = null;
      hideTooltip();
    }
  },
  true,
);

function tooltipNear(el: HTMLElement, content: () => string): void {
  const r = el.getBoundingClientRect();
  liveTip = content;
  showTooltip(content(), r.right - 10, r.top - 10);
}

function addLongPress(el: HTMLElement): void {
  let timer = 0;
  let sx = 0, sy = 0;
  const cancel = () => clearTimeout(timer);
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    sx = e.clientX;
    sy = e.clientY;
    timer = window.setTimeout(() => {
      el.dataset.longpress = '1';
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: sx, clientY: sy }));
    }, 520);
  });
  el.addEventListener('pointermove', (e) => {
    if (Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel();
  });
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
}

/** An inventory slot: icon, quantity badge, rarity-tinted frame. */
export function itemSlot(
  item: Item | null,
  opts: { size?: number; onclick?: (e: MouseEvent) => void; tip?: () => string; placeholder?: string; selected?: boolean; instant?: boolean } = {},
): HTMLElement {
  const size = opts.size ?? 40;
  const el = h('div', { class: `slot${item ? '' : ' empty'}${opts.selected ? ' selected' : ''}`, style: `--sz:${size}px` });
  if (item) {
    const ic = itemIcon(item);
    el.style.setProperty('--rc', rarityColor(item));
    el.append(artImg(ic.icon, ic.ramp, size - 8));
    if (item.qty > 1) el.append(h('span', { class: 'qty', text: String(item.qty) }));
    if (item.kind === 'equipment' && item.identified === false) el.append(h('span', { class: 'unid', text: '?' }));
  } else if (opts.placeholder) {
    el.append(h('span', { class: 'ph', text: opts.placeholder }));
  }
  const tipFn = opts.tip ?? (item ? () => itemTooltip(item) : undefined);
  el.addEventListener('click', (e) => {
    if (el.dataset.longpress) {
      delete el.dataset.longpress;
      return;
    }
    if (touchMode && tipFn && !(opts.instant && opts.onclick)) {
      if (armed !== el || !opts.onclick) {
        armed = el;
        tooltipNear(el, tipFn);
        return;
      }
      armed = null;
      hideTooltip();
    }
    opts.onclick?.(e);
  });
  if (item) addLongPress(el);
  if (tipFn) bindTooltip(el, tipFn);
  return el;
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

/**
 * Detail mode.
 *
 * An item says what it does in plain words, because that is what makes it
 * feel like an object in a dungeon rather than a row in a spreadsheet. Hold
 * Shift — or tap the tooltip, on a screen with no Shift — and it says the same
 * thing in numbers. Neither register is the "real" one; some decisions want
 * the sentence and some want the figure.
 *
 * The flag lives here rather than in each screen so one keypress re-renders
 * whatever tooltip happens to be open, without anything else having to know.
 */
let detailed = false;
let liveTip: (() => string) | null = null;

export function setDetailed(on: boolean): void {
  if (detailed === on) return;
  detailed = on;
  // A body class lets any screen that is already on-screen swap register with
  // no re-render at all — see .detail-only / .detail-hide in style.css. The
  // tooltip is rebuilt instead, because its content is a string, not a tree.
  document.body.classList.toggle('detail-mode', on);
  if (liveTip && tipEl && tipEl.style.display === 'block') renderTip(liveTip());
}

/** For the touchscreen affordance on screens that are not tooltips. */
export function toggleDetailed(): void {
  setDetailed(!detailed);
}

/**
 * Both registers of a piece of text, rendered together, with CSS deciding which
 * one is visible. Screens use this so Shift costs nothing to honour.
 */
export function bothRegisters(plain: string, numbers: string, cls = ''): HTMLElement {
  return h('div', {},
    h('div', { class: `${cls} detail-hide`.trim(), text: plain }),
    h('div', { class: `${cls} detail-only`.trim(), text: numbers }),
  );
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') setDetailed(true);
});
document.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') setDetailed(false);
});
// Shift held while the window loses focus would otherwise stick on forever.
window.addEventListener('blur', () => setDetailed(false));

let tipEl: HTMLElement | null = null;
function tip(): HTMLElement {
  if (!tipEl) {
    tipEl = h('div', { class: 'tooltip frame' });
    // Under a finger there is no Shift, so the tooltip itself is the switch.
    tipEl.addEventListener('click', (e) => {
      e.stopPropagation();
      setDetailed(!detailed);
    });
    document.body.append(tipEl);
  }
  return tipEl;
}

function renderTip(html: string): void {
  const t = tip();
  t.innerHTML = touchMode ? html.replace(/Right-click/g, 'Long-press').replace(/Click/g, 'Tap again') : html;
}

export function showTooltip(html: string, x: number, y: number): void {
  const t = tip();
  renderTip(html);
  t.style.display = 'block';
  moveTooltip(x, y);
}

export function moveTooltip(x: number, y: number): void {
  const t = tip();
  const r = t.getBoundingClientRect();
  const nx = x + 18 + r.width > window.innerWidth ? x - r.width - 12 : x + 18;
  const ny = Math.min(window.innerHeight - r.height - 6, Math.max(6, y + 12));
  t.style.left = `${Math.max(6, nx)}px`;
  t.style.top = `${ny}px`;
}

export function hideTooltip(): void {
  if (tipEl) tipEl.style.display = 'none';
}

export function bindTooltip(el: HTMLElement, content: () => string): void {
  // Hover tooltips are mouse-only; touch uses tap-to-arm in itemSlot.
  el.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    liveTip = content;
    showTooltip(content(), e.clientX, e.clientY);
  });
  el.addEventListener('pointermove', (e) => e.pointerType === 'mouse' && moveTooltip(e.clientX, e.clientY));
  el.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && hideTooltip());
}

// ---------------------------------------------------------------------------
// Item descriptions
// ---------------------------------------------------------------------------

const SLOT_LABEL: Record<string, string> = {
  weapon: 'Weapon', offhand: 'Shield', thrown: 'Thrown', head: 'Head', body: 'Body', hands: 'Hands', ring: 'Ring', amulet: 'Amulet',
};

export function statLines(s: Stats, compare?: Stats): string[] {
  const out: string[] = [];
  for (const k of STAT_KEYS) {
    const v = s[k];
    const c = compare?.[k] ?? 0;
    if (!v && !c) continue;
    let diff = '';
    if (compare) {
      const d = v - c;
      if (d) diff = ` <span class="${d > 0 ? 'up' : 'down'}">(${d > 0 ? '+' : ''}${d})</span>`;
    }
    out.push(`<div class="stat${ELEMENTS.includes(k as (typeof ELEMENTS)[number]) ? ` element-${k}` : ''}">${v >= 0 ? '+' : ''}${v} ${STAT_LABELS[k]}${diff}</div>`);
  }
  return out;
}

/** Whether this item has anything extra to say when the reader asks for numbers. */
function hasDetail(item: Item): boolean {
  if (uniqueOf(item) && isIdentified(item)) return true;
  return item.kind === 'equipment' && durability(item).wears;
}

export interface TipOpts {
  compare?: Item | null;
  price?: { label: string; value: number };
  hint?: string;
  forgeEffect?: string;
}

export function itemTooltip(item: Item, opts: TipOpts = {}): string {
  const color = rarityColor(item);
  const lines: string[] = [`<div class="tt-name" style="color:${color}">${esc(itemName(item))}${item.qty > 1 ? ` ×${item.qty}` : ''}</div>`];
  switch (item.kind) {
    case 'equipment': {
      const base = itemBase(item.ref);
      const mat = item.materialId ? material(item.materialId) : null;
      const rank = itemCraftRank(item);
      lines.push(`<div class="tt-sub">${itemRarity(item)} ${SLOT_LABEL[base.slot]}${base.damageType ? ` · ${base.damageType}` : ''}${item.crafted ? ` · crafted Rank ${rank}` : ''}</div>`);
      if (base.twoHanded) {
        lines.push('<div class="tt-warn">Two-handed — your off hand must be empty.</div>');
        lines.push('<div class="tt-dim detail-only">Block 20% (a shield gives 35–90%). Parry timing and effect are unchanged.</div>');
      }
      if (base.thrown) {
        const t = base.thrown;
        lines.push(`<div class="tt-dim">Throw ${t.range} tiles · ${(t.windup + t.recovery).toFixed(2)}s · ${t.staminaCost} stamina · stock ${thrownCapacity(item)}</div>`);
        lines.push(`<div class="tt-dim detail-only">At point-blank or with no ammunition, uses the melee swing below. Retrieve landed ammunition with R.</div>`);
      }
      if (mat) {
        const names = [mat.id, item.secondaryId, item.secondary2Id].filter((id): id is string => !!id).map(id => material(id).name);
        lines.push(`<div class="tt-dim">${esc(names.join(' & '))} · quality ${Math.round((item.quality ?? 1) * 100)}%</div>`);
      }
      if (item.crafted && masteryBonus(rank) > 0) lines.push(`<div class="tt-dim">Recipe mastery: +${Math.round(masteryBonus(rank) * 100)}% core stats and durability</div>`);
      if (base.swing) {
        const crit = base.swing.critMult && base.swing.critMult !== DEFAULT_CRIT_MULT
          ? ` · crits ×${base.swing.critMult}`
          : '';
        lines.push(`<div class="tt-dim">Reach ${base.swing.reach} · swing ${(base.swing.windup + base.swing.recovery).toFixed(2)}s · ${base.swing.staminaCost} stamina${crit}</div>`);
      }
      // The effect comes before the numbers: it is the reason to want the thing.
      const unique = uniqueOf(item);
      if (unique && isIdentified(item)) {
        lines.push(`<div class="tt-unique">${esc(detailed ? unique.detail : unique.rule)}</div>`);
        lines.push(`<div class="tt-flavour">${esc(unique.flavour)}</div>`);
      }
      const property = findProperty(item.property);
      if (property) {
        lines.push(`<div class="tt-unique" style="color:${property.color}">${esc(property.name)}: ${esc(detailed ? property.detail : property.rule)}</div>`);
      }
      const d = durability(item);
      if (d.wears) {
        const pct = Math.round(d.frac * 100);
        const tone = d.broken ? '#ff7070' : d.frac <= 0.25 ? '#e8c060' : '#8a8f9a';
        const label = d.broken ? 'Broken' : detailed ? `Condition ${d.cur} / ${d.max}` : `Condition ${pct}%`;
        lines.push(
          `<div class="tt-dur"><span style="color:${tone}">${label}</span>` +
            `<i class="dur-bar"><b style="width:${pct}%;background:${tone}"></b></i></div>`,
        );
      }
      lines.push(...statLines(itemStats(item), opts.compare ? itemStats(opts.compare) : undefined));
      if (d.broken) lines.push(`<div class="tt-warn">Worn out — 15% of its stats until the smith sees it.</div>`);
      if (unique && !d.wears) lines.push(`<div class="tt-dim">Never needs mending.</div>`);
      if (!isIdentified(item)) {
        lines.push(`<div class="tt-warn">Unidentified — ${item.affixes?.length ?? 0} hidden propert${item.affixes?.length === 1 ? 'y' : 'ies'}. Its powers are unknown and it cannot be worn.</div>`);
      } else for (const a of item.affixes ?? []) {
        const def = affix(a.id);
        lines.push(`<div class="tt-affix ${elementClass(STAT_LABELS[def.stat])}">${esc(def.name)}: +${a.value} ${STAT_LABELS[def.stat]}</div>`);
      }
      if (detailed) lines.push(`<div class="tt-dim">Item level ${item.ilvl ?? 0} · quality ${((item.quality ?? 1) * 100).toFixed(0)}% · base value ${itemValue(item)}g</div>`);
      if (opts.compare) lines.push(`<div class="tt-dim">Compared with: ${esc(itemName(opts.compare))}</div>`);
      break;
    }
    case 'material': {
      const m = material(item.ref);
      lines.push(`<div class="tt-sub">${m.rarity} ${m.category} · tier ${m.tier}</div>`);
      lines.push(`<div class="tt-desc">${esc(m.description)}</div>`);
      if (m.category !== 'gem' && m.category !== 'valuable') {
        const bonus = STAT_KEYS.filter(k => m.mods[k]).map(k => `+${m.mods[k]} ${STAT_LABELS[k]}`).join(', ');
        lines.push(`<div class="tt-affix">Material bonus: ${esc(bonus)} · primary or secondary</div>`);
      }
      if (opts.forgeEffect) {
        const [name, tier, ...effects] = opts.forgeEffect.split(' · ');
        const effectLines = effects.flatMap((effect) => effect.split(', '));
        lines.push(
          `<div class="tt-forge"><span>${esc([name, tier].filter(Boolean).join(' · '))}</span>` +
            effectLines.map((effect) => `<span class="tt-forge-effect ${elementClass(effect)}">${esc(effect)}</span>`).join('') +
          `</div>`,
        );
      }
      break;
    }
    case 'consumable': {
      const c = consumable(item.ref);
      const relic = uniqueOf(item);
      lines.push(`<div class="tt-sub">${c.rarity} consumable</div>`);
      if (relic) {
        lines.push(`<div class="tt-unique">${esc(detailed ? relic.detail : relic.rule)}</div>`);
        lines.push(`<div class="tt-flavour">${esc(relic.flavour)}</div>`);
      } else {
        lines.push(`<div class="tt-desc">${esc(c.description)}</div>`);
      }
      break;
    }
    case 'blueprint': {
      const r = recipe(item.ref);
      lines.push(`<div class="tt-sub">Blueprint</div><div class="tt-desc">Unlocks or advances ${itemBase(r.baseId).name} mastery up to Rank 5.</div>`);
      lines.push(`<div class="tt-dim">${r.slots.map((s) => `${s.qty}× ${s.label}${s.optional ? ' (optional)' : ''}`).join(' · ')}</div>`);
      break;
    }
    case 'sigil': {
      const s = findSigil(item.ref);
      if (s) {
        lines.push('<div class="tt-sub">Uninscribed sigil</div>');
        lines.push(`<div class="tt-desc">${esc(s.description)}</div>`);
        lines.push(`<div class="tt-dim">Cast ${s.cast.toFixed(2)}s · ${s.stamina} stamina · ${s.cooldown}s cooldown</div>`);
      }
      break;
    }
  }
  if (opts.price) lines.push(`<div class="tt-price">${opts.price.label}: <b>${gold(opts.price.value)}</b></div>`);
  else lines.push(`<div class="tt-dim">Worth about ${gold(itemValue(item) * item.qty)}</div>`);
  if (opts.hint) lines.push(`<div class="tt-hint">${opts.hint}</div>`);
  // Only worth prompting where there is a second register to switch to.
  if (hasDetail(item)) {
    lines.push(`<div class="tt-detail-hint">${detailed
      ? (touchMode ? 'Tap again for plain words' : 'Release Shift for plain words')
      : (touchMode ? 'Tap this box for exact numbers' : 'Hold Shift for exact numbers')}</div>`);
  }
  return lines.join('');
}

function elementClass(text: string): string {
  const lower = text.toLowerCase();
  const element = ELEMENTS.find((candidate) => lower.includes(candidate));
  return element ? `element-${element}` : '';
}

export function sparkline(values: number[], w = 90, hgt = 22, color = '#e8b84a'): HTMLCanvasElement {
  const c = h('canvas', { class: 'spark', attrs: { width: String(w), height: String(hgt) } });
  const ctx = c.getContext('2d')!;
  if (values.length < 2) return c;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = Math.round((i / (values.length - 1)) * (w - 2)) + 1;
    const y = Math.round(hgt - 2 - ((v - min) / span) * (hgt - 4)) + 0.5;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  const last = values[values.length - 1];
  ctx.fillStyle = '#fff';
  ctx.fillRect(w - 3, Math.round(hgt - 2 - ((last - min) / span) * (hgt - 4)) - 1, 2, 2);
  return c;
}

type Closable = HTMLElement & { __close?: () => void };

/**
 * Mount a modal overlay on the app. Escape and a press on the backdrop both
 * call `close`. Escape is caught in the capture phase so the dungeon's own key
 * handler never sees it. `onClosed` runs once the overlay is taken down by
 * `closeOverlays`.
 */
export function mountOverlay(wrap: HTMLElement, close: () => void, onClosed?: () => void): void {
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  wrap.addEventListener('pointerdown', (e) => {
    if (e.target === wrap) close();
  });
  window.addEventListener('keydown', onKey, true);
  (wrap as Closable).__close = () => {
    window.removeEventListener('keydown', onKey, true);
    onClosed?.();
  };
  document.getElementById('app')?.append(wrap) ?? document.body.append(wrap);
}

/** Take down every overlay matching `selector` that `mountOverlay` put up. */
export function closeOverlays(selector: string): void {
  for (const el of document.querySelectorAll<Closable>(selector)) {
    // Remove first, then run the close callback: on the title screen the
    // settings' onClose re-enters the title, which itself closes settings — if
    // the wrap were still attached that would recurse forever and the modal
    // would never go away.
    el.remove();
    el.__close?.();
  }
}
