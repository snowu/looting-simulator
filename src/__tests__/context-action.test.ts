import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, turnAround, turnRight } from '../core/dir';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { FLOOR, createEnemy } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { makeMaterial } from '../systems/items';

/** The one-button touch control: what a tap on the view would do right now. */
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
  for (let y = 3; y < f.height - 6; y++) for (let x = 3; x < f.width - 6; x++) {
    for (const d of DIRS) {
      let ok = free(x, y) && free(x + DX[turnRight(d)], y + DY[turnRight(d)]);
      for (let k = 1; k <= 4 && ok; k++) ok = free(x + DX[d] * k, y + DY[d] * k);
      if (ok) {
        Object.assign(w.player, { x, y, facing: d });
        Object.assign(w.anim, { fromX: x, fromY: y, yaw: (d * Math.PI) / 2, yawTo: (d * Math.PI) / 2 });
        return w;
      }
    }
  }
  throw new Error('no arena');
}

function dropUnderfoot(w: World): void {
  w.floor.pickups.push({ id: 'drop', x: w.player.x, y: w.player.y, items: [makeMaterial('iron', 2)], gold: 0 });
}

/** A living enemy beside you — off to the side, so it is not in the swing arc. */
function flanker(w: World): void {
  const side = turnRight(w.player.facing);
  const x = w.player.x + DX[side], y = w.player.y + DY[side];
  const e = createEnemy(enemyDef('skeleton'), x, y, turnAround(side), 'flank', 1);
  e.ai = 'chase';
  e.alert = 6;
  w.floor.enemies.push(e);
}

describe('the one-button action', () => {
  it('loots a pile underfoot when nothing is left to fight', () => {
    const w = arena(21);
    dropUnderfoot(w);
    expect(w.contextAction()).toEqual({ kind: 'interact', label: 'Loot' });
  });

  it('swings instead when something is still alive beside you', () => {
    const w = arena(21);
    dropUnderfoot(w);
    flanker(w);
    expect(w.contextAction().kind).toBe('attack');
  });

  it('goes back to looting once the fight is over', () => {
    const w = arena(21);
    dropUnderfoot(w);
    flanker(w);
    w.floor.enemies.forEach((e) => (e.ai = 'dead'));
    expect(w.contextAction()).toEqual({ kind: 'interact', label: 'Loot' });
  });

  it('ignores something distant and unaware', () => {
    const w = arena(22);
    dropUnderfoot(w);
    const t = w.frontTile(4);
    const e = createEnemy(enemyDef('rat'), t.x, t.y, turnAround(w.player.facing), 'far', 1);
    e.ai = 'idle';
    e.alert = 0;
    w.floor.enemies.push(e);
    expect(w.contextAction().kind).toBe('interact');
  });

  it('still lets you run: a door beats the fight', () => {
    const w = arena(23);
    flanker(w);
    const t = w.frontTile(1);
    w.floor.doors.push({ x: t.x, y: t.y, ns: true, open: false, locked: false, iron: false });
    expect(w.contextAction()).toEqual({ kind: 'interact', label: 'Open' });
  });

  it('still attacks an enemy straight ahead over anything else', () => {
    const w = arena(24);
    dropUnderfoot(w);
    const t = w.frontTile(1);
    w.floor.enemies.push(createEnemy(enemyDef('rat'), t.x, t.y, turnAround(w.player.facing), 'front', 1));
    expect(w.contextAction().kind).toBe('attack');
  });

  it('leaves the [F] key alone — looting is still deliberate', () => {
    const w = arena(21);
    dropUnderfoot(w);
    flanker(w);
    expect(w.interactionHint()).toBe('Search');
  });
});
