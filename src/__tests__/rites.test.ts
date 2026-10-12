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
import { createEnemy, doorAt, FLOOR, inRoom, stairsFront } from '../systems/dungeon';
import { reachable, splitsNothing } from '../systems/surfaces';
import { enemyDef } from '../data/enemies';
import { RITE_CHARGE_COST, World } from '../world/world';
import { beginLabRite, spawnLabCarving } from '../dev/lab-room';

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

describe('the recogniser', () => {
  it('grades a clean trace full, wherever and however large it is drawn', () => {
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
    // A straight line is not the meteor impact mark.
    const line = Array.from({ length: 40 }, (_, i) => ({ x: 0.1 + (0.8 * i) / 39, y: 0.5 }));
    expect(gradeRite(line, TEMPLATE)).toBe('botch');
    // A square is not the meteor impact mark either.
    const square = [
      ...Array.from({ length: 10 }, (_, i) => ({ x: 0.2 + (0.6 * i) / 9, y: 0.2 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 0.8, y: 0.2 + (0.6 * i) / 9 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 0.8 - (0.6 * i) / 9, y: 0.8 })),
      ...Array.from({ length: 10 }, (_, i) => ({ x: 0.2, y: 0.8 - (0.6 * i) / 9 })),
    ];
    expect(gradeRite(square, TEMPLATE)).toBe('botch');
  });

  it('accepts rounded corners and tilted hand drawing, but not a diagonal swipe', () => {
    const rounded = [[.18,.16],[.32,.48],[.46,.79],[.50,.83],[.54,.79],[.68,.48],[.82,.16]].map(([x,y])=>({x,y}));
    expect(gradeRite(rounded, TEMPLATE)).toBe('full');
    const a = 12 * Math.PI / 180;
    const tilted = alongTemplate().map(p=>({x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)}));
    expect(gradeRite(tilted, TEMPLATE)).toBe('full');
    const swipe = Array.from({length:40},(_,i)=>({x:i/39,y:i/39}));
    expect(gradeRite(swipe, TEMPLATE)).toBe('botch');
  });

  it('botches other marks: upside down, sideways, a line, a circle', () => {
    const along = (pts: [number, number][]) => {
      const out: TracePoint[] = [];
      for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < 30; k++) out.push({ x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k / 30, y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k / 30 });
      out.push({ x: pts[pts.length - 1][0], y: pts[pts.length - 1][1] });
      return out;
    };
    const ring = Array.from({ length: 40 }, (_, i) => [0.5 + 0.35 * Math.cos(i / 39 * 2 * Math.PI), 0.5 + 0.35 * Math.sin(i / 39 * 2 * Math.PI)] as [number, number]);
    for (const wrong of [TEMPLATE.map(([x, y]) => [x, 1 - y] as [number, number]), TEMPLATE.map(([x, y]) => [y, x] as [number, number]), [[0.1, 0.1], [0.9, 0.9]] as [number, number][], ring]) {
      expect(gradeRite(along(wrong), TEMPLATE)).toBe('botch');
    }
  });

  it('a tap is never a trace', () => {
    expect(gradeRite([{ x: 0.5, y: 0.5 }], TEMPLATE)).toBe('botch');
    expect(gradeRite(Array.from({ length: 20 }, () => ({ x: 0.5, y: 0.5 })), TEMPLATE)).toBe('botch');
  });

  it('a shaky trace still reads, but only weakly past a point', () => {
    expect(gradeRite(jittered(alongTemplate(), 0.05), TEMPLATE)).toBe('full');
    expect(gradeRite(jittered(alongTemplate(), 0.15), TEMPLATE)).toBe('weak');
    expect(gradeRite(jittered(alongTemplate(), 0.35), TEMPLATE)).toBe('botch');
  });
});

const conduit = (baseId: 'wand' | 'rod', materialId = baseId === 'wand' ? 'ironwood' : 'iron') =>
  makeEquipment({ baseId, materialId, rarity: Rarity.Common, ilvl: 4, quality: 1, identified: true });

/** A cleared room, a wand in the offhand, Meteor already learned. */
function ritualist(base: 'wand' | 'rod' = 'wand'): World {
  const state = newGame(createRng(91));
  state.equipment.offhand = conduit(base);
  state.ritesKnown = ['meteor'];
  startRun(state, 91);
  const w = new World(state);
  w.floor.enemies = [];
  w.floor.traps = [];
  w.floor.surfaces = [];
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
  it('migrates forward: nothing known yet', () => {
    const state = newGame(createRng(94)) as any;
    startRun(state, 94);
    state.revision = 30;
    delete state.ritesKnown;
    delete state.run.riteCastDepth;
    const loaded = parseSave(JSON.stringify(state))!;
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.revision).toBe(SAVE_REVISION);
    expect(loaded.ritesKnown).toEqual([]);
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

  it('never blocks a doorway or a stair landing, and cuts nothing off', () => {
    let placed = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const state = newGame(createRng(seed));
      startRun(state, seed);
      const w = new World(state);
      w.changeFloorForTest('down');
      w.changeFloorForTest('down');
      const f = w.floor, c = f.props.find((p) => p.kind === 'carving');
      if (!c) continue;
      expect(doorAt(f, c.x, c.y)).toBeFalsy();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) expect(doorAt(f, c.x + dx, c.y + dy)).toBeFalsy();
      for (const s of f.stairs) expect(stairsFront(s)).not.toEqual({ x: c.x, y: c.y });
      expect(splitsNothing(f, c.x, c.y)).toBe(true);
      const withSlab = reachable(f);
      f.props = f.props.filter((p) => p !== c);
      expect(withSlab).toBeGreaterThanOrEqual(reachable(f) - 1);
      placed++;
    }
    expect(placed).toBeGreaterThanOrEqual(25); // the rules leave room for it on (nearly) every floor
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
  it('refuses without a conduit, but allows repeated casts on the same floor', () => {
    const bare = ritualist();
    bare.state.equipment.offhand = null;
    bare.refreshDerived();
    expect(bare.beginRiteDraw('meteor')).toBe(false);
    const w = ritualist('rod');
    w.run.riteCastDepth = w.run.depth; // Legacy saves must not keep the old lock.
    expect(trace(w, alongTemplate())).toBe(true);
    expect(w.run.conduit!.charges).toBe(2);
    expect(trace(w, alongTemplate())).toBe(true);
    expect(w.run.conduit!.charges).toBe(0);
    expect(w.beginRiteDraw('meteor')).toBe(false);
    expect(w.endRiteDraw()).toBe(false);
  });

  it('opens mid-stride: the step finishes in the slowed world', () => {
    const w = ritualist();
    w.anim.moveT = 0.3;
    expect(w.moving).toBe(true);
    expect(w.riteAvailable('meteor')).toBe(true);
    expect(trace(w, alongTemplate())).toBe(true);
  });

  it('casts nothing once the run has ended mid-trace, and never lifts the dead', () => {
    const w = ritualist();
    const charges = w.run.conduit!.charges;
    expect(w.beginRiteDraw('meteor')).toBe(true);
    for (const p of [{ x: 0.5, y: 0.5 }, { x: 0.52, y: 0.5 }, { x: 0.9, y: 0.9 }]) w.addRitePoint(p.x, p.y); // a botch
    w.player.hp = 0;
    w.run.outcome = 'dead';
    expect(w.endRiteDraw()).toBe(false);
    expect(w.player.hp).toBe(0);
    expect(w.run.conduit!.charges).toBe(charges);
    expect(w.drainEvents().some((e) => e.type === 'rite')).toBe(false);
  });

  it('a clean trace spends two charges and brings the sky down on the room', () => {
    const w = ritualist();
    const room = playerRoom(w);
    const e1 = roomTarget(w, room.x, room.y);
    const e2 = roomTarget(w, room.x + room.w - 1, room.y + room.h - 1);
    Object.assign(w.player, { x: room.x, y: room.y });
    const charges = w.run.conduit!.charges;
    expect(charges).toBeGreaterThan(0);
    expect(trace(w, alongTemplate())).toBe(true);
    expect(e1.hp).toBe(400);
    expect(w.spellFx.filter(fx => fx.kind === 'meteor')).toHaveLength(2);
    for (let i = 0; i < 20; i++) w.update(0.025);
    expect(e1.hp).toBeLessThan(400);
    expect(e2.hp).toBeLessThan(400);
    expect(e1.burn).toBeDefined();
    expect(w.run.conduit!.charges).toBe(charges - RITE_CHARGE_COST);
    expect(w.anim.weave?.element).toBe('fire');
    expect(w.drainEvents().find(e => e.type === 'rite')).toMatchObject({ grade: 'full' });
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
    expect(w.drainEvents().some(e => e.type === 'rite')).toBe(false);
  });

  it('thins a very long stroke in place, so the same stroke stays the same array', () => {
    const w = ritualist();
    expect(w.beginRiteDraw('meteor')).toBe(true);
    const stroke = w.riteDraw!.points;
    for (let i = 0; i < 1500; i++) w.addRitePoint((i % 100) / 100, Math.floor(i / 100) / 15);
    expect(w.riteDraw!.points).toBe(stroke);
    expect(stroke.length).toBeLessThan(1024);
    expect(stroke[stroke.length - 1]).toEqual({ x: 0.99, y: 14 / 15 });
    w.cancelRiteDraw();
  });

  it('keeps the end of a slowly drawn, densely sampled mark', () => {
    const w = ritualist();
    expect(w.beginRiteDraw('meteor')).toBe(true);
    for (const p of alongTemplate(1800)) w.addRitePoint(p.x, p.y);
    expect(w.riteDraw!.points.length).toBeGreaterThan(256);
    expect(gradeRite(w.riteDraw!.points, TEMPLATE)).toBe('full');
  });

  it('keeps a strong repeatable hit, with weak traces halving it', () => {
    const damage = (points = alongTemplate()) => {
      const w = ritualist();
      const r = playerRoom(w);
      const target = roomTarget(w, r.x, r.y);
      expect(trace(w, points)).toBe(true);
      for (let i = 0; i < 20; i++) w.update(0.025);
      return 400 - target.hp;
    };
    const full = damage(), weak = damage(jittered(alongTemplate(), 0.15));
    expect(full).toBeGreaterThan(0);
    expect(weak).toBeLessThan(full * 0.6);
    expect(weak).toBeGreaterThan(full * 0.4);
  });

  it('can be cast again after charges recover, without changing floor', () => {
    const w = ritualist();
    expect(trace(w, alongTemplate())).toBe(true);
    expect(w.run.conduit!.charges).toBe(1);
    expect(w.beginRiteDraw('meteor')).toBe(false);
    for (let i = 0; i < 260; i++) w.update(0.05);
    expect(w.beginRiteDraw('meteor')).toBe(true);
  });

  it('ignites oil when an empty-room meteor lands', () => {
    const w = ritualist();
    expect(trace(w, alongTemplate())).toBe(true);
    const fx = w.spellFx.find(fx => fx.kind === 'meteor')!;
    w.floor.surfaces = [{ x: fx.x, y: fx.y, kind: 'oil' }];
    expect(w.floor.surfaces[0].kind).toBe('oil');
    for (let i = 0; i < 20; i++) w.update(0.025);
    expect(w.floor.surfaces[0].kind).toBe('fire');
  });

  it('shows a falling star in an empty room without hurting the caster', () => {
    const w = ritualist();
    const hp = w.player.hp;
    expect(trace(w, alongTemplate())).toBe(true);
    expect(w.spellFx.some(fx => fx.kind === 'meteor')).toBe(true);
    for (let i = 0; i < 20; i++) w.update(0.025);
    expect(w.player.hp).toBe(hp);
    expect(w.drainEvents().some(e => e.type === 'sfx' && e.name === 'meteor')).toBe(true);
  });

  it('cannot land a pending hit across the living throne boundary', () => {
    const w = ritualist();
    const room = playerRoom(w);
    room.role = 'throne';
    const king = roomTarget(w, room.x + 1, room.y + 1, 'ashen_king');
    expect(trace(w, alongTemplate())).toBe(true);
    w.placePlayer(room.x - 1, room.y, 1);
    for (let i = 0; i < 20; i++) w.update(0.025);
    expect(king.hp).toBe(400);
  });

  it('clears pending impacts when leaving the floor', () => {
    const w = ritualist();
    expect(trace(w, alongTemplate())).toBe(true);
    expect(w.spellFx.length).toBeGreaterThan(0);
    w.changeFloorForTest('down');
    expect(w.spellFx).toHaveLength(0);
  });

  it('a botched trace burns the charges and the caster', () => {
    const w = ritualist();
    const hp = w.player.hp;
    const charges = w.run.conduit!.charges;
    expect(trace(w, Array.from({ length: 20 }, () => ({ x: 0.5, y: 0.5 })))).toBe(true);
    expect(w.player.hp).toBeLessThan(hp);
    expect(w.drainEvents().find(e => e.type === 'rite')).toMatchObject({ grade: 'botch' });
    expect(w.run.conduit!.charges).toBe(charges - RITE_CHARGE_COST);
  });
});


describe('rite testing in the scratch lab', () => {
  it('rearms another attempt and keeps an existing conduit equipped', () => {
    const w = ritualist();
    const wand = w.state.equipment.offhand;
    expect(trace(w, alongTemplate())).toBe(true);
    expect(beginLabRite(w)).toBe(true);
    expect(w.state.equipment.offhand).toBe(wand);
    expect(w.run.conduit!.charges).toBeGreaterThan(0);
    for (const p of alongTemplate()) w.addRitePoint(p.x, p.y);
    expect(w.endRiteDraw()).toBe(true);
  });

  it('equips a wand without losing a shield or a two-handed weapon', () => {
    const w = ritualist();
    const weapon = makeEquipment({ baseId: 'great_maul', materialId: 'iron', rarity: Rarity.Common, ilvl: 4, identified: true });
    const shield = makeEquipment({ baseId: 'tower_shield', materialId: 'iron', rarity: Rarity.Common, ilvl: 4, identified: true });
    w.state.equipment.weapon = weapon;
    w.state.equipment.offhand = shield;
    w.state.ritesKnown = [];
    expect(beginLabRite(w)).toBe(true);
    expect(w.state.equipment.offhand?.ref).toBe('wand');
    expect(w.state.stash.items.some(item => item.uid === weapon.uid && item.ref === weapon.ref)).toBe(true);
    expect(w.state.stash.items.some(item => item.uid === shield.uid && item.ref === shield.ref)).toBe(true);
    expect(w.state.ritesKnown).toContain('meteor');
  });

  it('places and resets the real studyable carving', () => {
    const w = ritualist();
    expect(spawnLabCarving(w)).toBe(true);
    expect(w.state.ritesKnown).not.toContain('meteor');
    expect(w.interactionHint()).toBe('Study the carving');
    w.interact();
    expect(w.state.ritesKnown).toContain('meteor');
    const carving = w.floor.props.find(p => p.kind === 'carving')!;
    expect(carving.used).toBe(true);
    expect(spawnLabCarving(w)).toBe(true);
    expect(carving.used).toBe(false);
    expect(w.state.ritesKnown).not.toContain('meteor');
  });
});
