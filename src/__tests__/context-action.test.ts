import { describe, it, expect } from 'vitest';
import { DX, DY, turnAround, turnRight } from '../core/dir';
import { World } from '../world/world';
import { createEnemy } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { makeMaterial } from '../systems/items';
import { room } from './harness';

const arena = (seed = 1): World => room({ seed });

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
