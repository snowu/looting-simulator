import { describe, it, expect } from 'vitest';
import {
  PAD_BUTTONS,
  GamepadController,
  snapshotPad,
  stickXToStrafe,
  stickXToTurn,
  stickYToMove,
  type PadContext,
  type RawPad,
} from '../ui/gamepad';

function pad(over: Partial<RawPad> = {}): RawPad {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  return { id: 'test', axes: [0, 0, 0, 0], buttons, ...over };
}

function press(p: RawPad, ...idx: number[]): RawPad {
  const buttons = p.buttons.map((b, i) => (idx.includes(i) ? { pressed: true, value: 1 } : b));
  return { ...p, buttons };
}

describe('gamepad mapping', () => {
  it('maps stick Y to forward/back with deadzone', () => {
    expect(stickYToMove(-0.9)).toBe('forward');
    expect(stickYToMove(0.9)).toBe('back');
    expect(stickYToMove(0.1)).toBeNull();
  });

  it('maps stick X to strafe and right stick X to turn', () => {
    expect(stickXToStrafe(-0.5)).toBe('left');
    expect(stickXToStrafe(0.5)).toBe('right');
    expect(stickXToTurn(-0.6)).toBe('turnLeft');
    expect(stickXToTurn(0.6)).toBe('turnRight');
    expect(stickXToTurn(0.1)).toBeNull();
  });

  it('derives held moves from sticks and d-pad', () => {
    const s = snapshotPad({ ...pad(), axes: [0, -0.8, 0.7, 0] }, new Set());
    expect(s.moves.has('forward')).toBe(true);
    expect(s.moves.has('turnRight')).toBe(true);
  });

  it('d-pad left/right turn without strafing', () => {
    const s = snapshotPad(press(pad(), PAD_BUTTONS.dLeft), new Set());
    expect(s.moves.has('turnLeft')).toBe(true);
    expect(s.moves.has('left')).toBe(false);
  });

  it('reports button edges only once', () => {
    const p = press(pad(), PAD_BUTTONS.a);
    const first = snapshotPad(p, new Set());
    expect(first.pressed.has(PAD_BUTTONS.a)).toBe(true);
    const second = snapshotPad(p, new Set([PAD_BUTTONS.a]));
    expect(second.pressed.has(PAD_BUTTONS.a)).toBe(false);
  });

  it('treats triggers past threshold as held', () => {
    const p = pad();
    const withRt: RawPad = {
      ...p,
      buttons: p.buttons.map((b, i) => (i === PAD_BUTTONS.rt ? { pressed: false, value: 0.8 } : b)),
    };
    const s = snapshotPad(withRt, new Set());
    expect(s.attackHeld).toBe(true);
  });

  it('keeps bumpers off movement (LB throw / RB retrieve stay combat-only)', () => {
    const s = snapshotPad(press(pad(), PAD_BUTTONS.lb), new Set());
    expect(s.moves.size).toBe(0);
    const r = snapshotPad(press(pad(), PAD_BUTTONS.rb), new Set());
    expect(r.retrieveHeld).toBe(true);
    expect(r.moves.size).toBe(0);
  });

  it('sips the flask on B in the dungeon, closes overlays instead in menus', () => {
    const calls: string[] = [];
    const noop = (): void => undefined;
    const ctx: PadContext = {
      paused: false,
      overlayOpen: false,
      contextKind: () => 'attack',
      attack: () => calls.push('attack'),
      interact: noop,
      hurl: noop,
      setRetrieve: noop,
      setBlock: noop,
      castSigil: noop,
      sipFlask: () => calls.push('sip'),
      press: noop,
      release: noop,
      toggleInventory: noop,
      toggleMap: noop,
      toggleHelp: noop,
      takeAll: noop,
      closeOverlay: () => calls.push('close'),
      quickUseNext: noop,
      menuNav: () => false,
      menuActivate: () => false,
    };
    const c = new GamepadController(ctx);
    c.getPoll = () => press(pad(), PAD_BUTTONS.b);
    c.update(1 / 60);
    expect(calls).toEqual(['sip']);

    calls.length = 0;
    ctx.overlayOpen = true;
    const c2 = new GamepadController(ctx);
    c2.getPoll = () => press(pad(), PAD_BUTTONS.b);
    c2.update(1 / 60);
    expect(calls).toEqual(['close']);
  });
});
