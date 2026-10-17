import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { PITCH_FUSE, SHADOW_STEP_SECONDS, World } from '../world/world';
import { EnemyState, FLOOR, Room, blocksMove, blocksSight, createEnemy, enemyAt, generateFloor, isBossDoor } from '../systems/dungeon';
import { surfaceKindAt } from '../systems/surfaces';
import { BOSS_ID, KING_PHASES, enemyDef, enemyView, kingPhase, phaseForHp } from '../data/enemies';
import { makeConsumable } from '../systems/items';
import { addItem } from '../state/inventory';
import { Dir, dirOf } from '../core/dir';
import { uniqueOf } from '../systems/items';

function tick(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

/** An empty stretch of floor with the player standing on it. */
function arena(seed = 1): World {
  const state = newGame(createRng(seed));
  startRun(state, seed);
  const w = new World(state);
  const f = w.floor;
  f.enemies = [];
  f.traps = [];
  f.props = f.props.filter((p) => !p.blocking);
  const free = (x: number, y: number) =>
    f.tiles[y * f.width + x] === FLOOR && !f.doors.some((d) => d.x === x && d.y === y) && !f.stairs.some((s) => s.x === x && s.y === y);
  for (let y = 2; y < f.height - 6; y++) for (let x = 2; x < f.width - 6; x++) {
    for (const d of DIRS) {
      let ok = free(x, y) && free(x - DX[d], y - DY[d]);
      for (let k = 1; k <= 5 && ok; k++) ok = free(x + DX[d] * k, y + DY[d] * k);
      if (ok) {
        Object.assign(w.player, { x, y, facing: d });
        Object.assign(w.anim, { fromX: x, fromY: y, yaw: (d * Math.PI) / 2, yawTo: (d * Math.PI) / 2 });
        return w;
      }
    }
  }
  throw new Error('no arena');
}

/** The King one tile ahead, holding still unless something makes him act. */
function king(w: World, hpFrac = 1): EnemyState {
  const t = w.frontTile(1);
  const e = createEnemy(enemyDef(BOSS_ID), t.x, t.y, turnAround(w.player.facing), 'king', 6);
  e.ai = 'chase';
  e.alert = 6;
  e.attackCd = 99;
  e.hp = Math.max(1, Math.round(e.maxHp * hpFrac));
  w.floor.enemies.push(e);
  return e;
}

/** Let him announce the stage his health is in, then hand him a free turn. */
function ready(w: World, boss: EnemyState): void {
  w.update(1 / 60);
  Object.assign(boss, { ai: 'chase', timer: 0, attackCd: 0, alert: 6 });
}

/** A real depth-six floor, with the player put down inside the throne room. */
function throne(seed = 77): { w: World; room: Room; boss: EnemyState } {
  const state = newGame(createRng(seed));
  startRun(state, seed);
  const w = new World(state);
  w.run.depth = 6;
  w.run.floors[5] = generateFloor(seed, 6);
  const f = w.floor;
  const room = f.rooms.find((r) => r.role === 'throne')!;
  const boss = f.enemies.find((e) => e.def === BOSS_ID)!;
  Object.assign(w.player, { x: room.x + 1, y: room.y + room.h - 2 });
  return { w, room, boss };
}

const inRoom = (r: Room, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

describe('the King comes apart in three stages', () => {
  it('reads its phase off the health bar', () => {
    expect(phaseForHp(1)).toBe(1);
    expect(phaseForHp(0.7)).toBe(1);
    expect(phaseForHp(0.65)).toBe(2);
    expect(phaseForHp(0.4)).toBe(2);
    expect(phaseForHp(0.3)).toBe(3);
    expect(phaseForHp(0)).toBe(3);
  });

  it('announces a stage once, and never walks back up', () => {
    const w = arena(2);
    const e = king(w, 0.5);
    tick(w, 0.1);
    expect(e.phase).toBe(2);
    // Healed above the line, the announcement stands: phases only ever advance.
    e.hp = e.maxHp;
    tick(w, 0.1);
    expect(e.phase).toBe(2);
  });

  it('walks through a stage it skipped over in one blow', () => {
    // A crit inside a parry window can take two thirds of the bar at once. The
    // dark has to happen anyway, or the middle of the fight silently does not
    // exist on exactly the runs that hit hardest.
    const { w, room, boss } = throne(9);
    const lit = w.floor.torches.filter((t) => inRoom(room, t.x, t.y)).length;
    expect(lit, 'the throne room starts lit').toBeGreaterThan(0);
    boss.hp = Math.round(boss.maxHp * 0.2);
    tick(w, 0.1);
    expect(boss.phase).toBe(3);
    expect(w.floor.torches.filter((t) => inRoom(room, t.x, t.y))).toHaveLength(0);
  });

  it('reels when a stage breaks instead of getting a free hit in', () => {
    const w = arena(3);
    const e = king(w, 0.5);
    const hp = w.player.hp;
    tick(w, 0.1);
    expect(e.ai).toBe('recover');
    expect(e.timer).toBeGreaterThan(0.5);
    // The beat is an opening, not a gift: it is not a parry, so it does not
    // hand out the parry's damage window.
    expect(e.vuln ?? 0).toBe(0);
    tick(w, 0.6);
    expect(w.player.hp, 'nothing lands while the room is changing').toBe(hp);
  });

  it('does not announce a stage on a corpse', () => {
    // Killed outright from the middle of the bar, he never reaches the last
    // stand — and nothing fires a fanfare over a body afterwards.
    const w = arena(4);
    const e = king(w, 0.4);
    tick(w, 0.1);
    expect(e.phase).toBe(2);
    (w as unknown as { killEnemy(x: EnemyState): void }).killEnemy(e);
    tick(w, 0.5);
    expect(e.ai).toBe('dead');
    expect(e.phase, 'he died in the dark, he never reached the last stand').toBe(2);
    expect(w.run.stats.bossKilled).toBe(true);
  });
});

describe('the dark', () => {
  it('puts out the throne room and nothing else', () => {
    const { w, room, boss } = throne(11);
    const outside = w.floor.torches.filter((t) => !inRoom(room, t.x, t.y)).length;
    boss.hp = Math.round(boss.maxHp * 0.5);
    tick(w, 0.1);
    expect(w.floor.torches.filter((t) => inRoom(room, t.x, t.y))).toHaveLength(0);
    expect(w.floor.torches.filter((t) => !inRoom(room, t.x, t.y)), 'the way back stays lit').toHaveLength(outside);
  });

  it('every seed gives him torches to put out', () => {
    // If the throne room can generate dark, the whole middle phase is a no-op
    // on those seeds. Measured at 3 to 6 per room; this is the guard against a
    // torch-density change quietly deleting the mechanic.
    for (let seed = 0; seed < 25; seed++) {
      const f = generateFloor(3000 + seed, 6);
      const r = f.rooms.find((rr) => rr.role === 'throne')!;
      expect(f.torches.filter((t) => inRoom(r, t.x, t.y)).length, `seed ${seed}`).toBeGreaterThan(0);
    }
  });

  it('melts away and re-forms beside you, never behind you, and never strikes as he comes', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const w = arena(seed);
      const boss = king(w, 0.5);
      ready(w, boss);
      // Stand him off, two tiles out: he comes for you through the dark.
      const away = w.frontTile(3);
      boss.x = boss.fromX = away.x;
      boss.y = boss.fromY = away.y;
      const hp = w.player.hp;
      w.update(1 / 60);
      expect(boss.lurk, `seed ${seed}`).toBe('shadow');
      expect(Math.abs(boss.x - w.player.x) + Math.abs(boss.y - w.player.y)).toBe(1);
      const back = turnAround(w.player.facing);
      expect(boss.x === w.player.x + DX[back] && boss.y === w.player.y + DY[back], 'never behind you').toBe(false);
      // Gone means gone: nothing is on his tile while he steps.
      expect(enemyAt(w.floor, boss.x, boss.y)).toBeUndefined();
      tick(w, SHADOW_STEP_SECONDS + 0.05);
      expect(boss.lurk).toBeUndefined();
      expect(boss.ai).toBe('recover');
      expect(w.player.hp, 'he comes back in recovery, not swinging').toBe(hp);
    }
  });

  it('does not step before the dark', () => {
    const w = arena();
    const boss = king(w, 0.9);
    const away = w.frontTile(3);
    boss.x = boss.fromX = away.x;
    boss.y = boss.fromY = away.y;
    boss.attackCd = 0;
    tick(w, 0.5);
    expect(boss.lurk).toBeUndefined();
  });
});

describe('the last stand', () => {
  it('spills burning pitch at your feet, always leaving two ways out, and it catches', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const w = arena(seed);
      const boss = king(w, 0.2);
      ready(w, boss);
      const p = w.player;
      const clean = () => DIRS.filter((d) => {
        const x = p.x + DX[d], y = p.y + DY[d];
        return !blocksMove(w.floor, x, y) && !enemyAt(w.floor, x, y) && surfaceKindAt(w.floor, x, y) !== 'oil' && surfaceKindAt(w.floor, x, y) !== 'fire';
      }).length;
      const before = clean();
      w.update(1 / 60);
      expect(surfaceKindAt(w.floor, p.x, p.y), `seed ${seed}`).toBe('oil');
      // It takes ways out only while it leaves you two; with two or fewer it takes none.
      expect(clean(), `seed ${seed}: ways out`).toBe(before <= 2 ? before : Math.max(2, before - 2));
      // He stooped to throw it: that beat is yours.
      expect(boss.ai).toBe('recover');
      tick(w, PITCH_FUSE + 0.05);
      expect(surfaceKindAt(w.floor, p.x, p.y)).toBe('fire');
    }
  });

  it('keeps his pitch to Hard', () => {
    const state = newGame(createRng(5));
    state.difficulty = 'normal';
    startRun(state, 5);
    const w = new World(state);
    w.floor.enemies = [];
    w.floor.surfaces = [];
    const t = w.frontTile(1);
    const boss = createEnemy(enemyDef(BOSS_ID), t.x, t.y, turnAround(w.player.facing), 'king', 6, 'normal');
    boss.calm = true;
    boss.hp = Math.round(boss.maxHp * 0.2);
    boss.alert = 6;
    w.floor.enemies.push(boss);
    tick(w, 3);
    expect(w.pitchFuses).toEqual([]);
    expect((w.floor.surfaces ?? []).some((s) => s.kind === 'oil' || s.kind === 'fire')).toBe(false);
  });

  it('brings a new answer to ask for in each stage, and Normal keeps the first', () => {
    const def = enemyDef(BOSS_ID);
    const ids = (hp: number, calm = false) => (enemyView(def, hp, 100, { calm }).moves ?? []).map((m) => m.id);
    expect(ids(100)).toEqual(expect.arrayContaining(['thrust', 'sweep']));
    expect(ids(50)).toEqual(expect.arrayContaining(['feint', 'flurry']));
    expect(ids(20)).toEqual(expect.arrayContaining(['slam']));
    expect(ids(20, true)).toEqual(ids(100));
  });

  it('raises a guard only once he is cornered', () => {
    const def = enemyDef(BOSS_ID);
    expect(enemyView(def, 100, 100).shield, 'no guard on the throne').toBeUndefined();
    expect(enemyView(def, 50, 100).shield, 'none in the dark either').toBeUndefined();
    expect(enemyView(def, 10, 100).shield, 'only at the end').toBeDefined();
  });

  it('keeps his name, his resistances and his hoard through every phase', () => {
    // The whole reason he stays one creature: the codex, the field notes and the
    // one guaranteed relic in the game are all keyed off this id.
    const def = enemyDef(BOSS_ID);
    for (const hp of [100, 50, 10]) {
      const v = enemyView(def, hp, 100);
      expect(v.id).toBe(def.id);
      expect(v.name).toBe(def.name);
      expect(v.behavior).toBe('boss');
      expect(v.resist).toBe(def.resist);
      expect(v.loot).toBe(def.loot);
      expect(v.hp).toBe(def.hp);
    }
  });

  it('still gives up a relic and opens the way home when he falls in his last phase', () => {
    const w = arena(5);
    const e = king(w, 0.1);
    tick(w, 0.1);
    expect(e.phase).toBe(3);
    e.hp = 1;
    e.guard = 'down';
    e.guardT = 99;
    w.player.stamina = w.derived.maxStamina;
    w.attack();
    tick(w, 1.5);
    expect(w.run.stats.bossKilled).toBe(true);
    expect(w.floor.props.some((p) => p.kind === 'portal')).toBe(true);
    const relic = w.floor.pickups.some((p) => p.items.some((i) => uniqueOf(i)));
    expect(relic, 'the King always gives up a relic').toBe(true);
  });

  it('every phase leaves a wind-up you can read', () => {
    for (const p of KING_PHASES) expect(p.windup, p.sprite).toBeGreaterThanOrEqual(0.24);
  });
});

describe('an older save', () => {
  it('resolves a King who was already mid-fight, with no migration', () => {
    const w = arena(7);
    const e = king(w, 0.5);
    delete e.phase; // written before phases existed
    expect(() => tick(w, 0.1)).not.toThrow();
    expect(e.phase).toBe(2);
    expect(kingPhase(e.phase!).sprite).toBe('king_dark');
  });
});

describe('the fog gate', () => {
  it('marks exactly one boss-only door on every depth-six floor', () => {
    for (let seed = 0; seed < 12; seed++) {
      const f = generateFloor(seed, 6);
      const gates = f.doors.filter((d) => isBossDoor(f, d));
      expect(gates, `seed ${seed}`).toHaveLength(1);
      expect(gates[0].boss).toBe(true);
      expect(gates[0].iron).toBe(true);
    }
    // Ordinary floors have no throne and no gate.
    for (let seed = 0; seed < 6; seed++) {
      const f = generateFloor(seed, 3);
      expect(f.doors.filter((d) => isBossDoor(f, d))).toHaveLength(0);
    }
  });

  it('blocks corridor attacks and aggro through an open entrance', () => {
    const { w, room, boss } = throne(77);
    const gate = w.floor.doors.find(d => d.boss)!;
    gate.open = true;
    const inside = DIRS.map(d => ({ x: gate.x + DX[d], y: gate.y + DY[d] }))
      .find(t => inRoom(room, t.x, t.y))!;
    Object.assign(w.player, { x: gate.x, y: gate.y });
    Object.assign(boss, { x: inside.x, y: inside.y, fromX: inside.x, fromY: inside.y, moveT: 1 });
    const hp = boss.hp;
    expect(w.los(gate.x, gate.y, boss.x, boss.y)).toBe(false);
    const combat = w as unknown as {
      hitEnemy(e: EnemyState): void;
      reflectedHit(pr: { damage: number; type: string }, e: EnemyState): void;
    };
    const dx = inside.x - gate.x, dy = inside.y - gate.y;
    w.projectiles.push({ id: 999, x: gate.x + 0.5, y: gate.y + 0.5,
      tileX: gate.x, tileY: gate.y, dx, dy, speed: 6, damage: 9999,
      type: 'fire', sprite: 'bolt_fire', source: 'your own parry', reflected: true });
    combat.hitEnemy(boss);
    combat.reflectedHit({ damage: 9999, type: 'fire' }, boss);
    tick(w, 2);
    expect(boss.hp).toBe(hp);
    expect(w.projectiles).toHaveLength(0);
    expect([boss.x, boss.y]).toEqual([inside.x, inside.y]);
    expect(gate.locked).toBe(false);
    Object.assign(w.player, inside);
    tick(w, 0.1);
    expect(gate.locked).toBe(true);
    expect(gate.open).toBe(false);
  });

  it('recognises pre-flag saves by position', () => {
    const f = generateFloor(77, 6);
    const gate = f.doors.find((d) => d.boss)!;
    expect(gate).toBeDefined();
    delete gate.boss; // written before the flag existed
    expect(isBossDoor(f, gate)).toBe(true);
    const other = f.doors.find((d) => d !== gate)!;
    if (other) expect(isBossDoor(f, other)).toBe(false);
  });

  it('seals when you enter and reopens when he falls', () => {
    const { w, boss } = throne(77);
    const gates = w.floor.doors.filter((d) => isBossDoor(w.floor, d));
    expect(gates.length).toBe(1);
    expect(gates[0].locked).toBe(false);
    // Already standing inside the throne room: one tick slams it.
    tick(w, 0.1);
    expect(gates[0].locked).toBe(true);
    expect(gates[0].open).toBe(false);
    // No cheese through the crack: a shut gate blocks sight, which is what
    // stops bolts (updateProjectiles) and pathing (blocksMove) both ways.
    expect(blocksSight(w.floor, gates[0].x, gates[0].y)).toBe(true);
    (w as unknown as { killEnemy(x: EnemyState): void }).killEnemy(boss);
    expect(gates[0].locked).toBe(false);
    expect(gates[0].open).toBe(true);
  });

  it('refuses the gate and the way home while sealed', () => {
    const { w, room } = throne(78);
    tick(w, 0.1);
    const gate = w.floor.doors.find((d) => isBossDoor(w.floor, d))!;
    expect(gate.locked).toBe(true);
    // Stand on the inside tile beside the gate, facing it.
    const inside = [0, 1, 2, 3].map((d) => ({ x: gate.x + DX[d as Dir], y: gate.y + DY[d as Dir] }))
      .find((t) => inRoom(room, t.x, t.y) && w.floor.tiles[t.y * w.floor.width + t.x] === FLOOR);
    expect(inside).toBeDefined();
    Object.assign(w.player, { x: inside!.x, y: inside!.y, facing: dirOf(gate.x - inside!.x, gate.y - inside!.y) ?? 0 });
    expect(w.interactionHint()).toBe('Sealed by fog');
    w.interact();
    expect(gate.locked).toBe(true);
    expect(gate.open).toBe(false);
    // A recall scroll will not spend itself against the fog.
    addItem(w.run.backpack, makeConsumable('scroll_recall', 1));
    const scroll = w.run.backpack.items.find((i) => i.ref === 'scroll_recall')!;
    w.use(scroll.uid);
    expect(w.anim.recall).toBeNull();
    expect(w.run.backpack.items.some((i) => i.ref === 'scroll_recall')).toBe(true);
    // Nor will a town portal already underfoot open the way out.
    w.floor.props.push({ id: 'sealed_town', kind: 'town_portal', x: w.player.x, y: w.player.y, used: false, tier: 'none', blocking: false, mimic: false });
    w.drainEvents();
    w.interact();
    expect(w.drainEvents().some((e) => e.type === 'town')).toBe(false);
    expect(w.run.outcome).toBe('active');
  });
});
