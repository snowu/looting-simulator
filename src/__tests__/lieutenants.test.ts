import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { newGame } from '../state/game-state';
import { EnemyState, FLOOR, Floor, createEnemy } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { LIEUTENANT_MIN_DISTANCE, QUARTERMASTER_MIN_GOBLINS, RALLY_DAMAGE, isGoblin } from '../data/lieutenants';
import { makeMaterial } from '../systems/items';
import { startRun } from '../systems/run';
import { World } from '../world/world';

interface Private {
  changeFloor(dir: 'down' | 'up'): void;
  killEnemy(e: EnemyState): void;
  rally(e: EnemyState): number;
  placeLieutenant(f: Floor): void;
}
const priv = (w: World) => w as unknown as Private;

function world(seed: number): World {
  const state = newGame(createRng(seed));
  startRun(state, seed);
  return new World(state);
}

function run(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

describe('placement', () => {
  it('only from depth 2, at most one per floor, far from the stair, and a Quartermaster only with goblins', () => {
    let quartermasters = 0, hoarders = 0;
    for (let seed = 700; seed < 760; seed++) {
      const w = world(seed);
      expect(w.floor.enemies.some((e) => e.lieutenant)).toBe(false);
      for (let d = 2; d <= 5; d++) {
        priv(w).changeFloor('down');
        const lts = w.floor.enemies.filter((e) => e.lieutenant);
        expect(lts.length).toBeLessThanOrEqual(1);
        for (const lt of lts) {
          const up = w.floor.stairs.find((s) => !s.down)!;
          expect(Math.abs(lt.x - up.x) + Math.abs(lt.y - up.y)).toBeGreaterThanOrEqual(LIEUTENANT_MIN_DISTANCE);
          if (lt.lieutenant === 'quartermaster') {
            quartermasters++;
            expect(w.floor.enemies.filter((e) => isGoblin(e.def)).length).toBeGreaterThanOrEqual(QUARTERMASTER_MIN_GOBLINS);
          } else hoarders++;
        }
      }
    }
    expect(quartermasters).toBeGreaterThan(3);
    expect(hoarders).toBeGreaterThan(20);
  }, 60_000);
});

describe('the Goblin Quartermaster', () => {
  it('rallies goblins while it stands, and routs them when it falls', () => {
    const w = world(770);
    const p = w.player;
    w.floor.enemies = [];
    const qm = createEnemy(enemyDef('goblin_quartermaster'), p.x + 3, p.y, 0, 'qm', 2);
    qm.lieutenant = 'quartermaster';
    const gob = createEnemy(enemyDef('goblin_shield'), p.x + 2, p.y, 0, 'g1', 2);
    const rat = createEnemy(enemyDef('rat'), p.x + 2, p.y + 1, 0, 'r1', 2);
    w.floor.enemies.push(qm, gob, rat);
    expect(priv(w).rally(gob)).toBe(RALLY_DAMAGE);
    expect(priv(w).rally(rat)).toBe(1);
    expect(priv(w).rally(qm)).toBe(1);
    const pilesBefore = w.floor.pickups.length;
    priv(w).killEnemy(qm);
    expect(priv(w).rally(gob)).toBe(1);
    expect(gob.ai).toBe('flee');
    expect(w.floor.pickups.length).toBeGreaterThan(pilesBefore);
  });
});

describe('the Hoarder', () => {
  function hoarderScene(seed: number) {
    const w = world(seed);
    const f = w.floor;
    f.enemies = [];
    f.pickups = [];
    // Park the player far away so the Hoarder is not shy.
    const e = createEnemy(enemyDef('hoarder'), 0, 0, 0, 'h', 2);
    e.lieutenant = 'hoarder';
    let placed = false;
    for (let y = 1; y < f.height - 1 && !placed; y++) for (let x = 1; x < f.width - 1 && !placed; x++) {
      if (f.tiles[y * f.width + x] !== FLOOR || f.tiles[y * f.width + x + 1] !== FLOOR || f.tiles[y * f.width + x + 2] !== FLOOR) continue;
      if (Math.abs(x - w.player.x) + Math.abs(y - w.player.y) < 12) continue;
      e.x = e.fromX = e.homeX = x; e.y = e.fromY = e.homeY = y;
      placed = true;
    }
    f.enemies.push(e);
    return { w, e };
  }

  it('goes to a loot pile, carries it off, and gives it all back when killed', () => {
    const { w, e } = hoarderScene(771);
    const pile = { id: 'loot', x: e.x + 2, y: e.y, items: [makeMaterial('iron', 5)], gold: 12 };
    w.floor.pickups.push(pile);
    run(w, 4);
    expect(w.floor.pickups.includes(pile)).toBe(false);
    expect(e.hoard?.some((i) => i.ref === 'iron')).toBe(true);
    expect(e.hoardGold).toBe(12);
    priv(w).killEnemy(e);
    const drop = w.floor.pickups.find((k) => k.x === e.x && k.y === e.y)!;
    expect(drop.items.some((i) => i.ref === 'iron' && i.qty === 5)).toBe(true);
    expect(drop.gold).toBeGreaterThanOrEqual(12);
  });

  it('never takes a key', () => {
    const { w, e } = hoarderScene(772);
    const key = { id: 'k', x: e.x + 1, y: e.y, items: [], gold: 0, keyId: 'key_2_0' };
    w.floor.pickups.push(key);
    run(w, 3);
    expect(w.floor.pickups.includes(key)).toBe(true);
  });

  it('keeps away from you', () => {
    const { w, e } = hoarderScene(773);
    Object.assign(w.player, { x: e.x - 2, y: e.y });
    e.alert = 6;
    const before = Math.abs(e.x - w.player.x) + Math.abs(e.y - w.player.y);
    run(w, 1);
    expect(Math.abs(e.x - w.player.x) + Math.abs(e.y - w.player.y)).toBeGreaterThanOrEqual(before);
  });
});
