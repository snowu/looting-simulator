import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { attackPower, defensePower, depthPower } from '../systems/dungeon';
import { enemyDef, ENEMIES } from '../data/enemies';
import { mitigate, playerHitsEnemy, enemyHitsPlayer } from '../systems/combat';
import { derivePlayer, emptyEquipment } from '../systems/player';
import { makeEquipment } from '../systems/items';
import { Rarity } from '../types';

/**
 * The shape of the difficulty curve, rather than any particular number on it.
 *
 * The balance pass of 2026-09-13 existed because the player's power grew about
 * tenfold from depth 1 to depth 6 while monsters grew 1.2x. These are the
 * properties that stopped that being true, written down so a later retune has
 * to break them on purpose rather than by accident.
 */
describe('how monsters scale with depth', () => {
  it('tracks the floor number, not just the monster\'s own home depth', () => {
    const rat = enemyDef('rat');
    // A rat lives on depths 1-3, so the over-level term alone would run out.
    // The floor term is what keeps a depth-3 rat ahead of a depth-1 one by
    // more than the 24% the over-level term gives on its own.
    expect(depthPower(rat, 3) / depthPower(rat, 1)).toBeGreaterThan(1.8);
    // And a monster whose home floor IS the deep one still scales with it.
    const king = enemyDef('ashen_king');
    expect(depthPower(king, 6)).toBeGreaterThan(3);
  });

  it('grows health faster than damage, and damage faster than armour', () => {
    const p = depthPower(enemyDef('skeleton'), 5);
    expect(p).toBeGreaterThan(attackPower(p));
    expect(attackPower(p)).toBeGreaterThan(defensePower(p));
    expect(defensePower(p)).toBeGreaterThan(1);
  });
});

describe('mitigation', () => {
  it('never lets armour switch damage off', () => {
    // The old curve clamped at 20% and a plated player sat near it. A third of
    // every blow has to land, however much armour is worn.
    const bare = enemyHitsPlayer(createRng(1), 100, 'slash', derivePlayer(emptyEquipment(), {}));
    const plated = derivePlayer((() => {
      const e = emptyEquipment();
      e.body = makeEquipment({ baseId: 'plate', materialId: 'star_iron', rarity: Rarity.Epic, ilvl: 16 });
      e.head = makeEquipment({ baseId: 'great_helm', materialId: 'star_iron', rarity: Rarity.Epic, ilvl: 16 });
      e.offhand = makeEquipment({ baseId: 'tower_shield', materialId: 'star_iron', rarity: Rarity.Epic, ilvl: 16 });
      return e;
    })(), {});
    const armoured = enemyHitsPlayer(createRng(1), 100, 'slash', plated);
    expect(armoured).toBeLessThan(bare);
    expect(armoured / bare).toBeGreaterThan(0.3);
  });

  it('keeps the floor as a floor', () => {
    expect(mitigate(100, 1e6, 75, 0.34)).toBeCloseTo(34, 5);
  });
});

describe('elemental damage', () => {
  it('pierces armour without ignoring it', () => {
    const withElement = (() => {
      const e = emptyEquipment();
      // Elemental power comes from an affix, independently of material identity.
      e.weapon = makeEquipment({ baseId: 'war_axe', materialId: 'iron', rarity: Rarity.Uncommon, ilvl: 12, affixes: [{ id: 'rimed', value: 6 }] });
      return derivePlayer(e, {});
    })();
    const soft = { ...enemyDef('ghoul'), defense: 0, resist: {} };
    const hard = { ...enemyDef('ghoul'), defense: 60, resist: {} };
    const avg = (def: typeof soft, mult: number) => {
      const rng = createRng(9);
      let total = 0;
      for (let i = 0; i < 500; i++) total += playerHitsEnemy(rng, withElement, 1, def, mult).damage;
      return total / 500;
    };
    // Armour must reduce the elemental portion too — it used to be added flat
    // after mitigation, which made it a clean bypass against a plated monster.
    expect(avg(hard, 1)).toBeLessThan(avg(soft, 1) * 0.8);
    // But it is still the armour-piercing half: it loses less than the
    // physical portion does, because it is mitigated at half weight.
    const physOnly = (() => {
      const e = emptyEquipment();
      e.weapon = makeEquipment({ baseId: 'war_axe', materialId: 'iron', rarity: Rarity.Common, ilvl: 12 });
      return derivePlayer(e, {});
    })();
    const physRatio = (() => {
      const rng = createRng(9);
      let hardT = 0, softT = 0;
      for (let i = 0; i < 500; i++) hardT += playerHitsEnemy(rng, physOnly, 1, hard, 1).damage;
      for (let i = 0; i < 500; i++) softT += playerHitsEnemy(rng, physOnly, 1, soft, 1).damage;
      return hardT / softT;
    })();
    expect(avg(hard, 1) / avg(soft, 1)).toBeGreaterThan(physRatio);
  });
});

describe('the roster', () => {
  it('gives every monster a readable wind-up', () => {
    // The whole combat pitch is that you can see a blow coming and answer it.
    for (const e of ENEMIES) expect(e.windup).toBeGreaterThanOrEqual(0.24);
  });

  it('keeps the Ashen King\'s drops guaranteed', () => {
    // A blanket trim to drop rates once caught these by accident.
    const king = enemyDef('ashen_king');
    for (const id of ['star_iron', 'shadow_essence', 'jeweled_skull']) {
      expect(king.loot.find((l) => l.id === id)!.chance).toBe(1);
    }
    expect(king.itemChance).toBe(1);
  });
});
