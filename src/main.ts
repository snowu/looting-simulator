import './style.css';
import { createRng, randomSeed } from './core/rng';
import { DX, DY, turnRight } from './core/dir';
import { GameState, newGame } from './state/game-state';
import { SLOTS, Slot, clearSave, lastSlot, loadGame, renameSave, saveGame, setLastSlot, setScratchMode } from './state/persistence';
import { sanitizeSaveName, serializeSave } from './state/save-format';
import { startRun, endRun, bankCarriedGold } from './systems/run';
import { biomeForFloor } from './data/biomes';
import { World, WorldEvent } from './world/world';
import { DungeonRenderer } from './render/dungeon-renderer';
import { artUrl, loadArtOverrides } from './render/art-cache';
import { Hud } from './ui/hud';
import { DungeonOverlays } from './ui/dungeon-ui';
import { Town } from './ui/town';
import { summaryScreen, titleScreen } from './ui/screens';
import { DifficultyId } from './data/difficulty';
import { AccountPanel } from './ui/account';
import { saveChooser } from './ui/save-chooser';
import { SlotView, slotPicker } from './ui/slots';
import { CloudSync } from './cloud/sync';
import { CloudFetch, CloudSave, deleteCloudSave, fetchCloudSave, fetchCloudSlots, uploadSave } from './cloud/cloud-save';
import { h, setTouchMode } from './ui/dom';
import { TouchControls, TouchMove, isTouchDevice } from './ui/touch';
import { FULLSCREEN_HELP, fullscreenSupported, isFullscreen, isStandalone, mountFullscreenButton, toggleFullscreen } from './ui/fullscreen';
import { BUILD_ID, newerBuild, reloadToLatest } from './ui/update';
import { btn } from './ui/dom';
import { audio } from './audio/sfx';

type Mode = 'title' | 'town' | 'dungeon' | 'summary';

const AMBIENT: Record<string, [number, number]> = { crypt: [55, 0.3], mines: [49, 0.5], caverns: [62, 0.75], sporegrove: [62, 0.75], throne: [41, 0.4] };

// --- State ---------------------------------------------------------------------
// The playthrough in front of the player. Each slot is a separate game with
// its own local key and its own cloud row.
let slot: Slot = lastSlot();
const loaded = loadGame(slot);
// Whether this browser already held progress for this slot decides, later,
// whether a cloud save is a question for the player or simply the only save
// there is.
let hadLocalSave = loaded !== null;
let state: GameState = loaded ?? newGame(createRng(randomSeed()));
let signedIn = false;
let cloudSlots = new Map<Slot, CloudFetch>();
let world: World | null = null;
let mode: Mode = 'title';
let saveTimer = 0;
// Next cave drip in the Sunken Catacombs. Reckoned in real seconds so the
// roof keeps dripping while a panel is open — ambience does not pause.
let dripTimer = 3;
let ending: { outcome: 'dead' | 'extracted'; t: number } | null = null;

// --- DOM -----------------------------------------------------------------------
const overrideCount = await loadArtOverrides();
if (overrideCount) console.info(`Loaded ${overrideCount} hand-drawn art override(s).`);

const app = document.getElementById('app')!;
document.documentElement.style.setProperty('--frame', `url(${artUrl('ui_frame')})`);
document.documentElement.style.setProperty('--frame-gold', `url(${artUrl('ui_frame_gold')})`);

const canvas = h('canvas', { attrs: { id: 'view' } });
app.append(canvas);
const renderer = new DungeonRenderer(canvas);
// A watched drop is heard when it lands, not while it is still falling.
// Drops only ever fall in the catacombs (the pool clears on floor changes),
// so a landing always means water below — and it gets the wet impact voice,
// not the glassy distant plink.
renderer.onDripLand = () => {
  if (mode !== 'dungeon' || !world) return;
  if (biomeForFloor(world.floor).id !== 'catacombs') return;
  audio.play('plop', {
    volume: 0.35 + Math.random() * 0.45,
    pan: Math.random() * 1.2 - 0.6,
    rate: 0.9 + Math.random() * 0.3,
  });
};
renderer.onLavaSound = ({ name, x, z }) => {
  if (mode !== 'dungeon' || !world || world.floor.biome !== 'emberworks') return;
  const dx = x - renderer.camera.position.x, dz = z - renderer.camera.position.z;
  const distance = Math.hypot(dx, dz);
  const pan = (dx * Math.cos(world.anim.yaw) + dz * Math.sin(world.anim.yaw)) / Math.max(1, distance);
  audio.play(name, { volume: 0.75 / (1 + distance * 0.16), pan: pan * 0.8 });
};
const hud = new Hud(app, { interact: () => world?.interact(), quick: (i) => world?.quickUse(i) });

let touchMode = isTouchDevice();
let touchAttack = false;
setTouchMode(touchMode);
let stickDir: TouchMove | null = null;
const touch = new TouchControls(app, {
  move: (d) => {
    if (stickDir) world?.release(stickDir);
    stickDir = d;
    if (d) world?.press(d);
  },
  hurl: () => world?.hurl(),
  retrieve: (held) => world?.retrieve(held),
  sigil: () => world?.castSigil(),
  tap: () => {
    if (!world) return;
    if (world.contextAction().kind === 'interact') world.interact();
    else world.attack();
  },
  action: (on) => {
    if (!on) {
      touchAttack = false;
      return;
    }
    if (!world) return;
    if (world.contextAction().kind === 'interact') world.interact();
    else {
      touchAttack = true;
      world.attack();
    }
  },
  block: (on) => world?.setBlock(on),
  open: (m) => world && overlays.toggle(m, world),
});
// Hybrid devices: switch to touch controls the first time a finger lands.
window.addEventListener('touchstart', () => {
  if (touchMode) return;
  touchMode = true;
  setTouchMode(true);
  touch.visible = mode === 'dungeon';
}, { passive: true });
const toastLayer = h('div', { class: 'layer', style: 'pointer-events:none' });
const screen = h('div', { class: 'layer' });
app.append(screen);
const overlays = new DungeonOverlays(app, (t, c) => hud.message(t, c));
app.append(toastLayer);
// Always-available fullscreen toggle, pinned above every screen and panel.
mountFullscreenButton(app, () => toast(FULLSCREEN_HELP));

// --- Updates (installed apps have no reload button) ----------------------------
let pendingUpdate: string | null = null;
const updateBanner = h('div', { class: 'update-banner frame gold' });
updateBanner.hidden = true;
app.append(updateBanner);

function renderUpdateBanner(): void {
  // Never interrupt a run; the banner waits for town or the title screen.
  updateBanner.hidden = !pendingUpdate || mode === 'dungeon';
  if (!pendingUpdate) return;
  const id = pendingUpdate;
  updateBanner.replaceChildren(
    h('span', { text: 'A new version is out.' }),
    btn('Update now', () => {
      commit();
      void reloadToLatest(id);
    }, 'small primary'),
  );
}

async function checkForUpdate(): Promise<void> {
  const id = await newerBuild();
  if (!id || id === pendingUpdate) return;
  pendingUpdate = id;
  renderUpdateBanner();
}

const town = new Town(screen, {
  state: () => state,
  save: () => commit(),
  descend: () => enterDungeon(),
  // Deferred: the panel is created below, after the town it renders into.
  account: () => account.el,
  accountSummary: () => account.summary,
  newGame: () => {
    clearSave(slot);
    state = newGame(createRng(randomSeed()));
    hadLocalSave = true;
    commit();
    // A reset has to reach the server. Otherwise the old snapshot is still up
    // there, with a higher generation, ready to come back on the next reload.
    flushSync();
    town.tab = 'market';
    town.render();
  },
  toast,
});

/**
 * Save locally, then let the cloud catch up in its own time. Every existing
 * save point goes through here, so marking the snapshot dirty can never be
 * forgotten, and a cloud failure can never stop a local save from landing.
 */
/**
 * The dev boss arena runs on a throwaway game that must never reach the
 * player's slot — it hands out endgame gear and maxed renown, and writing that
 * over a real save would be exactly the thing this project never does. Set
 * once, cleared by reloading the page.
 */
let devScratch = false;

/**
 * The current slot was deleted from the title screen. Nothing may be written
 * back to it until a slot is entered again — otherwise the next autosave or
 * unload would resurrect a fresh game in the slot just emptied.
 */
let slotDeleted = false;

function commit(): void {
  if (devScratch || slotDeleted) return;
  saveGame(state, slot);
  hadLocalSave = true;
  sync.touch();
}

/** Never push a scratch game to the cloud either. */
function flushSync(): void {
  if (!devScratch) sync.flush();
}

function toast(text: string, color = '#e8dcc4'): void {
  const el = h('div', {
    text,
    style: `position:absolute;left:50%;top:${14 + toastLayer.childElementCount * 30}px;transform:translateX(-50%);color:${color};` +
      'font-size:clamp(15px,2.4vw,22px);text-shadow:0 2px 0 #000,0 0 8px #000;background:#0e0c10ee;padding:2px 12px;border:1px solid #2a2430;' +
      'max-width:92vw;width:max-content;text-align:center;z-index:9;transition:opacity .5s',
  });
  toastLayer.append(el);
  const life = Math.max(2200, text.length * 55);
  setTimeout(() => (el.style.opacity = '0'), life);
  setTimeout(() => el.remove(), life + 600);
}

// --- Modes ---------------------------------------------------------------------
function show(m: Mode): void {
  mode = m;
  hud.visible = m === 'dungeon';
  touch.visible = m === 'dungeon' && touchMode;
  touchAttack = false;
  stickDir = null;
  canvas.style.visibility = m === 'dungeon' ? 'visible' : 'hidden';
  town.visible = m === 'town';
  if (m !== 'dungeon') overlays.close();
  renderUpdateBanner();
}

const sync = new CloudSync({
  state: () => state,
  slot: () => slot,
  hasLocalSave: () => hadLocalSave,
  onStatus: (_status, text) => account.setNote(text),
  onConflict: () => void raiseConflict(),
});

// One panel for the life of the page: it holds the auth subscription and the
// stage of a half-finished sign-in, neither of which should be thrown away
// every time the title screen is rebuilt.
const account = new AccountPanel({
  onSignedIn: () => void afterSignIn(),
  onSignedOut: () => {
    signedIn = false;
    cloudSlots = new Map();
    sync.reset();
    dismissChooser();
    pendingChoice = null;
    if (mode === 'title') enterTitle();
  },
});

/**
 * A session arrived. Learn what is in each slot so the title can show it, then
 * settle the slot actually being played.
 */
async function afterSignIn(): Promise<void> {
  signedIn = true;
  try {
    cloudSlots = await fetchCloudSlots();
  } catch {
    cloudSlots = new Map();
  }
  if (mode === 'title') enterTitle();
  else await reconcile();
}

/** A cloud save waiting for the player to choose, once it is safe to ask. */
let pendingChoice: CloudSave | null = null;

/**
 * A conflict found while playing rather than at sign-in. Uploads are already
 * barred at this point, so the only thing missing is the other candidate.
 */
async function raiseConflict(): Promise<void> {
  if (pendingChoice) return;
  try {
    const found = await fetchCloudSave(slot);
    if (found.kind === 'save') {
      pendingChoice = found.save;
      askAboutSaves();
    }
  } catch {
    // Offline. The conflict is still blocking uploads and will resurface.
  }
}
let chooserEl: HTMLElement | null = null;

async function reconcile(): Promise<void> {
  if (!signedIn) return;
  const result = await sync.begin();
  if (result.kind === 'take-cloud') installCloud(result.save);
  else if (result.kind === 'choose') {
    pendingChoice = result.save;
    askAboutSaves();
  }
}

/**
 * Ask which save to keep — but only from town or the title screen. A `World`
 * holds direct references to the running `GameState`, so replacing it mid-delve
 * would tear the run in half. The question simply waits.
 */
function askAboutSaves(): void {
  if (!pendingChoice || chooserEl || world || mode === 'dungeon') return;
  const cloud = pendingChoice;
  chooserEl = saveChooser({
    local: state,
    cloud: cloud.state,
    cloudUpdatedAt: cloud.updatedAt,
    onKeepLocal: () => {
      dismissChooser();
      pendingChoice = null;
      void sync.keepLocal();
    },
    onTakeCloud: () => {
      dismissChooser();
      pendingChoice = null;
      installCloud(cloud);
    },
    // Offline for now: nothing is uploaded and nothing is replaced. The
    // question comes back the next time town or the title is reached.
    onDismiss: () => dismissChooser(),
  });
  app.append(chooserEl);
}

function dismissChooser(): void {
  chooserEl?.remove();
  chooserEl = null;
}

/** Adopt the cloud snapshot as the game being played. Never during a run. */
function installCloud(save: CloudSave): void {
  if (world) return;
  slot = save.slot;
  setLastSlot(slot);
  state = save.state;
  hadLocalSave = true;
  slotDeleted = false;
  // Adopting a cloud save also leaves the scratch game behind, if we were in one.
  devScratch = false;
  setScratchMode(false);
  saveGame(state, slot);
  cloudSlots.set(save.slot, { kind: 'save', save });
  sync.adopt(save);
  // A snapshot taken mid-delve resumes in the dungeon, never in town: arriving
  // in Bleakmere with a run open is a free portal trip — stash, market and all.
  if (state.run?.outcome === 'active') {
    enterDungeon();
    toast('Cloud save loaded.', '#9ac0ff');
    return;
  }
  if (mode === 'town') {
    town.tab = 'stash';
    town.render();
  } else {
    enterTitle();
  }
  toast('Cloud save loaded.', '#9ac0ff');
}

function slotViews(): SlotView[] {
  return SLOTS.map((n) => {
    const found = cloudSlots.get(n);
    return {
      slot: n,
      local: loadGame(n),
      cloud: found?.kind === 'save' ? found.save : null,
      cloudUnreadable: found?.kind === 'incompatible',
    };
  });
}

/**
 * The dev-only door to the throne room. `import.meta.env.DEV` is replaced with
 * `false` at build time, so this collapses to `null` and the button does not
 * exist in a real build — the same trick the animation bench in town uses.
 */
function devTitleTools(): HTMLElement | null {
  if (!import.meta.env.DEV) return null;
  return h(
    'div',
    { class: 'dev-tools' },
    h('span', { class: 'dim small grow', text: 'Dev build only' }),
    btn('Art sheet', () => void openArtSheet(), 'small'),
    btn('Lab', () => void enterLabArena(), 'small primary'),
    btn('Fight the King', () => void enterBossArena(), 'small'),
    btn('Melee', () => void enterMeleeRoom(), 'small'),
    btn('Archers', () => void enterArcherRoom(), 'small'),
  );
}

/**
 * The art sheet, on F2 from anywhere. Dynamically imported behind the same
 * `import.meta.env.DEV` guard as the boss arena, so the tool and its styles
 * are dropped from a real build.
 */
async function openArtSheet(): Promise<void> {
  if (!import.meta.env.DEV) return;
  const { toggleArtSheet } = await import('./dev/art-sheet');
  toggleArtSheet(app);
}

function enterTitle(): void {
  show('title');
  screen.replaceChildren(titleScreen(slotPicker(slotViews(), enterSlot, {
    onRename: (n, name) => void renameSlot(n, name),
    onDelete: (n) => void deleteSlot(n),
  }), BUILD_ID, account.el, devTitleTools()));
  askAboutSaves();
}

/**
 * Rename the save in a slot. The name travels with the save like any other
 * field, so the ordinary upload path carries it to the cloud — except a slot
 * that is not being played has no sync coordinator watching it, and its
 * renamed snapshot is pushed directly at the generation already known.
 */
async function renameSlot(n: Slot, name: string): Promise<void> {
  const clean = sanitizeSaveName(name);
  // What the card was showing: the local game first, the cloud one otherwise.
  const found = cloudSlots.get(n);
  const cloudSave = found?.kind === 'save' ? found.save : null;
  let base = renameSave(n, clean);
  if (!base) {
    if (!cloudSave) return;
    // A slot that lives only in the cloud: bring it down, name it, keep it.
    base = cloudSave.state;
    base.name = clean;
    saveGame(base, n);
  }
  if (n === slot) {
    state.name = clean;
    commit();
  } else if (signedIn && cloudSave) {
    try {
      const res = await uploadSave(cloudSave.slot, base, cloudSave.generation);
      if (res.status === 'ok' || res.status === 'unchanged') {
        cloudSlots.set(cloudSave.slot, {
          kind: 'save',
          save: { ...cloudSave, state: base, generation: res.generation, updatedAt: res.updatedAt, raw: serializeSave(base) },
        });
      }
    } catch {
      // Offline. The renamed save is on this device and goes up the next time
      // the slot is played and sync runs.
    }
  }
  enterTitle();
  toast(clean ? `Save named "${clean}".` : `Back to Slot ${n}.`, '#9ac0ff');
}

/**
 * Delete the save in a slot, on this device and in the cloud. Only the
 * playthrough the card was showing goes: a different game shadowed in the
 * same cloud slot is left alone.
 */
async function deleteSlot(n: Slot): Promise<void> {
  const local = loadGame(n);
  const found = cloudSlots.get(n);
  const cloudSave = found?.kind === 'save' ? found.save : null;
  if (!local && !cloudSave) return;
  const saveId = local?.saveId ?? cloudSave?.saveId ?? null;
  clearSave(n);
  // The same playthrough can surface under another slot number when devices
  // file it differently; drop every cached sighting so no ghost card remains.
  if (saveId) {
    for (const [key, entry] of cloudSlots) {
      if (entry.kind === 'save' && entry.save.saveId === saveId) cloudSlots.delete(key);
    }
  } else {
    cloudSlots.delete(n);
  }
  if (signedIn) {
    try {
      await deleteCloudSave(n, saveId);
    } catch {
      toast('Deleted on this device. The cloud copy stays until you are back online.', '#e8c060');
    }
  }
  if (n === slot) {
    // The game in front of the player is gone: forget it, or the next
    // autosave would write it straight back into the emptied slot.
    state = newGame(createRng(randomSeed()));
    hadLocalSave = false;
    slotDeleted = true;
    sync.switchSlot();
    dismissChooser();
    pendingChoice = null;
  } else if (pendingChoice && saveId && pendingChoice.saveId === saveId) {
    dismissChooser();
    pendingChoice = null;
  }
  enterTitle();
  toast(`Slot ${n} deleted.`, '#e08080');
}

/**
 * Open a playthrough. Everything that describes one game — the state, whether
 * this device had it, and the cloud generation the coordinator is replacing —
 * belongs to the slot, so all of it is swapped here and nowhere else.
 */
function enterSlot(n: Slot, difficulty?: DifficultyId): void {
  audio.unlock();
  audio.play('ui');
  // On phones and tablets, starting the game is the gesture that takes us fullscreen.
  if (touchMode && fullscreenSupported() && !isStandalone() && !isFullscreen()) void toggleFullscreen();

  slot = n;
  setLastSlot(n);
  sync.switchSlot();
  dismissChooser();
  pendingChoice = null;
  slotDeleted = false;

  const existing = loadGame(n);
  hadLocalSave = existing !== null;
  state = existing ?? newGame(createRng(randomSeed()));
  // Only a brand-new game takes the difficulty from the card. An existing save
  // carries its own, and the card offers no choice over it.
  if (!existing && difficulty) state.difficulty = difficulty;
  // A slot that only exists in the cloud is settled by reconcile() below, which
  // is why nothing is written here for an empty one until then.
  if (existing) commit();

  // A save taken mid-delve resumes in the dungeon, never in town. Landing in
  // Bleakmere with a run open is a free town portal: the stash, the market and
  // the forge are all reachable with the backpack still on, so anything carried
  // can be made safe before the delve gets dangerous.
  if (state.run?.outcome === 'active') {
    enterDungeon();
  } else {
    enterTown();
  }
  void reconcile();
}

function enterTown(): void {
  audio.stopAmbient();
  screen.replaceChildren(town.root);
  show('town');
  town.render();
  askAboutSaves();
}

function startAmbient(): void {
  if (!world) return;
  const [hz, br] = AMBIENT[biomeForFloor(world.floor).id] ?? [50, 0.4];
  audio.startAmbient(hz, br);
}

function enterDungeon(): void {
  audio.unlock();
  if (!state.run || state.run.outcome !== 'active') startRun(state);
  const portal = state.run!.portal;
  if (portal) {
    // Back out the way you came, onto the portal's own tile, and it collapses.
    state.run!.depth = portal.depth;
    state.run!.player.x = portal.x;
    state.run!.player.y = portal.y;
  }
  world = new World(state);
  if (portal) world.closeTownPortal();
  renderer.deathFade = 0;
  ending = null;
  hud.clearLog();
  screen.replaceChildren();
  show('dungeon');
  renderer.resize();
  commit();
  startAmbient();
  hud.message(`Depth ${world.run.depth} — ${biomeForFloor(world.floor).name}. The torch gutters.`, '#d8c8a8');
  if (portal) hud.message('The portal closes behind you.', '#9ac0ff');
  if (state.lifetime.runs <= 1) {
    hud.message(
      touchMode
        ? 'Drag up/down to walk, left/right to turn. Tap to swing or loot. Get the loot back up the stairs.'
        : 'Press Esc for controls. Find loot, then get it back up the stairs.',
      '#a0a090',
    );
  }
}

/** Through a town portal: the run stays open and the portal stays put. */
function returnToTown(): void {
  const banked = bankCarriedGold(state);
  commit();
  flushSync();
  world = null;
  audio.stopAmbient();
  town.tab = 'stash';
  enterTown();
  toast(banked > 0 ? `Home through the portal. ${banked} gold banked.` : 'Home through the portal.', '#9ac0ff');
}

function finishRun(outcome: 'dead' | 'extracted'): void {
  const summary = endRun(state, outcome);
  commit();
  flushSync();
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
    case 'sigil':
      renderer.onSigil(ev.r, ev.g, ev.b, ev.strength);
      break;
    case 'loot':
      overlays.open('loot', w, ev.pickupId);
      break;
    case 'floor':
      commit();
      flushSync();
      startAmbient();
      break;
    case 'end':
      ending = { outcome: ev.outcome, t: 0 };
      commit();
      break;
    case 'secret':
      break;
    case 'town':
      returnToTown();
      break;
    case 'trap':
      renderer?.onTrap(ev.id);
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
    if (paused) world.retrieve(false);
    touch.visible = touchMode && !paused && !ending;
    if (touchMode) {
      touch.setAction(world.contextAction());
      const belt = world.state.equipment.thrown?.ref;
      // The Call button covers the whole return trip: shafts on the floor, a
      // call in progress (release stops it), and shafts already flying home.
      const counts = world.thrownCounts();
      touch.setTools({
        thrown: !!world.derived.thrown,
        landed: !!belt && ((counts?.floor ?? 0) + (counts?.flying ?? 0) > 0
          || world.projectiles.some(pr => pr.thrownBase === belt && !pr.returning)
          || (world.anim.attackThrow && world.anim.attack === 'windup')),
        calling: !!world.anim.retrieving,
        sigil: !!world.run.sigil && world.run.sigil.cd <= 0,
      });
    }
    // Holding the touch attack button keeps swinging.
    if (touchAttack && !paused) world.attack();
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
        commit();
      }
      // The Sunken Catacombs drip: an irregular plink from somewhere in the
      // dark every few seconds. Sometimes it is a drop falling through the
      // lamplight ahead — heard when it lands — and sometimes just a distant
      // plink out of sight. Volume and pan vary so each one reads as a
      // different distance, not a louder or quieter same drop.
      dripTimer -= dt;
      if (dripTimer <= 0) {
        dripTimer = 2.5 + Math.random() * 6;
        if (biomeForFloor(world.floor).id === 'catacombs') {
          if (Math.random() < 0.45) renderer.spawnDrip();
          else {
            audio.play('drip', {
              volume: 0.2 + Math.random() * 0.4,
              pan: Math.random() * 1.6 - 0.8,
              rate: 0.85 + Math.random() * 0.35,
            });
          }
        }
      }
    }
  }
  requestAnimationFrame(frame);
}

// --- Input -----------------------------------------------------------------------
const MOVES: Record<string, Parameters<World['press']>[0]> = {
  w: 'forward', arrowup: 'forward', s: 'back', arrowdown: 'back',
  a: 'turnLeft', arrowleft: 'turnLeft', d: 'turnRight', arrowright: 'turnRight',
  q: 'left', e: 'right',
};

window.addEventListener('keydown', (e) => {
  audio.unlock();
  if (import.meta.env.DEV && e.key === 'F2') {
    e.preventDefault();
    void openArtSheet();
    return;
  }
  if (import.meta.env.DEV && e.key === 'F3') {
    e.preventDefault();
    void toggleLabConsole();
    return;
  }
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
    // Start once per press; keyup releases the retrieval channel.
    case 't':
      if (!e.repeat) world.hurl();
      break;
    case 'r':
      if (!e.repeat) world.retrieve();
      break;
    case 'g':
    case 'c':
      if (!e.repeat) world.castSigil();
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
  if (k === 'r') world.retrieve(false);
});

// Mouse: LMB attack, RMB block. (Touch goes through the drag zone in TouchControls.)
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!world || overlays.isOpen || e.pointerType !== 'mouse') return;
  if (e.button === 0) world.attack();
  if (e.button === 2) world.setBlock(true);
});
window.addEventListener('pointerdown', () => audio.unlock());
window.addEventListener('mouseup', (e) => {
  if (world && e.button === 2) world.setBlock(false);
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('blur', () => {
  world?.held.clear();
  world?.retrieve(false);
});
window.addEventListener('resize', () => renderer.resize());
window.addEventListener('beforeunload', () => commit());

// Backgrounded (app switcher, lock screen, other tab): silence audio, save,
// and pause a run so you don't come back mid-fight. Resume sound on return.
function goBackground(): void {
  commit();
  audio.suspend();
  world?.held.clear();
  world?.setBlock(false);
  world?.retrieve(false);
  touchAttack = false;
  stickDir = null;
  if (mode === 'dungeon' && world && !overlays.isOpen && !ending) overlays.open('help', world);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) goBackground();
  else {
    audio.resume();
    void checkForUpdate();
  }
});
window.addEventListener('pagehide', goBackground);
setInterval(() => {
  if (!document.hidden) void checkForUpdate();
}, 10 * 60 * 1000);
void checkForUpdate();

/**
 * Dev only: a throwaway game, kitted for depth six, standing in the throne room.
 *
 * It swaps `state` for a fresh one and latches `devScratch`, so the gear and
 * renown it hands out can never be written over the playthrough in the slot —
 * the only way out is to reload the page, which is the honest contract for a
 * debug button. The module is dynamically imported behind the same DEV guard,
 * so neither it nor this path survives into a production bundle.
 */
async function enterArcherRoom(): Promise<void> {
  const dev = await import('./dev/archer-room');
  devScratch = true;
  // Same scratch contract as the boss arena: nothing here is saved.
  setScratchMode(true);
  state = newGame(createRng(randomSeed()));
  dev.prepare(state);
  enterTown();
  enterDungeon();
  if (!world) return;
  const at = dev.dropIntoArcherRoom(world);
  hud.message(`Dev archers — ${at}. Hold block and time the raise to parry the volley.`, '#c080ff');
  hud.message('Scratch game: nothing here is saved. Reload to get your slot back.', '#c8a060');
}

async function enterMeleeRoom(): Promise<void> {
  const dev = await import('./dev/melee-room');
  devScratch = true;
  // Same scratch contract as the boss arena: nothing here is saved.
  setScratchMode(true);
  state = newGame(createRng(randomSeed()));
  dev.prepare(state);
  enterTown();
  enterDungeon();
  if (!world) return;
  const at = dev.dropIntoMeleeRoom(world);
  hud.message(`Dev melee — ${at}. Hold block as they swing: one parry staggers the pack.`, '#c080ff');
  hud.message('Scratch game: nothing here is saved. Reload to get your slot back.', '#c8a060');
}

/**
 * Dev only: the combat lab. Throwaway game with every recipe mastered, 999 of
 * every material in the stash, and a weapon rack in the pack — standing in a
 * cleared room with the spawn console ready. Same scratch contract as the
 * boss arena: nothing here is saved, reload to get your slot back.
 */
async function enterLabArena(): Promise<void> {
  const dev = await import('./dev/lab-room');
  devScratch = true;
  setScratchMode(true);
  state = newGame(createRng(randomSeed()));
  dev.prepare(state);
  enterTown();
  enterDungeon();
  if (!world) return;
  const at = dev.dropIntoLab(world);
  hud.message(`Dev lab — ${at}. F3: spawn console. I: pack & gear (weapon rack inside).`, '#c080ff');
  hud.message('All recipes Rank 5 · 999 mats in stash (forge is town-side, recall scrolls in pack).', '#c080ff');
  hud.message('Scratch game: nothing here is saved. Reload to get your slot back.', '#c8a060');
  toggleLabConsole();
}

/** Dev only: the floating spawn/weapon console for the lab. F3 toggles. */
async function toggleLabConsole(): Promise<void> {
  if (!import.meta.env.DEV) return;
  const { toggleLabPanel } = await import('./dev/lab-panel');
  toggleLabPanel(app, () => world, (t, c) => hud.message(t, c));
}

/**
 * Dev only: a throwaway game, kitted for depth six, standing in the throne room.
 *
 * It swaps `state` for a fresh one and latches `devScratch`, so the gear and
 * renown it hands out can never be written over the playthrough in the slot —
 * the only way out is to reload the page, which is the honest contract for a
 * debug button. The module is dynamically imported behind the same DEV guard,
 * so neither it nor this path survives into a production bundle.
 */
async function enterBossArena(): Promise<void> {
  const dev = await import('./dev/boss-arena');
  devScratch = true;
  // Belt and braces: the lock on the storage door itself, so no future call
  // path can write this game to a slot the way `beforeunload` once did.
  setScratchMode(true);
  state = newGame(createRng(randomSeed()));
  dev.prepare(state);
  enterTown();
  enterDungeon();
  if (!world) return;
  const at = dev.dropIntoThroneRoom(world);
  hud.message(`Dev arena — ${at}. He turns at 65% and 30%.`, '#c080ff');
  hud.message('Scratch game: nothing here is saved. Reload to get your slot back.', '#c8a060');
}

// --- Boot ------------------------------------------------------------------------
audio.loadPrefs();
const params = new URLSearchParams(location.search);
if (import.meta.env.DEV && params.has('art')) void openArtSheet();
if (params.has('autostart')) {
  const where = params.get('autostart');
  if (import.meta.env.DEV && where === 'boss') void enterBossArena();
  else if (import.meta.env.DEV && where === 'lab') void enterLabArena();
  else if (import.meta.env.DEV && where === 'archers') void enterArcherRoom();
  else if (import.meta.env.DEV && where === 'melee') void enterMeleeRoom();
  else {
    enterTown();
    if (where === 'dungeon') enterDungeon();
  }
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
    get audioState() { return audio.state; },
    get slot() { return slot; },
    enterDungeon,
    enterTown,
    enterLabArena,
    toggleLabConsole,
    /**
     * Point this session at a different save slot, for dev scripts that hand
     * out gear.
     *
     * Slot 1 holds the save from before slots existed, which is where anyone
     * who has actually been playing finds their character — so a console script
     * that maxes the Warden board must never be one autosave away from landing
     * on it. Switching first, rather than writing to slot 3 and racing the next
     * `commit()`, means every write after this call goes to the new slot and
     * the old one is simply not in play any more.
     *
     * Refuses slot 1 for the same reason: this exists to stay off it.
     */
    useSlot(n: Slot) {
      if (n === 1) throw new Error('Slot 1 is the real save. Use 2 or 3.');
      if (!SLOTS.includes(n)) throw new Error(`No slot ${n}. Slots are ${SLOTS.join(', ')}.`);
      slot = n;
      setLastSlot(n);
      slotDeleted = false;
      devScratch = false;
      setScratchMode(false);
      saveGame(state, slot);
      hadLocalSave = true;
      return n;
    },
  };
}
