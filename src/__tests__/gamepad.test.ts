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
      castSpell: () => calls.push('cast'),
      nextSpell: () => calls.push('next'),
      riteAvailable: () => false,
      beginRite: () => false,
      traceRite: noop,
      endRite: noop,
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

    // D-pad Down: a tap casts when it comes up, a hold selects the next spell
    // and casts nothing, and it no longer steps back.
    calls.length = 0;
    ctx.overlayOpen = false;
    expect(snapshotPad(press(pad(), PAD_BUTTONS.dDown), new Set()).moves.has('back')).toBe(false);
    const c3 = new GamepadController(ctx);
    c3.getPoll = () => press(pad(), PAD_BUTTONS.dDown);
    c3.update(1 / 60);
    expect(calls).toEqual([]);
    c3.getPoll = () => pad();
    c3.update(1 / 60);
    expect(calls).toEqual(['cast']);
    calls.length = 0;
    c3.getPoll = () => press(pad(), PAD_BUTTONS.dDown);
    for (let i = 0; i < 30; i++) c3.update(1 / 60);
    expect(calls).toEqual(['next']);
    c3.getPoll = () => pad();
    c3.update(1 / 60);
    expect(calls).toEqual(['next']);
  });

  it('taps X to interact, holds it to trace a rite the right stick draws', () => {
    const calls: string[] = [];
    const traces: [number, number][] = [];
    const noop = (): void => undefined;
    const ctx: PadContext = {
      paused: false,
      overlayOpen: false,
      contextKind: () => 'attack',
      attack: noop,
      interact: () => calls.push('interact'),
      hurl: noop,
      setRetrieve: noop,
      setBlock: noop,
      castSigil: noop,
      castSpell: noop,
      nextSpell: noop,
      riteAvailable: () => true,
      beginRite: () => { calls.push('begin'); return true; },
      traceRite: (x, y) => traces.push([x, y]),
      endRite: () => calls.push('end'),
      sipFlask: noop,
      press: (m) => calls.push(`press:${m}`),
      release: (m) => calls.push(`release:${m}`),
      toggleInventory: noop,
      toggleMap: noop,
      toggleHelp: noop,
      takeAll: noop,
      closeOverlay: noop,
      quickUseNext: noop,
      menuNav: () => false,
      menuActivate: () => false,
    };
    // A tap interacts when it comes up, and traces nothing.
    const c = new GamepadController(ctx);
    c.getPoll = () => press(pad(), PAD_BUTTONS.x);
    c.update(1 / 60);
    expect(calls).toEqual([]);
    c.getPoll = () => pad();
    c.update(1 / 60);
    expect(calls).toEqual(['interact']);
    // A hold opens the trace instead, the stick draws, the release casts.
    calls.length = 0;
    const held = press({ ...pad(), axes: [0, 0, 0.9, 0.4] }, PAD_BUTTONS.x);
    c.getPoll = () => held;
    for (let i = 0; i < 30; i++) c.update(1 / 60);
    expect(calls).toContain('begin');
    expect(calls).not.toContain('interact');
    expect(traces.length).toBeGreaterThan(0);
    expect(traces[0]).toEqual([0.18, 0.16]);
    expect(calls.filter((k) => k.startsWith('press:turn') || k.startsWith('release:turn'))).toEqual([]);
    c.getPoll = () => pad();
    c.update(1 / 60);
    expect(calls[calls.length - 1]).toBe('end');

    // With no rite ready (no rite known yet, conduit spent...), X interacts
    // on the press, as before rites, and a long hold never swallows it.
    let ready = false;
    const idle = new GamepadController({ ...ctx, riteAvailable: () => ready });
    calls.length = 0;
    idle.getPoll = () => press(pad(), PAD_BUTTONS.x);
    idle.update(1 / 60);
    expect(calls).toEqual(['interact']);
    for (let i = 0; i < 40; i++) idle.update(1 / 60);
    idle.getPoll = () => pad();
    idle.update(1 / 60);
    expect(calls).toEqual(['interact']);
    // A rite that stops being castable mid-hold leaves a tap: it interacts on release.
    ready = true;
    calls.length = 0;
    idle.getPoll = () => press(pad(), PAD_BUTTONS.x);
    idle.update(1 / 60);
    ready = false;
    for (let i = 0; i < 40; i++) idle.update(1 / 60);
    idle.getPoll = () => pad();
    idle.update(1 / 60);
    expect(calls).toEqual(['interact']);
  });
});
