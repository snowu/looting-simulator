/**
 * Gamepad support for desktop and mobile (USB / Bluetooth controllers).
 *
 * Both PC browsers and mobile browsers (Android Chrome, Safari 16+) expose
 * paired controllers through the same Gamepad API, so one polling module
 * covers both. Touch controls stay as-is; this is additive.
 *
 * Standard mapping (Xbox-style labels, PlayStation in brackets):
 * - Left stick Y / D-pad Up-Down: step forward / back
 * - Left stick X: strafe left / right
 * - Right stick X / D-pad Left-Right: turn
 * - A (Cross) / RT: context action — interact when facing something useful,
 *   otherwise attack. Holding keeps swinging.
 * - X (Square): interact explicitly
 * - Y (Triangle): cast attuned sigil
 * - LB (L1): throw one shaft
 * - RB (R1, hold): call shafts back, release to stop
 * - LT (L2, hold): block (time the raise to parry)
 * - Start: pause / help, Select/Back: pack & gear, L3: map, R3: quick-use
 * - B (Circle): sip the flask (back / close inside panels)
 */

export type PadMove = 'forward' | 'back' | 'left' | 'right' | 'turnLeft' | 'turnRight';

export const PAD_DEADZONE = 0.28;
export const PAD_TURN_DEADZONE = 0.35;
export const PAD_TRIGGER_HELD = 0.35;

export const PAD_BUTTONS = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  select: 8,
  start: 9,
  l3: 10,
  r3: 11,
  dUp: 12,
  dDown: 13,
  dLeft: 14,
  dRight: 15,
} as const;

export interface PadSnapshot {
  connected: boolean;
  id: string;
  /** Held movement directions derived from sticks + d-pad + bumpers. */
  moves: Set<PadMove>;
  block: boolean;
  attackHeld: boolean;
  retrieveHeld: boolean;
  /** Buttons newly pressed since the last snapshot (edge). */
  pressed: Set<number>;
}

/** Left-stick Y to forward/back. */
export function stickYToMove(y: number): PadMove | null {
  if (y <= -PAD_DEADZONE) return 'forward';
  if (y >= PAD_DEADZONE) return 'back';
  return null;
}

/** Left-stick X to strafe. */
export function stickXToStrafe(x: number): PadMove | null {
  if (x <= -PAD_DEADZONE) return 'left';
  if (x >= PAD_DEADZONE) return 'right';
  return null;
}

/** Right-stick X to turning, with a slightly larger deadzone. */
export function stickXToTurn(x: number): PadMove | null {
  if (x <= -PAD_TURN_DEADZONE) return 'turnLeft';
  if (x >= PAD_TURN_DEADZONE) return 'turnRight';
  return null;
}

export interface RawPad {
  id?: string;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
  vibrationActuator?: { playEffect?: (kind: string, opts: Record<string, unknown>) => Promise<unknown> } | null;
}

function btn(pad: RawPad, i: number): boolean {
  const b = pad.buttons[i];
  if (!b) return false;
  return b.pressed || b.value > 0.5;
}

function triggerHeld(pad: RawPad, i: number): boolean {
  const b = pad.buttons[i];
  if (!b) return false;
  return b.pressed || b.value > PAD_TRIGGER_HELD;
}

/** Pure snapshot builder — unit-tested, no navigator access. */
export function snapshotPad(pad: RawPad | null, prevButtons: Set<number>): PadSnapshot {
  if (!pad) {
    return { connected: false, id: '', moves: new Set(), block: false, attackHeld: false, retrieveHeld: false, pressed: new Set() };
  }
  const ax = (i: number) => pad.axes[i] ?? 0;
  const moves = new Set<PadMove>();
  const move = stickYToMove(ax(1));
  if (move) moves.add(move);
  const strafe = stickXToStrafe(ax(0));
  if (strafe) moves.add(strafe);
  const turn = stickXToTurn(ax(2));
  if (turn) moves.add(turn);
  if (btn(pad, PAD_BUTTONS.dUp)) moves.add('forward');
  if (btn(pad, PAD_BUTTONS.dDown)) moves.add('back');
  if (btn(pad, PAD_BUTTONS.dLeft)) moves.add('turnLeft');
  if (btn(pad, PAD_BUTTONS.dRight)) moves.add('turnRight');
  // Bumpers stay combat-bound (LB throw, RB retrieve) so they never turn.

  const pressed = new Set<number>();
  for (let i = 0; i < pad.buttons.length; i++) {
    if (btn(pad, i) && !prevButtons.has(i)) pressed.add(i);
  }

  const block = triggerHeld(pad, PAD_BUTTONS.lt);
  const attackHeld = triggerHeld(pad, PAD_BUTTONS.rt) || btn(pad, PAD_BUTTONS.a);
  const retrieveHeld = btn(pad, PAD_BUTTONS.rb);
  return { connected: true, id: pad.id ?? '', moves, block, attackHeld, retrieveHeld, pressed };
}

/** Current pressed-set for edge detection on the next poll. */
export function pressedSet(pad: RawPad | null): Set<number> {
  const out = new Set<number>();
  if (!pad) return out;
  for (let i = 0; i < pad.buttons.length; i++) if (btn(pad, i)) out.add(i);
  return out;
}

export interface PadContext {
  /** True while a modal/settings panel pauses the dungeon. */
  paused: boolean;
  /** Dungeon overlay open (inventory/loot/map/help), if any. */
  overlayOpen: boolean;
  contextKind: () => 'attack' | 'interact';
  attack: () => void;
  interact: () => void;
  hurl: () => void;
  setRetrieve: (held: boolean) => void;
  setBlock: (on: boolean) => void;
  castSigil: () => void;
  sipFlask: () => void;
  press: (m: PadMove) => void;
  release: (m: PadMove) => void;
  toggleInventory: () => void;
  toggleMap: () => void;
  toggleHelp: () => void;
  takeAll: () => void;
  closeOverlay: () => void;
  quickUseNext: () => void;
  /** Menu focus navigation; returns true if it consumed the input. */
  menuNav: (dir: 'next' | 'prev') => boolean;
  menuActivate: () => boolean;
}

/**
 * Polls the first connected gamepad each frame and translates it into World
 * calls. Holds (movement/block/attack/retrieve) are level-driven; menu and
 * single-shot actions are edge-driven with a small repeat for navigation.
 */
export class GamepadController {
  private prevButtons = new Set<number>();
  private prevMoves = new Set<PadMove>();
  private prevBlock = false;
  private prevRetrieve = false;
  private navRepeat = 0;
  private navDir: 'next' | 'prev' | null = null;
  private quickIdx = 0;
  private seenPad = false;
  lastUsedAt = 0;
  getPoll: () => (RawPad | null) | null = () => {
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const p of pads) {
        if (p && p.connected) return p as unknown as RawPad;
      }
      return null;
    } catch {
      return null;
    }
  };

  onFirstSeen: (() => void) | null = null;
  rumblePad: RawPad | null = null;

  reset(): void {
    for (const m of this.prevMoves) this.ctx?.release(m);
    this.prevMoves.clear();
    if (this.prevBlock) this.ctx?.setBlock(false);
    if (this.prevRetrieve) this.ctx?.setRetrieve(false);
    this.prevBlock = false;
    this.prevRetrieve = false;
    this.prevButtons.clear();
    this.navDir = null;
  }

  constructor(private ctx: PadContext | null = null) {}

  setContext(ctx: PadContext | null): void {
    if (!ctx) this.reset();
    this.ctx = ctx;
  }

  /** Rumble on hits; silently no-ops where unsupported (e.g. iOS Safari). */
  rumble(strength = 0.6, durationMs = 120): void {
    try {
      const act = (this.rumblePad as unknown as { vibrationActuator?: { playEffect?: (k: string, o: Record<string, unknown>) => Promise<unknown> } })?.vibrationActuator;
      act?.playEffect?.('dual-rumble', {
        duration: durationMs,
        strongMagnitude: strength,
        weakMagnitude: strength * 0.6,
      })?.catch?.(() => undefined);
    } catch {
      // No haptics — fine.
    }
  }

  update(dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    let raw: RawPad | null = null;
    try {
      raw = this.getPoll() ?? null;
    } catch {
      raw = null;
    }
    if (!raw) {
      if (this.prevMoves.size || this.prevBlock || this.prevRetrieve) this.reset();
      else this.prevButtons.clear();
      return;
    }
    this.rumblePad = raw;
    if (!this.seenPad) {
      this.seenPad = true;
      this.lastUsedAt = performance.now();
      this.onFirstSeen?.();
    }
    const snap = snapshotPad(raw, this.prevButtons);
    this.prevButtons = pressedSet(raw);
    this.lastUsedAt = performance.now();

    const P = PAD_BUTTONS;
    const edge = (i: number) => snap.pressed.has(i);

    // --- Overlays / paused: release dungeon holds, navigate focus instead.
    if (ctx.paused || ctx.overlayOpen) {
      if (this.prevMoves.size) {
        for (const m of this.prevMoves) ctx.release(m);
        this.prevMoves.clear();
      }
      if (this.prevBlock) {
        ctx.setBlock(false);
        this.prevBlock = false;
      }
      if (this.prevRetrieve) {
        ctx.setRetrieve(false);
        this.prevRetrieve = false;
      }
      this.menuRepeat(dt, snap, raw);
      if (edge(P.b)) ctx.closeOverlay();
      if (edge(P.a) || edge(P.x)) {
        if (!ctx.menuActivate()) {
          // Loot panel: A/X takes everything when no button has focus.
          ctx.takeAll();
        }
      }
      if (edge(P.y)) ctx.castSigil();
      if (edge(P.start)) ctx.toggleHelp();
      if (edge(P.select)) ctx.toggleInventory();
      if (edge(P.l3)) ctx.toggleMap();
      if (edge(P.r3)) ctx.quickUseNext();
      return;
    }

    // --- Held movement: diff desired vs previous, press/release accordingly.
    for (const m of snap.moves) {
      if (!this.prevMoves.has(m)) ctx.press(m);
    }
    for (const m of this.prevMoves) {
      if (!snap.moves.has(m)) ctx.release(m);
    }
    this.prevMoves = snap.moves;

    // --- Held channels.
    if (snap.block !== this.prevBlock) {
      ctx.setBlock(snap.block);
      this.prevBlock = snap.block;
    }
    if (snap.retrieveHeld !== this.prevRetrieve) {
      ctx.setRetrieve(snap.retrieveHeld);
      this.prevRetrieve = snap.retrieveHeld;
    }

    // --- Live dungeon input.
    if (edge(P.x)) ctx.interact();
    if (edge(P.a) && ctx.contextKind() === 'interact') ctx.interact();
    // Holding A or RT keeps swinging (world.attack no-ops mid-swing).
    if (snap.attackHeld && ctx.contextKind() === 'attack') ctx.attack();
    if (edge(P.lb)) ctx.hurl();
    if (edge(P.y)) ctx.castSigil();
    // B is Close inside overlays (handled above); in the dungeon it sips.
    if (edge(P.b)) ctx.sipFlask();
    if (edge(P.select)) ctx.toggleInventory();
    if (edge(P.start)) ctx.toggleHelp();
    if (edge(P.l3)) ctx.toggleMap();
    if (edge(P.r3)) ctx.quickUseNext();
  }

  /** D-pad / stick navigation with initial + repeat, for menus and overlays. */
  private menuRepeat(dt: number, snap: PadSnapshot, raw: RawPad): void {
    const ctx = this.ctx!;
    const P = PAD_BUTTONS;
    let dir: 'next' | 'prev' | null = null;
    if (snap.pressed.has(P.dDown) || snap.pressed.has(P.dRight)) dir = 'next';
    else if (snap.pressed.has(P.dUp) || snap.pressed.has(P.dLeft)) dir = 'prev';
    else {
      const ly = raw.axes[1] ?? 0;
      const lx = raw.axes[0] ?? 0;
      const ry = raw.axes[3] ?? 0;
      if (ly >= PAD_DEADZONE || lx >= PAD_DEADZONE || ry >= PAD_DEADZONE) dir = 'next';
      else if (ly <= -PAD_DEADZONE || lx <= -PAD_DEADZONE || ry <= -PAD_DEADZONE) dir = 'prev';
    }
    if (dir) {
      if (this.navDir !== dir) {
        this.navDir = dir;
        this.navRepeat = 0.28;
        ctx.menuNav(dir);
      } else {
        this.navRepeat -= dt;
        if (this.navRepeat <= 0) {
          this.navRepeat = 0.12;
          ctx.menuNav(dir);
        }
      }
    } else {
      this.navDir = null;
    }
  }

  nextQuickSlot(count = 4): number {
    const i = this.quickIdx % count;
    this.quickIdx = (this.quickIdx + 1) % count;
    return i;
  }
}

export const GAMEPAD_HELP_ROWS: [string, string][] = [
  ['Left stick / D-pad ↑ ↓', 'Step forward / back'],
  ['Left stick ← →', 'Strafe'],
  ['Right stick ← → / D-pad ← →', 'Turn'],
  ['A / RT', 'Swing — or Loot / Open when facing something'],
  ['X', 'Interact'],
  ['LT (hold)', 'Block — raise it as they strike to parry'],
  ['LB', 'Throw one shaft from your belt'],
  ['RB (hold)', 'Call shafts back — release to stop'],
  ['Y', 'Cast your attuned sigil'],
  ['Select', 'Pack & gear'],
  ['L3', 'Map'],
  ['Start', 'Pause / help'],
  ['R3', 'Use next quick-slot item'],
  ['B', 'Sip the flask (Close / back in menus)'],
];
