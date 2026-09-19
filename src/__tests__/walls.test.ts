import { describe, expect, it } from 'vitest';
import { DIRS, DX, DY, dirOf } from '../core/dir';
import { createRng } from '../core/rng';
import { newGame } from '../state/game-state';
import { FLOOR, WALL, Floor, blocksMove, crackAt, createEnemy, generateFloor } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { CRACK_BLOWS, CRACK_NOISE, Crack, SHORTCUT_MIN_SAVING } from '../data/walls';
import { CRACKABLE_WALLS, crackTexture } from '../art/textures';
import { getArt } from '../art/registry';
import { durability } from '../systems/items';
import { startRun } from '../systems/run';
import { World } from '../world/world';

interface Private { resolvePlayerAttack(): void }
const swing = (w: World) => (w as unknown as Private).resolvePlayerAttack();

/** Steps between two floor tiles, walking floor only. */
function walk(f: Floor, ax: number, ay: number, bx: number, by: number): number {
  const dist = new Map<number, number>([[ay * f.width + ax, 0]]);
  const q = [[ax, ay]];
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h];
    const d0 = dist.get(y * f.width + x)!;
    if (x === bx && y === by) return d0;
    for (const d of DIRS) {
      const nx = x + DX[d], ny = y + DY[d], k = ny * f.width + nx;
      if (f.tiles[k] !== FLOOR || dist.has(k)) continue;
      dist.set(k, d0 + 1);
      q.push([nx, ny]);
    }
  }
  return Infinity;
}

/** A world standing in front of the first crack of `kind` on some early floor. */
function facingCrack(kind: Crack['kind']): { w: World; c: Crack } {
  for (let seed = 1; seed < 60; seed++) {
    const state = newGame(createRng(seed));
    startRun(state, seed);
    const w = new World(state);
    const f = w.floor;
    for (const c of f.cracks ?? []) {
      if (c.kind !== kind) continue;
      for (const d of DIRS) {
        const px = c.x - DX[d], py = c.y - DY[d];
        if (blocksMove(f, px, py)) continue;
        f.enemies = [];
        const facing = dirOf(DX[d], DY[d])!;
        Object.assign(w.player, { x: px, y: py, facing });
        Object.assign(w.anim, { fromX: px, fromY: py, yaw: facing * Math.PI / 2, yawTo: facing * Math.PI / 2 });
        return { w, c };
      }
    }
  }
  throw new Error(`no ${kind} crack found`);
}

describe('placement', () => {
  it('places cracks on walls, clear of the border, never on the throne floor', () => {
    let shortcuts = 0, seams = 0, caches = 0;
    for (let seed = 0; seed < 30; seed++) {
      for (let depth = 1; depth <= 6; depth++) {
        const f = generateFloor(seed, depth, 'hard');
        if (depth === 6) expect(f.cracks).toEqual([]);
        for (const c of f.cracks ?? []) {
          expect(f.tiles[c.y * f.width + c.x]).toBe(WALL);
          expect(c.x).toBeGreaterThan(1);
          expect(c.y).toBeGreaterThan(1);
          expect(c.hits).toBe(0);
          const open = DIRS.filter((d) => f.tiles[(c.y + DY[d]) * f.width + c.x + DX[d]] === FLOOR);
          if (c.kind === 'shortcut') {
            shortcuts++;
            expect(open.length).toBe(2);
            const [a, b] = open;
            // Long way round saves at least the minimum.
            expect(walk(f, c.x + DX[a], c.y + DY[a], c.x + DX[b], c.y + DY[b])).toBeGreaterThanOrEqual(SHORTCUT_MIN_SAVING);
          } else {
            expect(open.length).toBe(1);
            if (c.kind === 'seam') seams++; else caches++;
          }
          expect(f.stairs.some((s) => Math.abs(s.x - c.x) + Math.abs(s.y - c.y) <= 1)).toBe(false);
          expect(f.doors.some((d) => Math.abs(d.x - c.x) + Math.abs(d.y - c.y) <= 1)).toBe(false);
        }
      }
    }
    expect(shortcuts).toBeGreaterThan(50);
    expect(seams).toBeGreaterThan(50);
    expect(caches).toBeGreaterThan(50);
  }, 60_000);

  it('has a texture for every wall and kind', () => {
    for (const wall of CRACKABLE_WALLS) for (const kind of ['shortcut', 'seam', 'cache'] as const) {
      expect(getArt(crackTexture(wall, kind)), `${wall} ${kind}`).toBeDefined();
    }
  });
});

describe('breaking', () => {
  it(`takes ${CRACK_BLOWS} blows, wears the weapon each time, and leaves floor`, () => {
    const { w, c } = facingCrack('shortcut');
    const weapon = w.state.equipment.weapon;
    const before = weapon ? durability(weapon).cur : 0;
    for (let i = 1; i < CRACK_BLOWS; i++) {
      swing(w);
      expect(c.hits).toBe(i);
      expect(crackAt(w.floor, c.x, c.y)).toBe(c);
      expect(blocksMove(w.floor, c.x, c.y)).toBe(true);
    }
    swing(w);
    expect(c.broken).toBe(true);
    expect(w.floor.tiles[c.y * w.floor.width + c.x]).toBe(FLOOR);
    expect(blocksMove(w.floor, c.x, c.y)).toBe(false);
    if (weapon) expect(durability(weapon).cur).toBeLessThan(before);
  });

  it('is loud: monsters within range come to look, through walls', () => {
    const { w, c } = facingCrack('shortcut');
    const f = w.floor;
    const spot = (r: number) => {
      for (let y = 1; y < f.height - 1; y++) for (let x = 1; x < f.width - 1; x++) {
        const d = Math.abs(x - c.x) + Math.abs(y - c.y);
        if (d === r && f.tiles[y * f.width + x] === FLOOR && !(x === w.player.x && y === w.player.y)) return { x, y };
      }
      return null;
    };
    const nearTile = spot(CRACK_NOISE - 1)!, farTile = spot(CRACK_NOISE + 4)!;
    const near = createEnemy(enemyDef('skeleton'), nearTile.x, nearTile.y, 0, 'near', 1);
    const far = createEnemy(enemyDef('skeleton'), farTile.x, farTile.y, 0, 'far', 1);
    f.enemies.push(near, far);
    swing(w);
    expect(near.alert).toBeGreaterThan(0);
    expect(far.alert).toBe(0);
  });

  it('a seam spills ore and a cache spills a hoard', () => {
    for (const kind of ['seam', 'cache'] as const) {
      const { w, c } = facingCrack(kind);
      for (let i = 0; i < CRACK_BLOWS; i++) swing(w);
      const pile = w.floor.pickups.find((p) => p.x === c.x && p.y === c.y);
      expect(pile, kind).toBeDefined();
      if (kind === 'seam') expect(pile!.items.some((i) => i.kind === 'material')).toBe(true);
      else expect(pile!.items.length + pile!.gold).toBeGreaterThan(0);
    }
  });

  it('the one-button tap swings at a cracked wall', () => {
    const { w } = facingCrack('seam');
    expect(w.contextAction().kind).toBe('attack');
  });
});
