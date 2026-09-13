import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { EnemyState, FLOOR, Room, createEnemy, generateFloor } from '../systems/dungeon';
import { BOSS_ID, KING_PHASES, enemyDef, enemyView, kingPhase, phaseForHp } from '../data/enemies';
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

  it('stands up the guard you put down, and only that guard', () => {
    const { w, room, boss } = throne(13);
    const guards = w.floor.enemies.filter((e) => e.def === 'hollow_knight' && inRoom(room, e.x, e.y));
    expect(guards.length).toBe(2);
    const [dead, alive] = guards;
    dead.ai = 'dead';
    dead.hp = 0;
    dead.deadT = 2;

    boss.hp = Math.round(boss.maxHp * 0.5);
    tick(w, 0.1);

    expect(dead.ai, 'the one you killed is back').not.toBe('dead');
    expect(dead.risen).toBe(true);
    expect(dead.hp).toBe(Math.max(1, Math.round(dead.maxHp * 0.3)));
    expect(dead.deadT).toBe(0);
    expect(alive.risen, 'the one still standing is untouched').toBeUndefined();
  });

  it('leaves corpses outside the throne room where they fell', () => {
    const { w, room, boss } = throne(17);
    const far = w.floor.enemies.find((e) => e.def === 'hollow_knight' && !inRoom(room, e.x, e.y));
    if (!far) return; // not every seed puts one elsewhere
    far.ai = 'dead';
    far.hp = 0;
    boss.hp = Math.round(boss.maxHp * 0.5);
    tick(w, 0.1);
    expect(far.ai).toBe('dead');
  });

  it('pays nothing for killing the same guard twice', () => {
    const { w, room, boss } = throne(19);
    const g = w.floor.enemies.find((e) => e.def === 'hollow_knight' && inRoom(room, e.x, e.y))!;
    g.ai = 'dead';
    g.hp = 0;
    boss.hp = Math.round(boss.maxHp * 0.5);
    tick(w, 0.1);
    expect(g.risen).toBe(true);

    const kills = w.run.stats.kills;
    const piles = w.floor.pickups.length;
    const tally = w.state.bestiary['hollow_knight']?.kills ?? 0;
    g.hp = 1;
    (w as unknown as { killEnemy(e: EnemyState): void }).killEnemy(g);
    expect(w.run.stats.kills, 'it already counted the first time').toBe(kills);
    expect(w.floor.pickups.length, 'and it already gave up its hoard').toBe(piles);
    expect(w.state.bestiary['hollow_knight']?.kills ?? 0).toBe(tally);
  });
});

describe('the last stand', () => {
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
