import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { DX, DY } from '../core/dir';
import { Rarity } from '../types';
import { RITES, RITE_CARVING_DEPTH, findRite, rite } from '../data/rites';
import { gradeRite, matchRite, TracePoint } from '../systems/rite-draw';
import { SAVE_VERSION, newGame } from '../state/game-state';
import { parseSave } from '../state/save-format';
import { SAVE_REVISION } from '../state/migrations';
import { makeEquipment } from '../systems/items';
import { derivePlayer } from '../systems/player';
import { startRun } from '../systems/run';
import { createEnemy, FLOOR, inRoom } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { World } from '../world/world';

const TEMPLATE = RITES[0].template;

/** Points along the template's own vertices, densely interpolated. */
function alongTemplate(n = 60): TracePoint[] {
  const verts = TEMPLATE.map(([x, y]) => ({ x, y }));
  const out: TracePoint[] = [];
  const per = Math.floor(n / (verts.length - 1));
  for (let s = 0; s < verts.length - 1; s++) {
    for (let i = 0; i < per; i++) {
      const t = i / per;
      out.push({ x: verts[s].x + t * (verts[s + 1].x - verts[s].x), y: verts[s].y + t * (verts[s + 1].y - verts[s].y) });
    }
  }
  out.push({ ...verts[verts.length - 1] });
  return out;
}

function jittered(points: TracePoint[], amt: number, seed = 7): TracePoint[] {
  let s = seed;
  const rand = () => {
    s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
    return s / 0x7fffffff - 0.5;
  };
  return points.map((p, i) => (i === 0 || i === points.length - 1 ? p : { x: p.x + rand() * amt * 2, y: p.y + rand() * amt * 2 }));
}

describe('the rite registry', () => {
  it('opens with Meteor, and refuses unknown rites', () => {
    expect(RITES.map((r) => r.id)).toEqual(['meteor']);
    expect(findRite('meteor')?.element).toBe('fire');
    expect(findRite('nope')).toBeUndefined();
    expect(() => rite('nope')).toThrow();
  });
});

describe('the recogniser', () => {  it('grades a clean trace full, wherever and however large it is drawn', () => {
    expect(gradeRite(alongTemplate(), TEMPLATE)).toBe('full');
    const moved = alongTemplate().map((p) => ({ x: p.x * 0.3 + 0.6, y: p.y * 0.3 + 0.1 }));
    expect(gradeRite(moved, TEMPLATE)).toBe('full');
    expect(gradeRite([...alongTemplate()].reverse(), TEMPLATE)).toBe('full');
  });

  it('recognises sparse pointer events without depending on drawing speed', () => {
    expect(gradeRite(TEMPLATE.map(([x, y]) => ({ x, y })), TEMPLATE)).toBe('full');
  });

  it('forgives a shaky hand but not a wrong shape', () => {
    expect(matchRite(jittered(alongTemplate(), 0.03), TEMPLATE)).toBeGreaterThan(0.8);
    // A straight line is not an M.
    const line = Array.from({ length: 40 }, (_, i) => ({ x: 0.1 + (0.8 * i) / 39, y: 0.5 }));
    expect(gradeRite(line, TEMPLATE)).toBe('botch');
    // A square is not an M either.
    const square = [
      ...Array.from({ length: 10 }, (_, i) => ({ x: 0.2 + (0.6 * i) / 9, y: 0.2 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 0.8, y: 0.2 + (0.6 * i) / 9 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 0.8 - (0.6 * i) / 9, y: 0.8 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 0.2, y: 0.8 - (0.6 * i) / 9 })),
    ];
    expect(gradeRite(square, TEMPLATE)).toBe('botch');
  });

  it('a tap is never a trace', () => {
    expect(gradeRite([{ x: 0.5, y: 0.5 }], TEMPLATE)).toBe('botch');
    expect(gradeRite(Array.from({ length: 20 }, () => ({ x: 0.5, y: 0.5 })), TEMPLATE)).toBe('botch');
  });

  it('a shaky trace still reads, but only weakly past a point', () => {
    expect(gradeRite(jittered(alongTemplate(), 0.05), TEMPLATE)).toBe('weak');
    expect(gradeRite(jittered(alongTemplate(), 0.15), TEMPLATE)).toBe('botch');
  });
});

const conduit = (baseId: 'wand' | 'rod', materialId = baseId === 'wand' ? 'ironwood' : 'iron') =>
  makeEquipment({ baseId, materialId, rarity: Rarity.Common, ilvl: 4, quality: 1, identified: true });

/** A cleared room, a wand in the offhand, Meteor already learned. */
function ritualist(): World {
  const state = newGame(createRng(91));
  state.equipment.offhand = conduit('wand');
  state.ritesKnown = ['meteor'];
  startRun(state, 91);
  const w = new World(state);
  w.floor.enemies = [];
  w.floor.traps = [];
  const x = 10, y = 10;
  Object.assign(w.player, { x, y, facing: 0 });
  for (let yy = y - 7; yy <= y + 7; yy++) for (let xx = x - 7; xx <= x + 7; xx++) w.floor.tiles[yy * w.floor.width + xx] = FLOOR;
  w.floor.doors = w.floor.doors.filter((d) => Math.abs(d.x - x) + Math.abs(d.y - y) > 8);
  w.floor.stairs = w.floor.stairs.filter((s) => Math.abs(s.x - x) + Math.abs(s.y - y) > 8);
  w.floor.props = w.floor.props.filter((p) => Math.abs(p.x - x) + Math.abs(p.y - y) > 8);
  return w;
}

/** A sturdy target on a free tile of the player's room, never acting. */
function roomTarget(w: World, x: number, y: number, def = 'ghoul') {
  const e = createEnemy(enemyDef(def), x, y, 2, 'target', 1);
  e.hp = e.maxHp = 400;
  e.attackCd = 999;
  w.floor.enemies.push(e);
  return e;
}

function playerRoom(w: World) {
  return w.floor.rooms.find((r) => inRoom(r, w.player.x, w.player.y))!;
}

function trace(w: World, points: TracePoint[]): boolean {
  expect(w.beginRiteDraw('meteor')).toBe(true);
  for (const p of points) w.addRitePoint(p.x, p.y);
  return w.endRiteDraw();
}

describe('rites in an old save', () => {
  it('migrates forward: nothing known, no floor has heard one', () => {
    const state = newGame(createRng(94)) as any;
    startRun(state, 94);
    state.revision = 30;
    delete state.ritesKnown;
    delete state.run.riteCastDepth;
    const loaded = parseSave(JSON.stringify(state))!;
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.revision).toBe(SAVE_REVISION);
    expect(loaded.ritesKnown).toEqual([]);
    expect(loaded.run!.riteCastDepth).toBeNull();
  });
});

describe("Meteor's carving", () => {
  it('waits on depth 3, and studying it teaches the rite for good', () => {
    const state = newGame(createRng(95));
    state.equipment.offhand = conduit('wand');
    startRun(state, 95);
    const w = new World(state);
    w.changeFloorForTest('down');
    w.changeFloorForTest('down');
    expect(w.run.depth).toBe(3);
    const carving = w.floor.props.find((p) => p.kind === 'carving');
    expect(carving?.rite).toBe('meteor');
    // Stand beside it, facing it, and read where it stands.
    const nx = carving!.x + 1, ny = carving!.y;
    w.floor.tiles[ny * w.floor.width + nx] = FLOOR;
    const facing = ([0, 1, 2, 3] as const).find((d) => nx + DX[d] === carving!.x && ny + DY[d] === carving!.y)!;
    Object.assign(w.player, { x: nx, y: ny, facing });
    expect(w.interactionHint()).toBe('Study the carving');
    w.interact();
    expect(w.state.ritesKnown).toContain('meteor');
    expect(carving!.used).toBe(true);
  });

  it('is not placed twice, nor for a rite already learned', () => {
    const state = newGame(createRng(95));
    state.equipment.offhand = conduit('wand');
    state.ritesKnown = ['meteor'];
    startRun(state, 95);
    const w = new World(state);
    w.changeFloorForTest('down');
    w.changeFloorForTest('down');
    expect(w.floor.props.some((p) => p.kind === 'carving')).toBe(false);
  });
});

describe('casting Meteor', () => {
  it('refuses without a conduit, and refuses the same floor twice', () => {
    const bare = ritualist();
    bare.state.equipment.offhand = null;
    bare.refreshDerived();
    expect(bare.beginRiteDraw('meteor')).toBe(false);
    const w = ritualist();
    expect(trace(w, alongTemplate())).toBe(true);
    expect(w.beginRiteDraw('meteor')).toBe(false);
    expect(w.endRiteDraw()).toBe(false);
  });

  it('a clean trace burns every charge and brings the sky down on the room', () => {
    const w = ritualist();
    const room = playerRoom(w);
    const e1 = roomTarget(w, room.x, room.y);
    const e2 = roomTarget(w, room.x + room.w - 1, room.y + room.h - 1);
    Object.assign(w.player, { x: room.x, y: room.y });
    const charges = w.run.conduit!.charges;
    expect(charges).toBeGreaterThan(0);
    expect(trace(w, alongTemplate())).toBe(true);
    expect(e1.hp).toBeLessThan(400);
    expect(e2.hp).toBeLessThan(400);
    expect(e1.burn).toBeDefined();
    expect(w.run.conduit!.charges).toBe(0);
    expect(w.run.riteCastDepth).toBe(w.run.depth);
    expect(w.anim.weave?.element).toBe('fire');
  });

  it('closing an untouched surface or cancelling spends nothing', () => {
    const w = ritualist();
    const charges = w.run.conduit!.charges;
    const stamina = w.player.stamina;
    expect(w.beginRiteDraw('meteor')).toBe(true);
    expect(w.endRiteDraw()).toBe(false);
    expect(w.beginRiteDraw('meteor')).toBe(true);
    w.addRitePoint(0.2, 0.4);
    w.cancelRiteDraw();
    expect(w.run.conduit!.charges).toBe(charges);
    expect(w.player.stamina).toBe(stamina);
    expect(w.run.riteCastDepth ?? null).toBeNull();
  });

  it('keeps the end of a slowly drawn, densely sampled mark', () => {
    const w = ritualist();
    expect(w.beginRiteDraw('meteor')).toBe(true);
    for (const p of alongTemplate(1800)) w.addRitePoint(p.x, p.y);
    expect(w.riteDraw!.points.length).toBeGreaterThan(256);
    expect(gradeRite(w.riteDraw!.points, TEMPLATE)).toBe('full');
  });

  it('a botched trace burns the charges and the caster', () => {
    const w = ritualist();
    const hp = w.player.hp;
    const charges = w.run.conduit!.charges;
    expect(trace(w, Array.from({ length: 20 }, () => ({ x: 0.5, y: 0.5 })))).toBe(true);
    expect(w.player.hp).toBeLessThan(hp);
    expect(w.run.conduit!.charges).toBe(charges - charges);
    expect(w.run.conduit!.charges).toBe(0);
  });
});
