import { artImg, h } from './dom';
import { clamp } from '../core/math';
import { PadSwipe, TouchPrefs, sideMove, touchPrefs } from './touch-prefs';

export type TouchMove = 'forward' | 'back' | 'left' | 'right' | 'turnLeft' | 'turnRight';

export interface ContextAction {
  kind: 'attack' | 'interact';
  label: string;
}

export interface TouchHandlers {
  /** Drag direction, or null when released / centred. */
  move(dir: TouchMove | null): void;
  /** Quick tap on the right half of the view. */
  tap(): void;
  /** Main button pressed / released: swing or interact depending on what's ahead. */
  action(on: boolean): void;
  block(on: boolean): void;
  /** An edge button held or released: a strafe or a turn, depending on what the pad's swipe does. */
  side(move: TouchMove, on: boolean): void;
  /** Hurl one shaft from the belt. */
  hurl(): void;
  /** Call every landed shaft back off this floor. */
  retrieve(held: boolean): void;
  /** Cast the attuned sigil. */
  sigil(): void;
  open(mode: 'inventory' | 'map' | 'help'): void;
}

/** Which of the situational buttons are worth showing right now. */
export interface TouchTools {
  /** A belt of shafts is worn, so throwing and calling back are possible. */
  thrown: boolean;
  /** Shafts are lying on this floor — or flying home, or being called — so Call does something. */
  landed: boolean;
  /** A call is in progress; Call stops it. */
  calling: boolean;
  /** A sigil is attuned and off cooldown. */
  sigil: boolean;
}

export function isTouchDevice(): boolean {
  return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}


/** Which half of the view a finger landed on. */
export type TouchSide = 'left' | 'right';

/** A finger that moved less than this (px) and lifted within TAP_MS is a tap. */
const TAP_TRAVEL = 14;
const TAP_MS = 350;

interface Finger {
  side: TouchSide;
  x: number;
  y: number;
  downAt: number;
  travelled: number;
  /** Still counts towards the guard: a left-side finger that hasn't turned into a drag. */
  guarding: boolean;
}

/**
 * Drag anywhere on the view, like holding WASD: up/down walk, left/right
 * turn, and the move repeats for as long as the finger stays out. A floating
 * stick appears under the thumb.
 *
 * The two halves of the view also act on their own: a finger on the left half
 * raises the guard the moment it lands (a tap is a parry attempt, a hold is a
 * block), and a quick tap on the right half swings. A left-side finger that
 * starts dragging lowers the guard and becomes the stick. Every finger is
 * tracked, so one thumb can walk while the other blocks or swings; only the
 * first finger down drives the stick.
 */
class DragPad {
  readonly zone = h('div', { class: 'stick-zone' });
  private base = h('div', { class: 'stick-base' });
  private knob = h('div', { class: 'stick-knob' });
  private fingers = new Map<number, Finger>();
  /** The finger driving the stick, if any. */
  private id: number | null = null;
  private cx = 0;
  private cy = 0;
  private dir: TouchMove | null = null;
  private everMoved = false;

  constructor(
    private onDir: (d: TouchMove | null) => void,
    private onTap: () => void,
    private onGuard: (on: boolean) => void,
  ) {
    this.base.append(this.knob);
    this.zone.append(this.base);
    this.zone.addEventListener('pointerdown', (e) => this.down(e));
    this.zone.addEventListener('pointermove', (e) => this.drag(e));
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.zone.addEventListener(ev, (e) => this.up(e as PointerEvent));
    }
    this.zone.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private get size(): number {
    return this.base.offsetWidth || 96;
  }

  private get guarding(): boolean {
    for (const f of this.fingers.values()) if (f.guarding) return true;
    return false;
  }

  /** Report the guard only when it actually changes, however many fingers hold it. */
  private setGuard(f: Finger, on: boolean): void {
    const was = this.guarding;
    f.guarding = on;
    if (this.guarding !== was) this.onGuard(!was);
  }

  private down(e: PointerEvent): void {
    if (this.fingers.has(e.pointerId)) return;
    e.preventDefault();
    this.zone.setPointerCapture(e.pointerId);
    const r = this.zone.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const f: Finger = { side: x < r.width / 2 ? 'left' : 'right', x, y, downAt: performance.now(), travelled: 0, guarding: false };
    this.fingers.set(e.pointerId, f);
    if (f.side === 'left') this.setGuard(f, true);
    if (this.id !== null) return;
    this.id = e.pointerId;
    this.everMoved = false;
    const s = this.size / 2;
    this.cx = clamp(x, s, r.width - s);
    this.cy = clamp(y, s, r.height - s);
    this.base.style.left = `${this.cx}px`;
    this.base.style.top = `${this.cy}px`;
    this.knob.style.transform = '';
    this.zone.classList.add('on');
  }

  private drag(e: PointerEvent): void {
    const f = this.fingers.get(e.pointerId);
    if (!f) return;
    const r = this.zone.getBoundingClientRect();
    const fx = e.clientX - r.left, fy = e.clientY - r.top;
    f.travelled = Math.max(f.travelled, Math.hypot(fx - f.x, fy - f.y));
    if (e.pointerId !== this.id) return;
    let dx = fx - this.cx;
    let dy = fy - this.cy;
    const len = Math.hypot(dx, dy);
    const R = this.size / 2 - this.knob.offsetWidth / 4;
    if (len > R) {
      dx *= R / len;
      dy *= R / len;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    let d: TouchMove | null = null;
    if (len > Math.max(TAP_TRAVEL, R * 0.4)) d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'turnRight' : 'turnLeft') : dy < 0 ? 'forward' : 'back';
    if (d !== this.dir) {
      this.dir = d;
      if (d) this.everMoved = true;
      this.onDir(d);
    }
    // A left-side thumb that sets off walking wanted the stick, not the shield.
    if (this.everMoved && f.guarding) this.setGuard(f, false);
  }

  private up(e: PointerEvent): void {
    const f = this.fingers.get(e.pointerId);
    if (!f) return;
    const stick = e.pointerId === this.id;
    const tapped = !(stick && this.everMoved) && f.travelled < TAP_TRAVEL && performance.now() - f.downAt < TAP_MS;
    if (f.guarding) this.setGuard(f, false);
    this.fingers.delete(e.pointerId);
    if (stick) this.releaseStick();
    if (tapped && e.type === 'pointerup' && f.side === 'right') this.onTap();
  }

  private releaseStick(): void {
    this.id = null;
    this.zone.classList.remove('on');
    this.knob.style.transform = '';
    if (this.dir) {
      this.dir = null;
      this.onDir(null);
    }
  }

  reset(): void {
    const guarded = this.guarding;
    this.fingers.clear();
    if (guarded) this.onGuard(false);
    this.releaseStick();
  }
}

/**
 * A tap on the left half has to hold the guard long enough to matter: the
 * world reads the block once a frame, and the parry window only runs while
 * the shield stays up. This covers PARRY_WINDOW (0.22s) with a frame to spare.
 */
const GUARD_MIN_MS = 250;

/** On-screen controls for phones and tablets: drag the view, buttons on the right. */
export class TouchControls {
  readonly root = h('div', { class: 'layer touch-ui' });
  private pad: DragPad;
  private main: HTMLButtonElement;
  private mainImg: HTMLImageElement;
  private mainLabel = h('span', { class: 'act-label' });
  private actionKey = '';
  // The three situational buttons. They are hidden rather than disabled: a
  // phone has no room to spend on a control that cannot do anything, and the
  // help screen has been promising these since the feature landed.
  private throwBtn: HTMLButtonElement;
  private callBtn: HTMLButtonElement;
  private sigilBtn: HTMLButtonElement;
  private toolsKey = '';
  private edgeL: HTMLButtonElement;
  private edgeR: HTMLButtonElement;
  private swipe: PadSwipe = 'turn';
  /** Who is holding the guard up: the shield button, the left half of the view, or both. */
  private guards = new Set<'button' | 'view'>();
  private guardAt = 0;
  private guardDrop: number | null = null;

  constructor(parent: HTMLElement, private hd: TouchHandlers) {
    // A button that stays "held" for as long as the finger is down.
    const hold = (cls: string, down: () => void, up?: () => void) => {
      const b = h('button', { class: `tbtn ${cls}` });
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        b.classList.add('on');
        down();
      });
      const end = () => {
        if (!b.classList.contains('on')) return;
        b.classList.remove('on');
        up?.();
      };
      b.addEventListener('pointerup', end);
      b.addEventListener('pointercancel', end);
      b.addEventListener('lostpointercapture', end);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      return b;
    };

    this.pad = new DragPad(
      (d) => hd.move(d === 'turnLeft' || d === 'turnRight' ? sideMove(d === 'turnLeft' ? 'left' : 'right', 'pad', this.swipe) : d),
      () => hd.tap(),
      (on) => this.guard('view', on),
    );

    this.mainImg = artImg('ic_long_sword', undefined, 56);
    this.main = hold('atk', () => hd.action(true), () => hd.action(false));
    this.main.append(this.mainImg, this.mainLabel);
    const block = hold('blk', () => this.guard('button', true), () => this.guard('button', false));
    block.append(artImg('ic_buckler', undefined, 36));
    const actions = h('div', { class: 'actions' }, block, this.main);

    const tap = (label: string, fn: () => void) => {
      const b = h('button', { class: 'tbtn small', text: label });
      // Suppress the compatibility mouse events so they can't land on whatever we open.
      b.addEventListener('pointerdown', (e) => e.preventDefault());
      b.addEventListener('pointerup', (e) => {
        e.preventDefault();
        fn();
      });
      return b;
    };
    const menu = h('div', { class: 'tmenu' }, tap('Pack', () => hd.open('inventory')), tap('Map', () => hd.open('map')), tap('☰', () => hd.open('help')));

    this.throwBtn = tap('Throw', () => hd.hurl());
    this.callBtn = hold('small', () => hd.retrieve(true), () => hd.retrieve(false));
    this.callBtn.textContent = 'Hold Call';
    this.sigilBtn = tap('Sigil', () => hd.sigil());
    const tools = h('div', { class: 'ttools' }, this.throwBtn, this.callBtn, this.sigilBtn);
    for (const b of [this.throwBtn, this.callBtn, this.sigilBtn]) b.hidden = true;

    // Shoulder buttons on the screen edges, where the thumbs rest when gripping
    // the phone. Hold to sidestep (or turn, when the pad strafes) until released.
    const edge = (side: 'left' | 'right') => {
      let held: TouchMove | null = null;
      return hold(`edge edge-${side}`, () => {
        held = sideMove(side, 'extra', this.swipe);
        hd.side(held, true);
      }, () => {
        if (held) hd.side(held, false);
        held = null;
      });
    };
    this.edgeL = edge('left');
    this.edgeR = edge('right');

    // The drag zone sits underneath; buttons (later in the DOM) take their own touches.
    this.root.append(this.pad.zone, this.edgeL, this.edgeR, tools, actions, menu);
    parent.append(this.root);
    this.setPrefs(touchPrefs.get());
    touchPrefs.onChange((p) => this.setPrefs(p));
  }

  private setPrefs(p: TouchPrefs): void {
    this.swipe = p.padSwipe;
    this.edgeL.hidden = this.edgeR.hidden = !p.strafeButtons;
    const turn = p.padSwipe === 'strafe';
    this.edgeL.textContent = turn ? '↶' : '◀';
    this.edgeR.textContent = turn ? '↷' : '▶';
    this.edgeL.title = turn ? 'Turn left' : 'Strafe left';
    this.edgeR.title = turn ? 'Turn right' : 'Strafe right';
  }

  /**
   * Raise or lower the guard for one source. It stays up while any source
   * holds it, and a lowered guard waits out GUARD_MIN_MS from the raise so a
   * quick tap is still a parry attempt.
   */
  private guard(src: 'button' | 'view', on: boolean): void {
    const was = this.guards.size > 0;
    if (on) this.guards.add(src);
    else this.guards.delete(src);
    const now = this.guards.size > 0;
    if (now === was) return;
    if (now) {
      if (this.guardDrop !== null) {
        clearTimeout(this.guardDrop);
        this.guardDrop = null;
        return; // Still up from the last tap: this is the same raise, not a new parry.
      }
      this.guardAt = performance.now();
      this.hd.block(true);
      return;
    }
    const wait = GUARD_MIN_MS - (performance.now() - this.guardAt);
    if (wait <= 0) this.hd.block(false);
    else this.guardDrop = window.setTimeout(() => {
      this.guardDrop = null;
      this.hd.block(false);
    }, wait);
  }

  /** Show only the situational buttons that would do something. */
  setTools(t: TouchTools): void {
    const key = `${t.thrown}${t.landed}${t.calling}${t.sigil}`;
    if (key === this.toolsKey) return;
    this.toolsKey = key;
    this.throwBtn.hidden = !t.thrown;
    // Keep the control visible until the active call ends.
    this.callBtn.hidden = !t.thrown || (!t.landed && !t.calling);

    this.sigilBtn.hidden = !t.sigil;
  }

  /** Show a sword when the main button will swing, or a word when it will interact. */
  setAction(a: ContextAction): void {
    const key = `${a.kind}:${a.label}`;
    if (key === this.actionKey) return;
    this.actionKey = key;
    const interact = a.kind === 'interact';
    this.main.classList.toggle('interact', interact);
    this.mainImg.hidden = interact;
    this.mainLabel.textContent = interact ? a.label : '';
  }

  set visible(v: boolean) {
    if (!v && !this.root.hidden) this.pad.reset();
    this.root.hidden = !v;
  }
}
