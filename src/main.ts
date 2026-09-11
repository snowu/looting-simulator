import './style.css';
import { createRng, randomSeed } from './core/rng';
import { DX, DY, turnRight } from './core/dir';
import { GameState, newGame } from './state/game-state';
import { clearSave, loadGame, saveGame } from './state/persistence';
import { startRun, endRun } from './systems/run';
import { biomeForDepth } from './data/biomes';
import { World, WorldEvent } from './world/world';
import { DungeonRenderer } from './render/dungeon-renderer';
import { artUrl, loadArtOverrides } from './render/art-cache';
import { Hud } from './ui/hud';
import { DungeonOverlays } from './ui/dungeon-ui';
import { Town } from './ui/town';
import { summaryScreen, titleScreen } from './ui/screens';
import { h } from './ui/dom';
import { audio } from './audio/sfx';

type Mode = 'title' | 'town' | 'dungeon' | 'summary';

const AMBIENT: Record<string, [number, number]> = { crypt: [55, 0.3], mines: [49, 0.5], caverns: [62, 0.75], throne: [41, 0.4] };

// --- State ---------------------------------------------------------------------
let state: GameState = loadGame() ?? newGame(createRng(randomSeed()));
let world: World | null = null;
let mode: Mode = 'title';
let saveTimer = 0;
let ending: { outcome: 'dead' | 'extracted'; t: number } | null = null;

// --- DOM -----------------------------------------------------------------------
const app = document.getElementById('app')!;
document.documentElement.style.setProperty('--frame', `url(${artUrl('ui_frame')})`);
document.documentElement.style.setProperty('--frame-gold', `url(${artUrl('ui_frame_gold')})`);

const canvas = h('canvas', { attrs: { id: 'view' } });
app.append(canvas);
const renderer = new DungeonRenderer(canvas);
const hud = new Hud(app);
const toastLayer = h('div', { class: 'layer', style: 'pointer-events:none' });
const screen = h('div', { class: 'layer' });
app.append(screen);
const overlays = new DungeonOverlays(app, (t, c) => hud.message(t, c));
app.append(toastLayer);

const town = new Town(screen, {
  state: () => state,
  save: () => saveGame(state),
  descend: () => enterDungeon(),
  newGame: () => {
    clearSave();
    state = newGame(createRng(randomSeed()));
    saveGame(state);
    town.tab = 'market';
    town.render();
  },
  toast,
});

function toast(text: string, color = '#e8dcc4'): void {
  const el = h('div', {
    text,
    style: `position:absolute;left:50%;top:${14 + toastLayer.childElementCount * 30}px;transform:translateX(-50%);color:${color};` +
      'font-size:22px;text-shadow:0 2px 0 #000,0 0 8px #000;background:#0e0c10dd;padding:2px 12px;border:1px solid #2a2430;white-space:nowrap;transition:opacity .5s',
  });
  toastLayer.append(el);
  setTimeout(() => (el.style.opacity = '0'), 2200);
  setTimeout(() => el.remove(), 2800);
}

// --- Modes ---------------------------------------------------------------------
function show(m: Mode): void {
  mode = m;
  hud.visible = m === 'dungeon';
  canvas.style.visibility = m === 'dungeon' ? 'visible' : 'hidden';
  town.visible = m === 'town';
  if (m !== 'dungeon') overlays.close();
}

function enterTitle(): void {
  show('title');
  screen.replaceChildren(titleScreen(!!loadGame(), () => {
    audio.unlock();
    audio.play('ui');
    enterTown();
  }));
}

function enterTown(): void {
  audio.stopAmbient();
  screen.replaceChildren(town.root);
  show('town');
  town.render();
}

function startAmbient(): void {
  if (!world) return;
  const [hz, br] = AMBIENT[biomeForDepth(world.run.depth).id] ?? [50, 0.4];
  audio.startAmbient(hz, br);
}

function enterDungeon(): void {
  audio.unlock();
  if (!state.run || state.run.outcome !== 'active') startRun(state);
  world = new World(state);
  renderer.deathFade = 0;
  ending = null;
  hud.clearLog();
  screen.replaceChildren();
  show('dungeon');
  renderer.resize();
  saveGame(state);
  startAmbient();
  hud.message(`Depth ${world.run.depth} — ${biomeForDepth(world.run.depth).name}. The torch gutters.`, '#d8c8a8');
  if (state.lifetime.runs <= 1) hud.message('Press Esc for controls. Find loot, then get it back up the stairs.', '#a0a090');
}

function finishRun(outcome: 'dead' | 'extracted'): void {
  const summary = endRun(state, outcome);
  saveGame(state);
  world = null;
  audio.stopAmbient();
  show('summary');
  screen.replaceChildren(summaryScreen(summary, () => enterTown()));
}

// --- World events --------------------------------------------------------------
function handle(ev: WorldEvent): void {
  const w = world!;
  switch (ev.type) {
    case 'msg':
      hud.message(ev.text, ev.color);
      break;
    case 'sfx': {
      if (ev.x === undefined || ev.y === undefined) {
        audio.play(ev.name);
        break;
      }
      const dx = ev.x - w.player.x, dy = ev.y - w.player.y;
      const dist = Math.hypot(dx, dy);
      const r = turnRight(w.player.facing);
      const pan = dist > 0 ? (dx * DX[r] + dy * DY[r]) / dist : 0;
      audio.play(ev.name, { pan: pan * 0.8, volume: 1 / (1 + dist * 0.3) });
      break;
    }
    case 'hurt':
      renderer.onHurt(ev.amount, ev.blocked);
      break;
    case 'float':
      hud.float(ev.x, ev.y, ev.text, ev.color);
      break;
    case 'shake':
      renderer.onShake(ev.amount);
      break;
    case 'loot':
      overlays.open('loot', w, ev.pickupId);
      break;
    case 'floor':
      saveGame(state);
      startAmbient();
      break;
    case 'end':
      ending = { outcome: ev.outcome, t: 0 };
      saveGame(state);
      break;
    case 'secret':
      break;
  }
}

// --- Loop ------------------------------------------------------------------------
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (mode === 'dungeon' && world) {
    const paused = overlays.isOpen;
    if (!paused) world.update(dt);
    for (const ev of world.drainEvents()) handle(ev);
    if (ending) {
      ending.t += dt;
      if (ending.outcome === 'dead') renderer.deathFade = Math.min(1, ending.t / 1.8);
      if (ending.t > (ending.outcome === 'dead' ? 2.4 : 0.6)) {
        const o = ending.outcome;
        ending = null;
        finishRun(o);
        requestAnimationFrame(frame);
        return;
      }
    }
    if (world) {
      renderer.render(world, paused ? 0 : dt);
      hud.update(world, renderer, dt);
      saveTimer += dt;
      if (saveTimer > 15) {
        saveTimer = 0;
        saveGame(state);
      }
    }
  }
  requestAnimationFrame(frame);
}

// --- Input -----------------------------------------------------------------------
const MOVES: Record<string, Parameters<World['press']>[0]> = {
  w: 'forward', arrowup: 'forward', s: 'back', arrowdown: 'back', a: 'left', d: 'right',
  q: 'turnLeft', arrowleft: 'turnLeft', e: 'turnRight', arrowright: 'turnRight',
};

window.addEventListener('keydown', (e) => {
  audio.unlock();
  if (mode !== 'dungeon' || !world) return;
  if (overlays.handleKey(e)) {
    e.preventDefault();
    return;
  }
  const k = e.key.toLowerCase();
  if (ending) return;
  if (MOVES[k]) {
    e.preventDefault();
    if (!e.repeat) world.press(MOVES[k]);
    return;
  }
  switch (k) {
    case ' ':
      e.preventDefault();
      if (!e.repeat) world.attack();
      break;
    case 'shift':
      world.setBlock(true);
      break;
    case 'f':
    case 'enter':
      world.interact();
      break;
    case 'i':
    case 'tab':
      e.preventDefault();
      overlays.toggle('inventory', world);
      break;
    case 'm':
      overlays.toggle('map', world);
      break;
    case 'escape':
    case 'h':
      overlays.toggle('help', world);
      break;
    case '1':
    case '2':
    case '3':
    case '4':
      world.quickUse(Number(k) - 1);
      break;
  }
});

window.addEventListener('keyup', (e) => {
  if (!world) return;
  const k = e.key.toLowerCase();
  if (MOVES[k]) world.release(MOVES[k]);
  if (k === 'shift') world.setBlock(false);
});

canvas.addEventListener('mousedown', (e) => {
  audio.unlock();
  if (!world || overlays.isOpen) return;
  if (e.button === 0) world.attack();
  if (e.button === 2) world.setBlock(true);
});
window.addEventListener('mouseup', (e) => {
  if (world && e.button === 2) world.setBlock(false);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('blur', () => world?.held.clear());
window.addEventListener('resize', () => renderer.resize());
window.addEventListener('beforeunload', () => saveGame(state));

// --- Boot ------------------------------------------------------------------------
void loadArtOverrides().then((n) => {
  if (n) console.info(`Loaded ${n} hand-drawn art override(s).`);
});

const params = new URLSearchParams(location.search);
if (params.has('autostart')) {
  enterTown();
  if (params.get('autostart') === 'dungeon') enterDungeon();
} else {
  enterTitle();
}
requestAnimationFrame(frame);

// Handy for debugging and headless playtests.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__game = {
    get state() { return state; },
    get world() { return world; },
    get mode() { return mode; },
    enterDungeon,
    enterTown,
  };
}
