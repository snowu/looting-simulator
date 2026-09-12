import { DEFAULT_CRIT_MULT, ELEMENTS, EquipSlot, EQUIP_SLOTS, Item, RARITY_COLORS, STAT_KEYS, STAT_LABELS, Stats, slotOf } from '../types';
import { consumable, itemBase } from '../data/items';
import { material } from '../data/materials';
import { affix } from '../data/affixes';
import { masteryBonus, recipe } from '../data/recipes';
import { durability, isIdentified, itemCraftRank, itemIcon, itemName, itemRarity, itemStats, itemValue } from '../systems/items';
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
    if (!(e.target as Element | null)?.closest?.('.slot')) {
      armed = null;
      hideTooltip();
    }
  },
  true,
);

function tooltipNear(el: HTMLElement, html: string): void {
  const r = el.getBoundingClientRect();
  showTooltip(html, r.right - 10, r.top - 10);
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
        tooltipNear(el, tipFn());
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

let tipEl: HTMLElement | null = null;
function tip(): HTMLElement {
  if (!tipEl) {
    tipEl = h('div', { class: 'tooltip frame' });
    document.body.append(tipEl);
  }
  return tipEl;
}

export function showTooltip(html: string, x: number, y: number): void {
  const t = tip();
  t.innerHTML = touchMode ? html.replace(/Right-click/g, 'Long-press').replace(/Click/g, 'Tap again') : html;
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
  el.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && showTooltip(content(), e.clientX, e.clientY));
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
      const d = durability(item);
      if (d.wears) {
        const pct = Math.round(d.frac * 100);
        const tone = d.broken ? '#ff7070' : d.frac <= 0.25 ? '#e8c060' : '#8a8f9a';
        lines.push(
          `<div class="tt-dur"><span style="color:${tone}">${d.broken ? 'Broken' : `Condition ${pct}%`}</span>` +
            `<i class="dur-bar"><b style="width:${pct}%;background:${tone}"></b></i></div>`,
        );
      }
      lines.push(...statLines(itemStats(item), opts.compare ? itemStats(opts.compare) : undefined));
      if (d.broken) lines.push(`<div class="tt-warn">Worn out — a quarter of its worth until the smith sees it.</div>`);
      if (!isIdentified(item)) lines.push(`<div class="tt-warn">Unidentified — ${item.affixes?.length ?? 0} hidden propert${item.affixes?.length === 1 ? 'y' : 'ies'}</div>`);
      else for (const a of item.affixes ?? []) {
        const def = affix(a.id);
        lines.push(`<div class="tt-affix ${elementClass(STAT_LABELS[def.stat])}">${esc(def.name)}: +${a.value} ${STAT_LABELS[def.stat]}</div>`);
      }
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
      lines.push(`<div class="tt-sub">${c.rarity} consumable</div><div class="tt-desc">${esc(c.description)}</div>`);
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
