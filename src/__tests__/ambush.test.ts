import { describe, expect, it } from 'vitest';
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { createRng } from '../core/rng';
import { newGame } from '../state/game-state';
import { FLOOR, EnemyState, createEnemy, enemyAt, generateFloor, lurkerAt } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { AMBUSH_BEAT, BURROW_MAX, DROP_SECONDS, EARTH_BIOMES, KNOCKOUT_STUN, SURFACE_SECONDS, droppersFor } from '../data/ambush';
import { startRun } from '../systems/run';
import { World } from '../world/world';

interface Private {
  resolvePlayerAttack(): void;
  threatNear(): boolean;
  spotTraps(): void;
}
const priv = (w: World) => w as unknown as Private;

/** A cleared floor-1 world with the player in a straight run of open floor, facing along it. */
function arena(seed = 131): World {
  const state = newGame(createRng(seed));
  startRun(state, seed);
  const w = new World(state);
  const f = w.floor;
  f.enemies = [];
  f.traps = [];
  f.props = f.props.filter((p) => !p.blocking);
  const free = (x: number, y: number) =>
    f.tiles[y * f.width + x] === FLOOR && !f.doors.some((d) => d.x === x && d.y === y) && !f.stairs.some((s) => s.x === x && s.y === y);
  for (let y = 3; y < f.height - 3; y++) for (let x = 3; x < f.width - 3; x++) for (const d of DIRS) {
    const line = [-1, 0, 1, 2, 3].map((k) => [x + DX[d] * k, y + DY[d] * k]);
    if (!line.every(([a, b]) => free(a, b))) continue;
    Object.assign(w.player, { x, y, facing: d });
    Object.assign(w.anim, { fromX: x, fromY: y, yaw: d * Math.PI / 2, yawTo: d * Math.PI / 2 });
    return w;
  }
  throw new Error('no arena');
}

function run(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

/** A lurker `k` tiles ahead of the player. */
function lurker(w: World, id: string, lurk: 'ceiling' | 'buried', k: number): EnemyState {
  const t = w.frontTile(k);
  const e = createEnemy(enemyDef(id), t.x, t.y, 0, `lurk_${id}`, 2);
  e.lurk = lurk;
  w.floor.enemies.push(e);
  return e;
}

describe('placement', () => {
  it('hangs droppers over corridors from depth 2 to 5, far from the arrival, never on the throne', () => {
    let placed = 0;
    for (let seed = 0; seed < 40; seed++) {
      for (let depth = 1; depth <= 6; depth++) {
        const f = generateFloor(seed, depth, 'hard');
        const droppers = f.enemies.filter((e) => e.lurk === 'ceiling');
        expect(droppers.length).toBe(depth === 6 ? 0 : droppersFor(depth));
        const up = f.stairs.find((s) => !s.down)!;
        for (const e of droppers) {
          expect(e.def).toBe('ceiling_crawler');
          expect(f.rooms.some((r) => e.x >= r.x && e.x < r.x + r.w && e.y >= r.y && e.y < r.y + r.h)).toBe(false);
          expect(Math.abs(e.x - up.x) + Math.abs(e.y - up.y)).toBeGreaterThanOrEqual(5);
          placed++;
        }
        for (const e of f.enemies.filter((x) => x.lurk === 'buried')) {
          expect(e.def).toBe('tunnel_stalker');
          expect(EARTH_BIOMES.has(f.biome)).toBe(true);
        }
      }
    }
    expect(placed).toBeGreaterThan(100);
  }, 60_000);

  it('is the same floor every time', () => {
    const a = generateFloor(9, 4, 'hard').enemies.filter((e) => e.lurk).map((e) => [e.id, e.x, e.y]);
    const b = generateFloor(9, 4, 'hard').enemies.filter((e) => e.lurk).map((e) => [e.id, e.x, e.y]);
    expect(a).toEqual(b);
  });
});

describe('a lurker is not on its tile', () => {
  it('is invisible to enemyAt, the threat check and the map, and you can walk under it', () => {
    const w = arena();
    const e = lurker(w, 'ceiling_crawler', 'ceiling', 2);
    expect(enemyAt(w.floor, e.x, e.y)).toBeUndefined();
    expect(lurkerAt(w.floor, e.x, e.y)).toBe(e);
    expect(priv(w).threatNear()).toBe(false);
    expect(w.visibleEnemies().has(e.id)).toBe(false);
  });

  it('is spotted by looking at the ceiling ahead', () => {
    const w = arena(132);
    const e = lurker(w, 'ceiling_crawler', 'ceiling', 2);
    expect(e.spotted).toBeFalsy();
    priv(w).spotTraps();
    expect(e.spotted).toBe(true);
  });
});

describe('the drop', () => {
  it('waits until you come close, sifts dust, lands, and does not strike on arrival', () => {
    const w = arena(133);
    const e = lurker(w, 'ceiling_crawler', 'ceiling', 2);
    run(w, 1);
    expect(e.lurk).toBe('ceiling');
    expect(e.lurkT).toBeUndefined();
    // Step forward: now it is one tile ahead.
    w.player.x += DX[w.player.facing];
    w.player.y += DY[w.player.facing];
    const hp = w.player.hp;
    run(w, 0.1);
    expect(e.lurkT).toBeDefined();
    run(w, DROP_SECONDS);
    expect(e.lurk).toBeUndefined();
    expect(e.ai).toBe('recover');
    expect(enemyAt(w.floor, e.x, e.y)).toBe(e);
    // The beat after landing is free of blows.
    run(w, AMBUSH_BEAT * 0.9);
    expect(w.player.hp).toBe(hp);
  });

  it('dropping onto you puts it beside you instead', () => {
    const w = arena(134);
    const e = lurker(w, 'ceiling_crawler', 'ceiling', 0);
    run(w, DROP_SECONDS + 0.2);
    expect(e.lurk).toBeUndefined();
    expect(Math.abs(e.x - w.player.x) + Math.abs(e.y - w.player.y)).toBe(1);
  });

  it('a spotted dropper struck from below falls reeling and open', () => {
    const w = arena(135);
    const e = lurker(w, 'ceiling_crawler', 'ceiling', 1);
    e.spotted = true;
    priv(w).resolvePlayerAttack();
    expect(e.lurk).toBeUndefined();
    expect(e.ai).toBe('recover');
    expect(e.vuln).toBe(KNOCKOUT_STUN);
  });

  it('an unspotted one cannot be struck: the swing goes into the air', () => {
    const w = arena(136);
    const e = lurker(w, 'ceiling_crawler', 'ceiling', 1);
    priv(w).resolvePlayerAttack();
    // Still up there (it may have been set off by standing next to it, but not knocked out).
    expect(e.vuln ?? 0).toBe(0);
  });
});

describe('burrowers', () => {
  it('a buried stalker rises beside you when you come close, without striking', () => {
    const w = arena(137);
    const e = lurker(w, 'tunnel_stalker', 'buried', 1);
    const hp = w.player.hp;
    run(w, SURFACE_SECONDS + 0.1);
    expect(e.lurk).toBeUndefined();
    expect(e.ai).toBe('recover');
    expect(w.player.hp).toBe(hp);
  });

  it('a mound can be struck to drag it out early', () => {
    const w = arena(138);
    const e = lurker(w, 'tunnel_stalker', 'buried', 1);
    priv(w).resolvePlayerAttack();
    expect(e.lurk).toBeUndefined();
    expect(e.vuln).toBe(KNOCKOUT_STUN);
  });

  it('a badly hurt mole dives once and surfaces beside you, behind if it can', () => {
    const w = arena(139);
    const t = w.frontTile(2);
    const mole = createEnemy(enemyDef('mole'), t.x, t.y, turnAround(w.player.facing), 'mole', 1);
    mole.hp = Math.floor(mole.maxHp * 0.3);
    mole.ai = 'chase';
    mole.alert = 6;
    w.floor.enemies.push(mole);
    run(w, 0.1);
    expect(mole.lurk).toBe('buried');
    expect(mole.tunnelling).toBe(true);
    expect(mole.dived).toBe(true);
    run(w, BURROW_MAX + 0.5);
    expect(mole.lurk).toBeUndefined();
    expect(Math.abs(mole.x - w.player.x) + Math.abs(mole.y - w.player.y)).toBe(1);
    const back = { x: w.player.x - DX[w.player.facing], y: w.player.y - DY[w.player.facing] };
    expect([mole.x, mole.y]).toEqual([back.x, back.y]);
    // It does not dive a second time.
    run(w, 2);
    expect(mole.lurk).toBeUndefined();
  });
});
