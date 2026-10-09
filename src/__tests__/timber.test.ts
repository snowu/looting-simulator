import { describe, expect, it } from 'vitest';
import { getArt } from '../art/registry';
import { BIOMES } from '../data/biomes';
import { timberSetAt } from '../render/timber';

/** '#' is rock, anything else is open. */
function map(rows: string[]) {
  return (x: number, y: number) => rows[y]?.[x] !== undefined && rows[y][x] !== '#';
}

describe('mine timber sets', () => {
  // A north-south tunnel (x = 2) opening into a room at the bottom, and a
  // west-east tunnel (y = 10) off the room.
  const open = map([
    '#####',
    '##.##',
    '##.##',
    '##.##',
    '##.##',
    '##.##',
    '##.##',
    '##.##',
    '##.##',
    '#...#',
    '#.......',
    '#...####',
  ]);

  it('stands only every fourth tile of a one-wide straight tunnel', () => {
    const sets = [];
    for (let y = 0; y < 12; y++) for (let x = 0; x < 8; x++) {
      const s = timberSetAt(open, x, y, 4);
      if (s) sets.push([x, y, s]);
    }
    // Down the north-south tunnel at y = 4 and 8; across the west-east one at x = 4.
    expect(sets).toEqual([[2, 4, 'x'], [2, 8, 'x'], [4, 10, 'z']]);
  });

  it('never stands in a room or at a junction', () => {
    expect(timberSetAt(open, 2, 9, 1)).toBeNull();
    expect(timberSetAt(open, 2, 10, 1)).toBeNull();
    expect(timberSetAt(open, 0, 0, 1)).toBeNull();
  });

  it('is only in the mines, and all its art exists', () => {
    const withSets = BIOMES.filter((b) => b.timberSets);
    expect(withSets.map((b) => b.id)).toEqual(['mines']);
    const t = withSets[0].timberSets!;
    for (const id of [t.capX, t.capZ, t.post]) expect(getArt(id), id).toBeDefined();
  });
});
