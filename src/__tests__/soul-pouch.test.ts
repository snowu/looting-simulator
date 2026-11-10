import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { newGame } from '../state/game-state';
import { addItem } from '../state/inventory';
import { endRun, soulPouchKeeps, startRun } from '../systems/run';
import { itemValue, makeMaterial } from '../systems/items';

/** A Hard save mid-delve with a Soul Pouch and a backpack picked up cheapest-first. */
function dying(pouch: number) {
  const state = newGame(createRng(4));
  state.difficulty = 'hard';
  state.meta = { ...state.meta, soul_pouch: pouch };
  startRun(state, 4);
  const pack = state.run!.backpack;
  pack.items = [];
  // What you pick up first is what was lying near the top.
  for (const [id, qty] of [['bone', 1], ['rat_hide', 1], ['timber', 1], ['copper', 1], ['star_iron', 1], ['moonsilver', 2]] as const) {
    addItem(pack, makeMaterial(id, qty));
  }
  state.run!.stats.deepest = 4;
  return state;
}

describe('Soul Pouch (#132)', () => {
  it('saves the most valuable slots, not the first ones you filled', () => {
    const state = dying(1);
    const pack = [...state.run!.backpack.items];
    const ranked = [...pack].sort((x, y) => itemValue(y) * y.qty - itemValue(x) * x.qty);
    endRun(state, 'dead');
    // What it did not save waits with your Shade: exactly the three cheapest.
    const lost = state.grave!.items.map((it) => it.ref).sort();
    expect(lost).toEqual(ranked.slice(3).map((it) => it.ref).sort());
    expect(lost).not.toContain('moonsilver');
    expect(lost).toContain('bone');
  });

  it('keeps pickup order between stacks worth the same, and saves nothing without a pouch', () => {
    const a = makeMaterial('bone', 1), b = makeMaterial('bone', 1), c = makeMaterial('bone', 1);
    expect(soulPouchKeeps([a, b, c], 2)).toEqual([a, b]);
    const state = dying(0);
    endRun(state, 'dead');
    expect(state.stash.items.some((it) => it.ref === 'moonsilver')).toBe(false);
  });
});
