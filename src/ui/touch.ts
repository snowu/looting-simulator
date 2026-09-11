import { artImg, h } from './dom';

export type TouchMove = 'forward' | 'back' | 'left' | 'right' | 'turnLeft' | 'turnRight';

export interface ContextAction {
  kind: 'attack' | 'interact';
  label: string;
}

export interface TouchHandlers {
  /** Drag direction, or null when released / centred. */
  move(dir: TouchMove | null): void;
  /** Quick tap on the view. */
  tap(): void;
  /** Main button pressed / released: swing or interact depending on what's ahead. */
  action(on: boolean): void;
  block(on: boolean): void;
  open(mode: 'inventory' | 'map' | 'help'): void;
}

export function isTouchDevice(): boolean {
  return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Drag anywhere on the view, like holding WASD: up/down walk, left/right
 * turn, and the move repeats for as long as the finger stays out. A floating
 * stick appears under the thumb. A quick tap is reported separately.
 */
class DragPad {
  readonly zone = h('div', { class: 'stick-zone' });
  private base = h('div', { class: 'stick-base' });
  private knob = h('div', { class: 'stick-knob' });
  private id: number | null = null;
  private cx = 0;
  private cy = 0;
  private dir: TouchMove | null = null;
  private downAt = 0;
  private travelled = 0;
  private everMoved = false;

  constructor(private onDir: (d: TouchMove | null) => void, private onTap: () => void) {
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

  private down(e: PointerEvent): void {
    if (this.id !== null) return;
    e.preventDefault();
    this.zone.setPointerCapture(e.pointerId);
    this.id = e.pointerId;
    this.downAt = performance.now();
    this.travelled = 0;
    this.everMoved = false;
    const r = this.zone.getBoundingClientRect();
    const s = this.size / 2;
    this.cx = clamp(e.clientX - r.left, s, r.width - s);
    this.cy = clamp(e.clientY - r.top, s, r.height - s);
    this.base.style.left = `${this.cx}px`;
    this.base.style.top = `${this.cy}px`;
    this.knob.style.transform = '';
    this.zone.classList.add('on');
  }

  private drag(e: PointerEvent): void {
    if (e.pointerId !== this.id) return;
    const r = this.zone.getBoundingClientRect();
    let dx = e.clientX - r.left - this.cx;
    let dy = e.clientY - r.top - this.cy;
    const len = Math.hypot(dx, dy);
    this.travelled = Math.max(this.travelled, len);
    const R = this.size / 2 - this.knob.offsetWidth / 4;
    if (len > R) {
      dx *= R / len;
      dy *= R / len;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    let d: TouchMove | null = null;
    if (len > Math.max(14, R * 0.4)) d = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'turnRight' : 'turnLeft') : dy < 0 ? 'forward' : 'back';
    if (d !== this.dir) {
      this.dir = d;
      if (d) this.everMoved = true;
      this.onDir(d);
    }
  }

  private up(e: PointerEvent): void {
    if (e.pointerId !== this.id) return;
    const tapped = !this.everMoved && this.travelled < 14 && performance.now() - this.downAt < 350;
    this.reset();
    if (tapped && e.type === 'pointerup') this.onTap();
  }

  reset(): void {
    this.id = null;
    this.zone.classList.remove('on');
    this.knob.style.transform = '';
    if (this.dir) {
      this.dir = null;
      this.onDir(null);
    }
  }
}

/** On-screen controls for phones and tablets: drag the view, buttons on the right. */
export class TouchControls {
  readonly root = h('div', { class: 'layer touch-ui' });
  private pad: DragPad;
  private main: HTMLButtonElement;
  private mainImg: HTMLImageElement;
  private mainLabel = h('span', { class: 'act-label' });
  private actionKey = '';

  constructor(parent: HTMLElement, hd: TouchHandlers) {
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

    this.pad = new DragPad((d) => hd.move(d), () => hd.tap());

    this.mainImg = artImg('ic_long_sword', undefined, 56);
    this.main = hold('atk', () => hd.action(true), () => hd.action(false));
    this.main.append(this.mainImg, this.mainLabel);
    const block = hold('blk', () => hd.block(true), () => hd.block(false));
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

    // The drag zone sits underneath; buttons (later in the DOM) take their own touches.
    this.root.append(this.pad.zone, actions, menu);
    parent.append(this.root);
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
