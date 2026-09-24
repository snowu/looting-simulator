import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { DIFFICULTIES, DifficultyId } from '../data/difficulty';
import { newGame, GameState } from '../state/game-state';
import { startRun, endRun } from '../systems/run';
import { World } from '../world/world';
import { EnemyState, FLOOR, createEnemy, generateFloor } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { derivePlayer, emptyEquipment } from '../systems/player';
import { durability, makeMaterial, repairCost, rollEquipment } from '../systems/items';
import { addItem } from '../state/inventory';
import { flaskMax } from '../systems/healing';
import { parseSave, serializeSave } from '../state/save-format';

/**
 * Normal's second pass: the knobs that soften *time* and *punishment*, not
 * just numbers. Normal is for someone who wants the dungeon and the loot
 * without the reflex test, so each rule here is checked against Hard in the
 * same situation.
 */

function tick(w: World, seconds: number, each?: () => void): void {
  for (let t = 0; t < seconds; t += 1 / 60) {
    w.update(1 / 60);
    each?.();
  }
}

/** A cleared room with open floor on all four sides of the player. */
function arena(difficulty: DifficultyId, seed = 1): World {
  const state = newGame(createRng(seed));
  state.difficulty = difficulty;
  startRun(state, seed);
  const w = new World(state);
  const f = w.floor;
  f.enemies = [];
  f.traps = [];
  f.props = f.props.filter((p) => !p.blocking);
  const free = (x: number, y: number) =>
    f.tiles[y * f.width + x] === FLOOR && !f.doors.some((d) => d.x === x && d.y === y) && !f.stairs.some((s) => s.x === x && s.y === y);
  for (let y = 2; y < f.height - 2; y++) for (let x = 2; x < f.width - 2; x++) {
    if (!free(x, y) || !DIRS.every((d) => free(x + DX[d], y + DY[d]))) continue;
    Object.assign(w.player, { x, y });
    Object.assign(w.anim, { fromX: x, fromY: y });
    return w;
  }
  throw new Error('no arena');
}

function spawnAround(w: World, id: string, count: number): EnemyState[] {
  const p = w.player;
  return DIRS.slice(0, count).map((d) => {
    const e = createEnemy(enemyDef(id), p.x + DX[d], p.y + DY[d], turnAround(d), `${id}${d}`, 1);
    w.floor.enemies.push(e);
    return e;
  });
}

/** Seconds until a monster adjacent to the player first draws blood. */
function firstHit(difficulty: DifficultyId): number {
  const w = arena(difficulty);
  spawnAround(w, 'skeleton', 1);
  w.player.hp = 5000;
  let t = 0;
  while (w.player.hp === 5000 && t < 20) {
    w.update(1 / 60);
    t += 1 / 60;
  }
  return t;
}

describe('normal slows the fight down', () => {
  it('monsters take longer to land their first blow', () => {
    const hard = firstHit('hard');
    const normal = firstHit('normal');
    expect(normal).toBeGreaterThan(hard * 1.2);
  });

  it('the parry window is wider', () => {
    for (const [id, open] of [['hard', false], ['normal', true]] as const) {
      const w = arena(id);
      w.setBlock(true);
      // Past Hard's 0.22s window, inside Normal's.
      tick(w, 0.3);
      expect(w.parryWindow, id).toBe(open);
    }
  });

  it('no more than two monsters wind up at once', () => {
    let most = 0;
    let any = 0;
    const w = arena('normal');
    spawnAround(w, 'skeleton', 4);
    w.player.hp = 5000;
    tick(w, 12, () => {
      const swinging = w.floor.enemies.filter((e) => e.ai === 'windup' || (e.comboLeft ?? 0) > 0).length;
      most = Math.max(most, swinging);
      any += swinging;
    });
    expect(any).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(DIFFICULTIES.normal.maxAttackers);
  });

  it('hard lets the whole pack swing', () => {
    let most = 0;
    const w = arena('hard');
    spawnAround(w, 'skeleton', 4);
    w.player.hp = 5000;
    tick(w, 12, () => {
      most = Math.max(most, w.floor.enemies.filter((e) => e.ai === 'windup' || (e.comboLeft ?? 0) > 0).length);
    });
    expect(most).toBeGreaterThan(2);
  });

  it('never feints, and a flurry stops after one follow-up', () => {
    const w = arena('normal');
    const [goblin, ghoul] = [...spawnAround(w, 'goblin', 1), ...spawnAround(w, 'ghoul', 2).slice(1)];
    w.player.hp = 5000;
    let feinted = false;
    let flurry = 0;
    tick(w, 40, () => {
      feinted ||= !!goblin.feinted;
      flurry = Math.max(flurry, ghoul.comboLeft ?? 0);
      // Keep the goblin in the fight rather than fleeing with a stolen purse.
      goblin.hp = goblin.maxHp;
      delete goblin.stolen;
    });
    expect(feinted).toBe(false);
    expect(flurry).toBeLessThanOrEqual(1);
  });
});

describe('normal is kinder to the player', () => {
  it('a raised guard absorbs more, never past the shield cap', () => {
    const hard = derivePlayer(emptyEquipment(), {}, 'hard').block;
    const normal = derivePlayer(emptyEquipment(), {}, 'normal').block;
    expect(normal).toBeCloseTo(hard + DIFFICULTIES.normal.blockBonus);
    expect(normal).toBeLessThanOrEqual(0.9);
  });

  it('starts every delve with an extra flask charge', () => {
    const charges = (id: DifficultyId) => {
      const s = newGame(createRng(9));
      s.difficulty = id;
      return startRun(s, 9).flask!.charges;
    };
    expect(charges('normal')).toBe(charges('hard') + 1);
    expect(charges('normal')).toBe(flaskMax(0, 1));
  });

  it('mends slowly to half health while nothing hunts you, and no further', () => {
    const normal = arena('normal');
    const hard = arena('hard');
    for (const w of [normal, hard]) w.player.hp = 1;
    tick(normal, 3);
    tick(hard, 3);
    expect(normal.player.hp).toBe(1); // not before the wait is up
    tick(normal, 120);
    tick(hard, 120);
    expect(hard.player.hp).toBe(1);
    expect(normal.player.hp).toBe(Math.round(normal.derived.maxHp * DIFFICULTIES.normal.restHeal));
  });

  it('does not mend while a monster is hunting you', () => {
    const w = arena('normal');
    const [e] = spawnAround(w, 'skeleton', 1);
    w.player.hp = 10;
    // Awake and hunting, but held still so it never lands a blow.
    tick(w, 10, () => { e.alert = 6; e.ai = 'recover'; e.timer = 1; });
    expect(w.player.hp).toBe(10);
  });

  it('repairs cost less', () => {
    const item = rollEquipment(createRng(4), 4, 0, { baseId: 'kite_shield' });
    item.dur = 1;
    expect(repairCost(item, 'normal')).toBeLessThan(repairCost(item, 'hard'));
    expect(repairCost(item)).toBe(repairCost(item, 'hard'));
  });

  it('wears gear half as fast', () => {
    const used = (id: DifficultyId) => {
      const w = arena(id);
      const shield = rollEquipment(createRng(2), 1, 0, { baseId: 'kite_shield' });
      w.state.equipment.offhand = shield;
      const before = durability(shield).cur;
      // Private, but the rule under test lives there: every wear event runs through it.
      for (let i = 0; i < 20; i++) (w as unknown as { wear(s: string, n: number): void }).wear('offhand', 1);
      return before - durability(shield).cur;
    };
    expect(used('hard')).toBe(20);
    expect(used('normal')).toBe(10);
  });
});

describe('a death on normal', () => {
  function dieWith(id: DifficultyId): { state: GameState; summary: ReturnType<typeof endRun> } {
    const state = newGame(createRng(21));
    state.difficulty = id;
    const run = startRun(state, 21);
    addItem(run.backpack, makeMaterial('bone', 3));
    run.gold = 200;
    const goldBefore = state.gold;
    const summary = endRun(state, 'dead');
    state.gold -= goldBefore;
    return { state, summary };
  }

  it('keeps the pack and loses a tenth of the coin to the Shade', () => {
    const { state, summary } = dieWith('normal');
    expect(summary.keptPack).toBe(true);
    expect(summary.lost).toEqual([]);
    expect(summary.items.some((it) => it.ref === 'bone')).toBe(true);
    expect(state.stash.items.some((it) => it.ref === 'bone')).toBe(true);
    expect(state.gold).toBe(180);
    expect(state.grave).toMatchObject({ gold: 20, items: [] });
    expect(summary.graveDepth).toBe(1);
  });

  it('remembers it kept the pack through a save round trip', () => {
    const { state } = dieWith('normal');
    expect(parseSave(serializeSave(state))!.lastRun!.keptPack).toBe(true);
  });

  it('still costs the whole pack on hard', () => {
    const { state, summary } = dieWith('hard');
    expect(summary.keptPack).toBeUndefined();
    expect(summary.lost.some((it) => it.ref === 'bone')).toBe(true);
    expect(state.gold).toBe(0);
    expect(state.grave!.gold).toBe(200);
  });
});

describe('a mimic on normal', () => {
  /** Open a mimic on 5 health and let it bite. */
  function openAt5(id: DifficultyId): World {
    const state = newGame(createRng(73));
    state.difficulty = id;
    startRun(state, 73);
    const w = new World(state);
    const f = w.floor;
    f.enemies = [];
    f.props = f.props.filter((p) => !p.blocking);
    const free = (x: number, y: number) =>
      f.tiles[y * f.width + x] === FLOOR && !f.doors.some((d) => d.x === x && d.y === y) && !f.stairs.some((s) => s.x === x && s.y === y);
    outer: for (let y = 2; y < f.height - 2; y++) for (let x = 2; x < f.width - 2; x++) for (const d of DIRS) {
      if (!free(x, y) || !free(x + DX[d], y + DY[d])) continue;
      Object.assign(w.player, { x, y, facing: d });
      Object.assign(w.anim, { fromX: x, fromY: y, yaw: d * Math.PI / 2, yawTo: d * Math.PI / 2 });
      break outer;
    }
    const t = w.frontTile();
    f.props.push({ id: 'jaws', kind: 'chest', x: t.x, y: t.y, used: false, tier: 'chest', blocking: true, mimic: true });
    w.player.hp = 5;
    w.interact();
    const mimic = f.enemies[0];
    for (let i = 0; i < 25 && (mimic.grabT ?? 0) > 0; i++) w.update(0.05);
    return w;
  }

  it('bites, but never kills', () => {
    const w = openAt5('normal');
    expect(w.run.outcome).toBe('active');
    expect(w.player.hp).toBe(1);
  });

  it('still kills on hard', () => {
    expect(openAt5('hard').run.outcome).toBe('dead');
  });
});

describe('the throne on normal', () => {
  function throne(id: DifficultyId, seed = 77) {
    const state = newGame(createRng(seed));
    state.difficulty = id;
    startRun(state, seed);
    const w = new World(state);
    w.run.depth = 6;
    w.run.floors[5] = generateFloor(seed, 6, id);
    const room = w.floor.rooms.find((r) => r.role === 'throne')!;
    return { w, room };
  }
  const guards = (w: World, room: { x: number; y: number; w: number; h: number }) =>
    w.floor.enemies.filter((e) => e.def === 'hollow_knight' && e.x >= room.x && e.x < room.x + room.w && e.y >= room.y && e.y < room.y + room.h).length;

  it('leaves the King without his guard', () => {
    for (let seed = 70; seed < 76; seed++) {
      const n = throne('normal', seed);
      const h = throne('hard', seed);
      expect(guards(n.w, n.room), `seed ${seed}`).toBe(0);
      expect(guards(h.w, h.room), `seed ${seed}`).toBe(2);
    }
  });

  it('lets you step back out of the fog', () => {
    for (const [id, locks] of [['normal', false], ['hard', true]] as const) {
      const { w, room } = throne(id);
      Object.assign(w.player, { x: room.x + 1, y: room.y + room.h - 2 });
      tick(w, 0.1);
      const gate = w.floor.doors.find((d) => d.boss)!;
      expect(gate.locked, id).toBe(locks);
    }
  });
});
