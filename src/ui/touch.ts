import { artImg, h } from './dom';
import { isStandalone } from './fullscreen';

export type TouchMove = 'forward' | 'back' | 'left' | 'right' | 'turnLeft' | 'turnRight';

export interface TouchHandlers {
  press(a: TouchMove): void;
  release(a: TouchMove): void;
  attack(on: boolean): void;
  block(on: boolean): void;
  interact(): void;
  open(mode: 'inventory' | 'map' | 'help'): void;
  fullscreen(): void;
}

export function isTouchDevice(): boolean {
  return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

/** On-screen controls for phones and tablets: D-pad left, actions right. */
export class TouchControls {
  readonly root = h('div', { class: 'layer touch-ui' });

  constructor(parent: HTMLElement, hd: TouchHandlers) {
    // A button that stays "held" for as long as the finger is down.
    const hold = (label: string, cls: string, down: () => void, up?: () => void) => {
      const b = h('button', { class: `tbtn ${cls}`, text: label });
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
    const move = (label: string, cls: string, a: TouchMove) => hold(label, cls, () => hd.press(a), () => hd.release(a));

    const pad = h(
      'div',
      { class: 'dpad' },
      move('↺', 'turn', 'turnLeft'),
      move('▲', '', 'forward'),
      move('↻', 'turn', 'turnRight'),
      move('◀', '', 'left'),
      h('div', { class: 'hub' }),
      move('▶', '', 'right'),
      h('div'),
      move('▼', '', 'back'),
      h('div'),
    );

    const atk = hold('', 'atk', () => hd.attack(true), () => hd.attack(false));
    atk.append(artImg('ic_long_sword', undefined, 56));
    const actions = h(
      'div',
      { class: 'actions' },
      hold('Use', 'use', () => hd.interact()),
      hold('Block', 'blk', () => hd.block(true), () => hd.block(false)),
      atk,
    );

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
    if (!isStandalone()) menu.append(tap('⛶', () => hd.fullscreen()));

    this.root.append(pad, actions, menu);
    parent.append(this.root);
  }

  set visible(v: boolean) {
    this.root.hidden = !v;
  }
}
