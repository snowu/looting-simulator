/**
 * Dev-only: every sprite in the game, side by side, playing the same attack
 * cadence the dungeon plays.
 *
 * Opened with F2 (or `?art`), and the whole module is behind an
 * `import.meta.env.DEV` guard at its call sites in `main.ts` — the same trick
 * the boss arena uses — so none of it, including its styles, reaches a
 * production bundle.
 *
 * Why it exists: a creature reads well or badly *next to its family*. A tell
 * that is obvious on its own is worthless if it is the same silhouette the
 * skeleton two rooms back used, and that is only ever visible on a sheet.
 * `scripts/art-sheet.mjs` writes the same sheets out as PNGs for a pull
 * request; both read `art-sheets.ts`, so they cannot drift apart.
 */
import { artSize, artUrl } from '../render/art-cache';
import { enemyPose } from '../render/enemy-pose';
import { Creature, DEFAULT_TIER, GEAR_MATERIALS, MATERIAL_TIERS, creatureStatLines, sheets } from './art-sheets';

const CSS = `
.art-sheet { position: absolute; inset: 0; background: #0b0a0dfa; overflow: auto; z-index: 60; font-family: var(--font-ui, inherit); }
.art-sheet-bar { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  padding: 6px 10px; background: #14111a; border-bottom: 1px solid #2a2430; }
.art-sheet-bar .sep { width: 1px; align-self: stretch; background: #2a2430; margin: 0 2px; }
.art-sheet-bar input { background: #0a080c; border: 1px solid #2a2430; color: #e8e0d0; font: inherit; padding: 1px 6px; width: 120px; }
.art-sheet-bar select { background: #0a080c; border: 1px solid #2a2430; color: #e8e0d0; font: inherit; padding: 1px 4px; max-width: 180px; }
.art-sheet-note { padding: 4px 12px 0; color: #8a8296; font-size: 17px; }
.art-sheet-group { padding: 8px 12px 2px; color: #9ac0ff; font-size: 20px; }
.art-sheet-grid { display: grid; gap: 4px; padding: 0 8px 8px; grid-template-columns: repeat(auto-fill, minmax(var(--cell), 1fr)); }
.art-cell { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 2px 3px; border: 1px solid #1e1a26; background: var(--sheet-bg); }
.art-cell .stage { display: grid; place-items: center; height: var(--stage); width: 100%; overflow: hidden; }
.art-cell img { image-rendering: pixelated; }
.art-cell .cap { font-size: 15px; color: #b8b0c0; text-align: center; line-height: 1.05; }
.art-cell .cap b { color: #e8e0d0; font-weight: normal; }
.art-cell .stats { font-size: 12px; color: #8a8296; text-align: center; line-height: 1.25; word-break: break-word; max-width: 100%; }
.art-cell .stats .weak { color: #ff9a7a; }
.art-cell .stats .res { color: #9ac0ff; }
.art-cell .stats .imm { color: #e8e0d0; }
.art-sheet-empty { padding: 20px; color: #8a8296; }
`;

type Bg = 'dark' | 'stone' | 'light' | 'magenta';
const BACKDROPS: Record<Bg, string> = {
  dark: '#0d0b10',
  stone: '#2a2430',
  light: '#b8b0a0',
  // The flat key colour an artist checks stray pixels against.
  magenta: '#ff00ff',
};

interface Playing {
  el: HTMLImageElement;
  creature: Creature;
  /** Staggered so the row does not swing as one block. */
  offset: number;
}

let host: HTMLElement | null = null;
let root: HTMLElement | null = null;
let raf = 0;
let state = { sheet: 'melee', zoom: 3, play: true, bg: 'dark' as Bg, filter: '', tier: DEFAULT_TIER, material: null as string | null };
let playing: Playing[] = [];

export function toggleArtSheet(into: HTMLElement): void {
  if (root) closeArtSheet();
  else openArtSheet(into);
}

export function openArtSheet(into: HTMLElement): void {
  if (root) return;
  host = into;
  if (!document.getElementById('art-sheet-css')) {
    const style = document.createElement('style');
    style.id = 'art-sheet-css';
    style.textContent = CSS;
    document.head.append(style);
  }
  root = document.createElement('div');
  root.className = 'art-sheet';
  host.append(root);
  window.addEventListener('keydown', onKey, true);
  render();
  raf = requestAnimationFrame(tick);
}

export function closeArtSheet(): void {
  if (!root) return;
  cancelAnimationFrame(raf);
  window.removeEventListener('keydown', onKey, true);
  root.remove();
  root = null;
  playing = [];
}

/**
 * The sheet eats the keyboard while it is up, so walking the dungeon behind it
 * is not possible by accident. Escape and F2 still close it.
 */
function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' || e.key === 'F2') {
    e.preventDefault();
    e.stopPropagation();
    closeArtSheet();
    return;
  }
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  const step = (d: number) => {
    e.preventDefault();
    const ids = sheets(state.tier, state.material ?? undefined).map((s) => s.id);
    const i = ids.indexOf(state.sheet);
    state.sheet = ids[(i + d + ids.length) % ids.length];
    render();
  };
  if (e.key === 'ArrowRight' || e.key === ']') step(1);
  else if (e.key === 'ArrowLeft' || e.key === '[') step(-1);
  else if (e.key === '+' || e.key === '=') { state.zoom = Math.min(8, state.zoom + 1); render(); }
  else if (e.key === '-') { state.zoom = Math.max(1, state.zoom - 1); render(); }
  else if (e.key.toLowerCase() === 'p') { state.play = !state.play; render(); }
  e.stopPropagation();
}

function el(tag: string, cls?: string, text?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function button(label: string, on: boolean, onclick: () => void): HTMLElement {
  const b = el('button', `btn small${on ? ' primary' : ''}`, label);
  b.addEventListener('click', onclick);
  return b;
}

function render(): void {
  if (!root) return;
  const all = sheets(state.tier, state.material ?? undefined);
  const active = all.find((s) => s.id === state.sheet) ?? all[0];
  playing = [];
  root.replaceChildren();
  root.style.setProperty('--sheet-bg', BACKDROPS[state.bg]);

  const bar = el('div', 'art-sheet-bar');
  for (const s of all) bar.append(button(s.title, s.id === active.id, () => { state.sheet = s.id; render(); }));
  bar.append(el('div', 'sep'));
  bar.append(button('−', false, () => { state.zoom = Math.max(1, state.zoom - 1); render(); }));
  bar.append(el('span', 'dim small', `${state.zoom}×`));
  bar.append(button('+', false, () => { state.zoom = Math.min(8, state.zoom + 1); render(); }));
  bar.append(el('div', 'sep'));
  for (const bg of Object.keys(BACKDROPS) as Bg[]) bar.append(button(bg, state.bg === bg, () => { state.bg = bg; render(); }));
  bar.append(el('div', 'sep'));
  // Gear is drawn in a material its base allows. The tier picks the best
  // material at that depth; the material switch pins the deciding crafting
  // element (the primary slot) outright, falling back to the tier pick for
  // bases that do not allow it — so a long sword never lands in shadow silk.
  if (active.id === 'icons' || active.id === 'viewmodels') {
    for (const t of MATERIAL_TIERS) {
      bar.append(button(`T${t}`, state.tier === t, () => { state.tier = t; render(); }));
    }
    const pick = document.createElement('select');
    pick.title = 'Deciding crafting material';
    const auto = document.createElement('option');
    auto.value = '';
    auto.textContent = 'Tier best';
    pick.append(auto);
    for (const m of GEAR_MATERIALS) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = `${m.name} · T${m.tier}`;
      if (state.material === m.id) opt.selected = true;
      pick.append(opt);
    }
    pick.addEventListener('change', () => { state.material = pick.value || null; render(); });
    bar.append(pick);
    bar.append(el('div', 'sep'));
  }
  bar.append(button(state.play ? 'Playing' : 'Frames', state.play, () => { state.play = !state.play; render(); }));
  const find = document.createElement('input');
  find.placeholder = 'filter';
  find.value = state.filter;
  find.addEventListener('input', () => { state.filter = find.value; render(); });
  bar.append(find);
  bar.append(el('div', 'sep'));
  bar.append(button('Close', false, () => closeArtSheet()));
  root.append(bar);
  root.append(el('div', 'art-sheet-note', `${active.note} · [ ] switch sheets, ± zoom, P play, Esc close · npm run art:sheet writes these as PNGs`));

  const match = (text: string) => !state.filter || text.toLowerCase().includes(state.filter.toLowerCase());
  const held = active.id === 'viewmodels';
  let shown = 0;
  for (const group of active.groups) {
    // Playing collapses a creature's frames into one cell that runs the whole
    // attack; holding still lays every frame out for comparison.
    const cells = state.play
      ? dedupeCreatures(group.cells)
      : group.cells;
    const visible = cells.filter((c) => match(`${c.label} ${c.id} ${c.creature ? creatureStatLines(c.creature).join(' ') : ''}`));
    if (!visible.length) continue;
    // Tall viewmodels used to be forced into a square stage, clipping the
    // gripping hand. Here zoom means an integer multiple of native pixels.
    const sizes = held ? visible.map(c => artSize(c.id)) : [];
    const hasStats = visible.some((c) => c.creature);
    const basePx = (held ? Math.max(...sizes.map(s => s.w)) : 34) * state.zoom + 24;
    // Stat lines do not scale with zoom, so creature cells get a floor width
    // that fits `HP 135 · ATK 21 · DEF 20` without wrapping every other word.
    const cellPx = hasStats && !held ? Math.max(basePx, 210) : basePx;
    const stagePx = (held ? Math.max(...sizes.map(s => s.h)) : 34) * state.zoom + (held ? 8 : 0);
    shown += visible.length;
    root.append(el('div', 'art-sheet-group', group.title));
    const grid = el('div', 'art-sheet-grid');
    grid.style.setProperty('--cell', `${cellPx}px`);
    grid.style.setProperty('--stage', `${stagePx}px`);
    for (const c of visible) {
      const cell = el('div', 'art-cell');
      const stage = el('div', 'stage');
      const img = document.createElement('img');
      img.src = artUrl(c.id, c.ramp);
      img.style.width = `${(held ? artSize(c.id).w : 32) * state.zoom}px`;
      stage.append(img);
      const cap = el('div', 'cap');
      const name = el('b', undefined, c.label);
      cap.append(name, document.createElement('br'), document.createTextNode(c.id));
      cell.append(stage, cap);
      if (c.creature) {
        if (c.creature.description) cell.title = c.creature.description;
        for (const line of creatureStatLines(c.creature)) cell.append(statLine(line));
      }
      grid.append(cell);
      if (state.play && c.creature) playing.push({ el: img, creature: c.creature, offset: playing.length * 0.37 });
    }
    root.append(grid);
  }
  if (!shown) root.append(el('div', 'art-sheet-empty', `Nothing matches “${state.filter}”.`));
}

/**
 * One stat line, with the resist/weak/immune segment tinted so a weakness
 * reads at a glance. Plain lines pass through as a single text node.
 */
function statLine(line: string): HTMLElement {
  const n = el('div', 'stats');
  const parts = line.split(' · ');
  // A plain `·`-joined line with no RES/WEAK/IMM marker needs no spans.
  if (!/^(RES|WEAK|IMM) /.test(line) && parts.length <= 1) {
    n.textContent = line;
    return n;
  }
  parts.forEach((p, i) => {
    if (i > 0) n.append(document.createTextNode(' · '));
    const m = /^(RES|WEAK|IMM) /.exec(p);
    if (!m) n.append(document.createTextNode(p));
    else {
      const s = el('span', m[1] === 'WEAK' ? 'weak' : m[1] === 'RES' ? 'res' : 'imm', p);
      n.append(s);
    }
  });
  return n;
}

/** One cell per creature when playing, keyed off the idle frame. */
function dedupeCreatures<T extends { id: string; creature?: Creature }>(cells: T[]): T[] {
  const seen = new Set<string>();
  return cells.filter((c) => {
    if (!c.creature) return true;
    if (seen.has(c.creature.sprite)) return false;
    seen.add(c.creature.sprite);
    return true;
  });
}

/**
 * One loop per creature, at its own wind-up and recovery: idle, guard (if it
 * has one), the tell, the blow, the settle.
 *
 * The lunge is toward the player, which on a flat sheet is toward the screen:
 * it is drawn as the creature growing off its own feet, not sliding sideways.
 * A shove at the camera and a step to the left are not the same tell.
 */
function tick(now: number): void {
  raf = requestAnimationFrame(tick);
  const t = now / 1000;
  for (const p of playing) {
    const c = p.creature;
    const guardFor = c.hasShield ? 0.8 : 0;
    const idle = 0.75;
    const cycle = idle + guardFor + c.windup + c.recovery;
    const at = (t + p.offset) % cycle;
    let pose;
    let windingUp = false;
    if (at < idle) pose = enemyPose({ ...poseBase(c), ai: 'chase', timer: 0, sinceStrike: Infinity });
    else if (at < idle + guardFor) pose = enemyPose({ ...poseBase(c), ai: 'chase', timer: 0, sinceStrike: Infinity, guard: 'up' });
    else if (at < idle + guardFor + c.windup) {
      windingUp = true;
      pose = enemyPose({ ...poseBase(c), ai: 'windup', timer: idle + guardFor + c.windup - at, sinceStrike: Infinity });
    } else {
      const since = at - (idle + guardFor + c.windup);
      pose = enemyPose({ ...poseBase(c), ai: 'recover', timer: c.recovery - since, sinceStrike: since });
    }
    const src = artUrl(`${c.sprite}_${pose.frame}`);
    if (p.el.src !== src) p.el.src = src;
    // The wind-up flash the renderer paints on (a red tint pulsing at 30rad/s)
    // is half the tell — a sheet without it lies about how visible the attack is.
    p.el.style.filter = windingUp ? redPulse(t) : 'none';
    const bob = c.floats ? Math.sin(t * 2.5 + p.offset) * 4 : 0;
    p.el.style.transformOrigin = '50% 100%';
    p.el.style.transform = `translateY(${bob}px) scale(${1 + pose.lunge * 0.34})`;
  }
}

/**
 * The renderer washes a wind-up with red at 0.12–0.24 alpha, pulsing at 30
 * rad/s. A filter cannot add a colour, only push the ones already there, so
 * this warms and brightens by the same amount instead. Full `sepia` was the
 * first attempt and turned a green goblin orange, which made the sheet lie
 * about the creature rather than about the tint.
 */
function redPulse(t: number): string {
  const a = 0.12 + 0.12 * Math.sin(t * 30);
  return `saturate(${1 + a * 5}) hue-rotate(-${a * 45}deg) brightness(${1 + a * 0.9})`;
}

const poseBase = (c: Creature) => ({
  hasShield: c.hasShield,
  ranged: c.ranged,
  windup: c.windup,
  recovery: c.recovery,
});
