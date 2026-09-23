import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { Dir } from '../core/dir';
import { newGame } from '../state/game-state';
import { startRun } from '../systems/run';
import { WALL, tileAt } from '../systems/dungeon';
import { World } from '../world/world';
import { MAX_URL, ReportSource, decodeRepro, detailsMarkdown, encodeRepro, issueUrl, reproOf } from '../systems/bug-report';
import { reproRoom } from '../dev/repro-room';

const DEVICE = { version: '1.0.0', build: 'test', userAgent: 'vitest', viewport: '800×600 @1x', touch: false, brightness: 100 };

/** A delve that took the Mine Road and is standing somewhere on depth 4. */
function reporter(): World {
  const state = newGame(createRng(11));
  const run = startRun(state, 424242);
  run.road = 'mines';
  const w = new World(state);
  while (w.run.depth < 4) w.changeFloorForTest('down');
  const f = w.floor;
  // Somewhere that is not the stair landing, so the placement is really tested.
  const i = f.tiles.findIndex((t, k) => t !== WALL && k > f.tiles.length / 2);
  w.placePlayer(i % f.width, Math.floor(i / f.width), Dir.W);
  return w;
}

describe('bug report', () => {
  it('round-trips a repro code, and rejects junk', () => {
    const r = { seed: 3_000_000_001, depth: 5, x: 12, y: 40, facing: Dir.S, print: 'k3x9a', difficulty: 'normal' as const, road: 'frozen', seals: ['teeth', 'lightless'] };
    expect(decodeRepro(encodeRepro(r))).toEqual(r);
    expect(decodeRepro(encodeRepro({ seed: 7, depth: 1, x: 3, y: 4, facing: Dir.N }))).toEqual({ seed: 7, depth: 1, x: 3, y: 4, facing: Dir.N });
    for (const bad of ['', 'abc', '1.2.3.4', '1.2.3.4.9', '1.0.3.4.1', '1.2.3.4.1.ab.impossible', '1.2.3.4.1.NOPE']) expect(decodeRepro(bad)).toBeNull();
  });

  it('rebuilds the same floor and tile from the code in the issue', () => {
    const w = reporter();
    const src: ReportSource = { mode: 'dungeon', state: w.state, world: w, device: DEVICE };
    const code = /\?repro=([^`\s]+)/.exec(detailsMarkdown(src))![1];
    expect(code).toBe(encodeRepro(reproOf(w)));

    const room = reproRoom(decodeRepro(code)!);
    const scratch = newGame(createRng(99));
    room.prepare(scratch);
    const copy = new World(scratch);
    expect(room.drop(copy)).not.toContain('did not reproduce');

    expect(copy.run.depth).toBe(4);
    expect(copy.floor.biome).toBe(w.floor.biome);
    expect(copy.floor.quirk).toBe(w.floor.quirk);
    expect(copy.floor.tiles).toEqual(w.floor.tiles);
    expect(copy.floor.doors.map((d) => [d.x, d.y])).toEqual(w.floor.doors.map((d) => [d.x, d.y]));
    expect([copy.player.x, copy.player.y, copy.player.facing]).toEqual([w.player.x, w.player.y, w.player.facing]);
    expect(tileAt(copy.floor, copy.player.x, copy.player.y)).not.toBe(WALL);
  });

  it('says so when the reported floor came from another build', () => {
    const w = reporter();
    const r = { ...reproOf(w), print: 'someotherfloor' };
    const room = reproRoom(r);
    const scratch = newGame(createRng(5));
    room.prepare(scratch);
    expect(room.drop(new World(scratch))).toContain('older build');
  });

  it('says where you are and what is in front of you', () => {
    const w = reporter();
    const md = detailsMarkdown({ mode: 'dungeon', state: w.state, world: w, device: DEVICE });
    expect(md).toContain('| Where | Depth 4: ');
    expect(md).toContain(`(${w.player.x}, ${w.player.y}) facing West`);
    expect(md).toMatch(/\| Ahead \| .+ \(\d+, \d+\) \|/);
    expect(md).toContain('| Road | ');
    // Town reports carry no repro: there is no floor to stand on.
    const town = detailsMarkdown({ mode: 'town', state: newGame(createRng(1)), world: null, townTab: 'market', device: DEVICE });
    expect(town).toContain('Bleakmere, market tab');
    expect(town).not.toContain('repro');
  });

  it('keeps the link under GitHub\'s limit and never drops the details', () => {
    const w = reporter();
    const details = detailsMarkdown({ mode: 'dungeon', state: w.state, world: w, device: DEVICE });
    const url = issueUrl('Walls', 'è'.repeat(6000), details);
    expect(url.length).toBeLessThanOrEqual(MAX_URL);
    const q = new URL(url).searchParams;
    expect(q.get('template')).toBe('in-game-report.yml');
    expect(q.get('details')).toBe(details);
    expect(q.get('what')).toContain('trimmed to fit');
  });
});
