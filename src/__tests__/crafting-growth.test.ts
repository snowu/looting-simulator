import { addItem, createContainer } from '../state/inventory';
import { newGame } from '../state/game-state';
import { parseSave, serializeSave } from '../state/save-format';
import { advanceDay } from '../systems/market';
import { enemyDef } from '../data/enemies';
import { rollEnemyLoot } from '../systems/items';
import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { MATERIALS } from '../data/materials';
import { itemBase } from '../data/items';
import { recipe } from '../data/recipes';
import { buildCrafted, studyBlueprint, studySalvagedWeapon } from '../systems/crafting';
import { makeBlueprint, makeEquipment, rollBlueprint, rollContainerLoot } from '../systems/items';
import { Rarity, RecipeRanks } from '../types';

describe('crafting growth', () => {
  it('requires exactly 4/5/6/7/8 unidentified weapons from locked through rank five', () => {
    const ranks: RecipeRanks = {};
    const progress: Record<string, number> = {};
    const weapon = makeEquipment({ rarity: Rarity.Uncommon, ilvl: 2, baseId: 'dagger', materialId: 'copper', identified: false });
    for (let rank = 0; rank < 5; rank++) {
      for (let i = 1; i < rank + 4; i++) {
        studySalvagedWeapon(weapon, ranks, progress);
        expect(ranks.r_dagger ?? 0).toBe(rank);
      }
      studySalvagedWeapon(weapon, ranks, progress);
      expect(ranks.r_dagger).toBe(rank + 1);
      expect(progress.r_dagger).toBe(0);
    }
    expect(studySalvagedWeapon(weapon, ranks, progress)).toBeNull();
  });
  it('does not award mastery for identified, crafted or non-weapon equipment', () => {
    for (const item of [
      makeEquipment({ rarity: Rarity.Uncommon, ilvl: 2, baseId: 'dagger', materialId: 'copper', identified: true }),
      makeEquipment({ rarity: Rarity.Uncommon, ilvl: 2, baseId: 'dagger', materialId: 'copper', identified: false, crafted: true }),
      makeEquipment({ rarity: Rarity.Uncommon, ilvl: 2, baseId: 'cap', materialId: 'linen', identified: false }),
    ]) expect(studySalvagedWeapon(item, {}, {})).toBeNull();
  });
  it.each([1, 2, 3, 4, 5, 6])('guarantees depth-banded secret blueprints at depth %i', (depth) => {
    const rng = createRng(depth);
    for (let i = 0; i < 300; i++) {
      const bp = rollContainerLoot(rng, depth, 0, 'secret').items.filter(i => i.kind === 'blueprint');
      expect(bp).toHaveLength(1);
      expect(bp[0].qty).toBe(1);
      const min = itemBase(recipe(bp[0].ref).baseId).minDepth;
      expect(min).toBeLessThanOrEqual(depth);
      expect(min).toBeGreaterThanOrEqual(Math.min(4, depth - 2));
    }
  });
  it('favors weapon plans more strongly as depth increases', () => {
    const fraction = (depth: number) => {
      const rng = createRng(42);
      let weapons = 0;
      for (let i = 0; i < 10000; i++) {
        const bp = rollBlueprint(rng, depth);
        if (['weapon', 'thrown'].includes(itemBase(recipe(bp.ref).baseId).slot)) weapons++;
      }
      return weapons / 10000;
    };
    expect(fraction(6)).toBeGreaterThan(fraction(1));
  });
  it.each(['metal', 'wood', 'hide', 'cloth', 'bone'])('supports all five primary tiers for %s', category => {
    for (let tier = 1; tier <= 5; tier++) expect(MATERIALS.some(m => m.category === category && m.tier === tier)).toBe(true);
  });
  it('lets wood and cloth crafts reach the top material tier', () => {
    for (const [recipeId, primary, secondary] of [['r_club', 'starwood', 'linen'], ['r_robe', 'astral_silk', 'linen']]) {
      const crafted = buildCrafted({ recipeId, materials: [primary, secondary, null] }, 0);
      expect(crafted.ilvl).toBe(10);
    }
  });
});


it('migrates old saves and preserves partial salvage progress across reloads', () => {
  const state = newGame(createRng(5));
  const old = JSON.parse(serializeSave(state));
  old.revision = 18;
  delete old.recipeSalvage;
  const migrated = parseSave(JSON.stringify(old))!;
  expect(migrated.recipeSalvage).toEqual({});
  migrated.recipeSalvage.r_dagger = 3;
  const restored = parseSave(serializeSave(migrated))!;
  expect(restored.recipeSalvage.r_dagger).toBe(3);
  expect(restored.recipeRanks).toEqual(state.recipeRanks);
});

it('restocks deep structural materials only after their depth unlocks', () => {
  const state = newGame(createRng(5));
  const rng = createRng(10);
  for (let i = 0; i < 10; i++) advanceDay(state.market, rng, 1);
  expect(state.market.commodities.starwood.stock).toBe(0);
  expect(state.market.commodities.deep_yew.stock).toBe(0);
  for (let i = 0; i < 10; i++) advanceDay(state.market, rng, 6);
  expect(state.market.commodities.starwood.stock).toBe(1);
  expect(state.market.commodities.deep_yew.stock).toBe(2);
  expect(state.market.commodities.flame_shard.stock).toBe(2);
});

it.each([1, 6])('distributes single blueprints across loot sources at depth %i', depth => {
  const sample = 5000;
  for (const [source, chance] of [
    ['urn', 0.02 + 0.005 * depth], ['chest', 0.12 + 0.02 * depth],
    ['vault', 0.35 + 0.03 * depth], ['mob', 0.008 + 0.004 * depth],
  ] as const) {
    const rng = createRng(987);
    let count = 0;
    for (let i = 0; i < sample; i++) {
      const loot = source === 'mob' ? rollEnemyLoot(rng, enemyDef('rat'), depth, 0) : rollContainerLoot(rng, depth, 0, source);
      const plans = loot.items.filter(item => item.kind === 'blueprint');
      expect(plans.length).toBeLessThanOrEqual(1);
      for (const plan of plans) expect(plan.qty).toBe(1);
      count += plans.length;
    }
    expect(Math.abs(count / sample - chance)).toBeLessThan(0.025);
  }
});

it('paces late stock by days and replenishes only one unit per shipment', () => {
  const state = newGame(createRng(8));
  const rng = createRng(9);
  const market = state.market;
  while (market.day < 5) advanceDay(market, rng, 6);
  expect(market.commodities.moonsilver.stock).toBe(0);
  advanceDay(market, rng, 6);
  expect(market.commodities.moonsilver.stock).toBe(1);
  market.commodities.moonsilver.stock = 0;
  advanceDay(market, rng, 6);
  advanceDay(market, rng, 6);
  expect(market.commodities.moonsilver.stock).toBe(0);
  advanceDay(market, rng, 6);
  expect(market.commodities.moonsilver.stock).toBe(1);
  while (market.day < 17) advanceDay(market, rng, 6);
  expect(market.commodities.star_iron.stock).toBe(0);
  advanceDay(market, rng, 6);
  expect(market.commodities.star_iron.stock).toBe(1);
  market.commodities.star_iron.stock = 0;
  while (market.day < 23) advanceDay(market, rng, 6);
  expect(market.commodities.star_iron.stock).toBe(0);
  advanceDay(market, rng, 6);
  expect(market.commodities.star_iron.stock).toBe(1);
  while (market.day < 30) advanceDay(market, rng, 6);
  expect(market.commodities.star_iron.stock).toBe(2);
});

it('preserves earned salvage counts when a blueprint advances the recipe', () => {
  const ranks = { r_dagger: 1 };
  const progress = { r_dagger: 4 };
  const stash = createContainer(0);
  const bp = makeBlueprint('r_dagger');
  bp.qty = 2;
  addItem(stash, bp);
  expect(studyBlueprint(bp, stash, ranks)).toBe(2);
  const weapon = makeEquipment({ baseId: 'dagger', materialId: 'copper', rarity: Rarity.Uncommon, ilvl: 2, identified: false });
  studySalvagedWeapon(weapon, ranks, progress);
  expect(ranks.r_dagger).toBe(2);
  studySalvagedWeapon(weapon, ranks, progress);
  expect(ranks.r_dagger).toBe(3);
  expect(progress.r_dagger).toBe(0);
});
