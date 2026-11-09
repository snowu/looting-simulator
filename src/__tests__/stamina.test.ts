import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { World } from '../world/world';
import { makeEquipment } from '../systems/items';
import { derivePlayer, emptyEquipment } from '../systems/player';
import { playerHitsEnemy } from '../systems/combat';
import { enemyDef } from '../data/enemies';
import { DEFAULT_CRIT_MULT, Rarity } from '../types';
import { room, tick } from './harness';


const arena = (seed = 1): World => room({ seed });

/** Swing until the swing is refused or the cap is hit; returns swings landed. */
function swingUntilSpent(w: World, cap = 60): number {
  let swings = 0;
  for (let i = 0; i < cap; i++) {
    const before = w.anim.attack;
    w.attack();
    if (w.anim.attack === before) break;
    swings++;
    tick(w, w.derived.swing.windup + w.derived.swing.recovery + 1 / 30);
  }
  return swings;
}

describe('stamina', () => {
  it('refuses to swing on an empty bar', () => {
    const w = arena();
    w.player.stamina = 0;
    w.attack();
    expect(w.anim.attack).toBe('idle');
  });

  it('refuses a swing it cannot pay for in full', () => {
    const w = arena();
    // A sliver used to be enough, and the trickle of regen at the end of every
    // recovery always leaves a sliver — which is how the free swings survived.
    w.player.stamina = w.derived.swing.staminaCost - 0.1;
    w.attack();
    expect(w.anim.attack).toBe('idle');
    w.player.stamina = w.derived.swing.staminaCost;
    w.attack();
    expect(w.anim.attack).toBe('windup');
  });

  it('lands a weaker blow the more tired you are', () => {
    const full = arena();
    full.attack();
    const tired = arena();
    tired.player.stamina = tired.derived.swing.staminaCost;
    tired.attack();
    expect(tired.anim.attackPower).toBeLessThan(full.anim.attackPower);
    expect(tired.anim.attackPower).toBeGreaterThanOrEqual(0.4);
  });

  it('runs a full bar dry rather than swinging for free forever', () => {
    const w = arena();
    const cost = w.derived.swing.staminaCost;
    const swings = swingUntilSpent(w);
    // A bar buys a bounded number of swings; it used to buy unlimited ones.
    expect(swings).toBeLessThanOrEqual(Math.ceil(w.derived.maxStamina / cost) + 1);
    expect(w.player.stamina).toBeLessThan(cost);
    expect(swingUntilSpent(w, 5)).toBe(0);
  });

  it('recovers after backing off, and swings again', () => {
    const w = arena();
    swingUntilSpent(w);
    expect(w.player.stamina).toBeLessThan(w.derived.swing.staminaCost);
    tick(w, 2);
    expect(w.player.stamina).toBeGreaterThan(0);
    w.attack();
    expect(w.anim.attack).toBe('windup');
  });
});

describe('crit', () => {
  it('a dagger crit lands harder than a long sword crit', () => {
    const dagger = makeEquipment({ baseId: 'dagger', materialId: 'iron', rarity: Rarity.Common, ilvl: 2, quality: 1 });
    const sword = makeEquipment({ baseId: 'long_sword', materialId: 'iron', rarity: Rarity.Common, ilvl: 2, quality: 1 });
    const foe = enemyDef('rat');
    // Force every swing to crit so the multiplier is what is being compared.
    const lucky = (item: typeof dagger) => {
      const eq = emptyEquipment();
      eq.weapon = item;
      const d = derivePlayer(eq, {});
      d.stats.luck = 100;
      return d;
    };
    const avg = (item: typeof dagger) => {
      const p = lucky(item);
      let total = 0;
      const rng = createRng(5);
      for (let i = 0; i < 400; i++) total += playerHitsEnemy(rng, p, 1, foe).damage;
      return total / 400;
    };
    const plain = (item: typeof dagger) => {
      const eq = emptyEquipment();
      eq.weapon = item;
      const p = derivePlayer(eq, {});
      p.stats.luck = 0;
      let total = 0;
      const rng = createRng(5);
      for (let i = 0; i < 400; i++) total += playerHitsEnemy(rng, p, 1, foe).damage;
      return total / 400;
    };
    // Crit chance is capped at 60%, so max luck still only crits 3 swings in 5.
    const CAP = 0.6;
    const daggerGain = avg(dagger) / plain(dagger);
    const swordGain = avg(sword) / plain(sword);
    expect(swordGain).toBeCloseTo(1 + CAP * (DEFAULT_CRIT_MULT - 1), 1);
    // What matters is the bonus over a non-crit, not the raw ratio: the dagger
    // turns the same Crit % into more than twice the extra damage.
    expect((daggerGain - 1) / (swordGain - 1)).toBeGreaterThan(2);
  });
});
