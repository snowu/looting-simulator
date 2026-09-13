import { DEFAULT_CRIT_MULT, ELEMENTS, EquipSlot, EQUIP_SLOTS, Item, RARITY_COLORS, STAT_KEYS, STAT_LABELS, Stats, slotOf } from '../types';
import { consumable, itemBase } from '../data/items';
import { material } from '../data/materials';
import { affix } from '../data/affixes';
import { masteryBonus, recipe } from '../data/recipes';
import { durability, isIdentified, itemCraftRank, itemIcon, itemName, itemRarity, itemStats, itemValue, uniqueOf } from '../systems/items';
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

export function artImg(id: string, ramp?: Ramp, size = 32): HTMLImageElement {
  const img = h('img', { class: 'px', attrs: { src: artUrl(id, ramp), width: String(size), height: String(size), alt: '' } });
  return img;
}

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

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

export function isDetailed(): boolean {
  return detailed;
}

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
  weapon: 'Weapon', offhand: 'Shield', head: 'Head', body: 'Body', hands: 'Hands', ring: 'Ring', amulet: 'Amulet',
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
      if (mat) lines.push(`<div class="tt-dim">${mat.name}${item.secondaryId ? ` & ${material(item.secondaryId).name}` : ''} · quality ${Math.round((item.quality ?? 1) * 100)}%</div>`);
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
      if (d.broken) lines.push(`<div class="tt-warn">Worn out — a quarter of its worth until the smith sees it.</div>`);
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

/** Equipment slot an item would go into (ring → first free ring slot). */
export function targetSlot(item: Item, eq: Record<EquipSlot, Item | null>): EquipSlot | null {
  if (item.kind !== 'equipment') return null;
  const slot = itemBase(item.ref).slot;
  if (slot === 'ring') return !eq.ring1 ? 'ring1' : !eq.ring2 ? 'ring2' : 'ring1';
  return EQUIP_SLOTS.find((s) => slotOf(s) === slot) ?? null;
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
