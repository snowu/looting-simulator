import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import {
  advanceDay,
  buyCommodity,
  commoditySellPrice,
  createMarket,
  itemSellPrice,
  quoteSell,
  sellCommodity,
} from '../systems/market';
import { MATERIALS, material } from '../data/materials';
import { generateContract, isComplete, contractTitle, refreshContracts } from '../systems/contracts';
import { addItem, countOf, createContainer } from '../state/inventory';
import { makeBlueprint, makeEquipment, makeMaterial } from '../systems/items';
import { buildCrafted, craft, materialsForSlot, selectionError, studyBlueprint } from '../systems/crafting';
import { recipe } from '../data/recipes';
import { Rarity, RARITY_ORDER } from '../types';

describe('market', () => {
  it('keeps prices in bounds over a long simulation', () => {
    const rng = createRng(1);
    const m = createMarket(rng);
    for (let d = 0; d < 120; d++) advanceDay(m, rng);
    for (const mat of MATERIALS) {
      const p = m.commodities[mat.id].price;
      expect(p).toBeGreaterThanOrEqual(Math.floor(mat.value * 0.25));
      expect(p).toBeLessThanOrEqual(Math.ceil(mat.value * 4));
      expect(m.commodities[mat.id].history.length).toBeLessThanOrEqual(30);
    }
  });

  it('mean-reverts after a price shock', () => {
    const rng = createRng(2);
    const m = createMarket(rng);
    m.commodities.iron.price = material('iron').value * 4;
    m.events = [];
    m.upcoming = null;
    for (let d = 0; d < 10; d++) {
      advanceDay(m, rng);
      m.events = [];
      m.upcoming = null;
    }
    expect(m.commodities.iron.price).toBeLessThan(material('iron').value * 1.8);
  });

  it('dumping goods has slippage and depresses the price', () => {
    const m = createMarket(createRng(3));
    const unit = commoditySellPrice(m, 'silver', 0);
    const quote = quoteSell(m, 'silver', 10, 0);
    expect(m.commodities.silver.price).toBeGreaterThan(0);
    expect(quote).toBeLessThan(unit * 10);
    const before = m.commodities.silver.price;
    expect(sellCommodity(m, 'silver', 10, 0)).toBe(quote);
    expect(m.commodities.silver.price).toBeLessThan(before);
  });

  it('buying consumes stock and costs gold', () => {
    const m = createMarket(createRng(4));
    const stock = m.commodities.iron.stock;
    const res = buyCommodity(m, 'iron', 3, 0, 10_000)!;
    expect(res.qty).toBe(3);
    expect(res.cost).toBeGreaterThan(0);
    expect(m.commodities.iron.stock).toBe(stock - 3);
    expect(buyCommodity(m, 'iron', 3, 0, 0)).toBeNull();
  });

  it('unlocks high-end commodity stock with delve progress', () => {
    const rng = createRng(44);
    const m = createMarket(rng);
    expect(m.commodities.gold.stock).toBe(0);
    expect(m.commodities.moonsilver.stock).toBe(0);
    advanceDay(m, rng, 2);
    expect(m.commodities.gold.stock).toBeGreaterThan(0);
    expect(m.commodities.moonsilver.stock).toBe(0);
    advanceDay(m, rng, 5);
    expect(m.commodities.moonsilver.stock).toBeGreaterThan(0);
  });

  it('offers two different unknown blueprints when possible', () => {
    const m = createMarket(createRng(45), { r_dagger: 1, r_short_sword: 1, r_club: 1, r_buckler: 1, r_cap: 1, r_jerkin: 1, r_gloves: 1, r_band: 1 });
    const blueprints = m.wares.filter((item) => item.kind === 'blueprint');
    expect(blueprints).toHaveLength(2);
    expect(new Set(blueprints.map((item) => item.ref)).size).toBe(2);
  });

  it('unidentified items sell for less', () => {
    const m = createMarket(createRng(5));
    const it = makeEquipment({ baseId: 'long_sword', materialId: 'iron', rarity: Rarity.Rare, ilvl: 4, affixes: [{ id: 'sharp', value: 4 }], identified: true });
    const known = itemSellPrice(m, it, 0);
    it.identified = false;
    expect(itemSellPrice(m, it, 0)).toBeLessThan(known);
  });
});

describe('contracts', () => {
  it('generates readable contracts and tops up the board', () => {
    const rng = createRng(6);
    for (let i = 0; i < 40; i++) expect(contractTitle(generateContract(rng, 3)).length).toBeGreaterThan(5);
    expect(refreshContracts([], rng, 2)).toHaveLength(5);
  });

  it('deliver contracts complete when the stash has the goods', () => {
    const rng = createRng(7);
    let c = generateContract(rng, 2);
    while (c.kind !== 'deliver') c = generateContract(rng, 2);
    const stash = createContainer(0);
    expect(isComplete(c, stash)).toBe(false);
    addItem(stash, makeMaterial(c.materialId!, c.qty!));
    expect(isComplete(c, stash)).toBe(true);
  });
});

describe('crafting', () => {
  it('validates, consumes materials and yields an identified item', () => {
    const stash = createContainer(0);
    addItem(stash, makeMaterial('iron', 3));
    const sel = { recipeId: 'r_short_sword', materials: ['iron', 'timber', null] };
    expect(selectionError(sel, stash)).toMatch(/Timber/);
    addItem(stash, makeMaterial('timber', 1));
    expect(selectionError(sel, stash)).toBeNull();
    const item = craft(sel, stash, createRng(1), 0)!;
    expect(item.crafted).toBe(true);
    expect(item.identified).toBe(true);
    expect(item.materialId).toBe('iron');
    expect(countOf(stash, 'material', 'iron')).toBe(0);
  });

  it('a catalyst adds its affix and lifts rarity', () => {
    const plain = buildCrafted({ recipeId: 'r_short_sword', materials: ['iron', 'yew', null] }, 0);
    const jade = buildCrafted({ recipeId: 'r_short_sword', materials: ['iron', 'yew', 'jade'] }, 0);
    expect(jade.affixes!.map((a) => a.id)).toContain('vital');
    expect(RARITY_ORDER[jade.rarity!]).toBe(RARITY_ORDER[plain.rarity!] + 1);
  });

  it('fills crafted items with the affixes promised by their rarity', () => {
    const epic = buildCrafted({ recipeId: 'r_short_sword', materials: ['star_iron', 'yew', null] }, 0, createRng(8));
    const legendary = buildCrafted({ recipeId: 'r_short_sword', materials: ['star_iron', 'yew', 'jade'] }, 0, createRng(9));
    expect(epic.rarity).toBe(Rarity.Epic);
    expect(epic.affixes).toHaveLength(3);
    expect(legendary.rarity).toBe(Rarity.Legendary);
    expect(legendary.affixes).toHaveLength(4);
    expect(legendary.affixes!.map((a) => a.id)).toContain('vital');
  });

  it('keeps Master Smith 3 as an extra affix and rarity upgrade', () => {
    const item = buildCrafted({ recipeId: 'r_short_sword', materials: ['silver', 'yew', null] }, 3, createRng(10));
    expect(item.rarity).toBe(Rarity.Rare);
    expect(item.affixes).toHaveLength(2);
  });

  it('consumes blueprints to unlock and master a recipe up to rank five', () => {
    const stash = createContainer(0);
    const ranks: Record<string, number> = {};
    for (let expected = 1; expected <= 5; expected++) {
      const blueprints = Array.from({ length: expected }, () => makeBlueprint('r_long_sword'));
      for (const blueprint of blueprints) addItem(stash, blueprint);
      expect(studyBlueprint(blueprints[0], stash, ranks)).toBe(expected);
      expect(ranks.r_long_sword).toBe(expected);
      expect(countOf(stash, 'blueprint', 'r_long_sword')).toBe(0);
    }
    const extra = makeBlueprint('r_long_sword');
    addItem(stash, extra);
    expect(studyBlueprint(extra, stash, ranks)).toBeNull();
    expect(stash.items.some((item) => item.uid === extra.uid)).toBe(true);
  });

  it('does not spend blueprints until the full next-rank cost is owned', () => {
    const stash = createContainer(0);
    const ranks = { r_short_sword: 2 };
    const first = makeBlueprint('r_short_sword');
    const second = makeBlueprint('r_short_sword');
    addItem(stash, first);
    addItem(stash, second);
    expect(studyBlueprint(first, stash, ranks)).toBeNull();
    expect(ranks.r_short_sword).toBe(2);
    expect(countOf(stash, 'blueprint', 'r_short_sword')).toBe(2);
  });

  it('orders forge materials by tier and value', () => {
    const materials = materialsForSlot(recipe('r_short_sword').slots[1], createContainer(0)).map((entry) => entry.def.id);
    expect(materials.indexOf('bone')).toBeLessThan(materials.indexOf('dragon_scale'));
    for (let i = 1; i < materials.length; i++) expect(material(materials[i]).tier).toBeGreaterThanOrEqual(material(materials[i - 1]).tier);
  });

  it('freezes recipe rank on a craft and rejects unknown recipes', () => {
    const stash = createContainer(0);
    addItem(stash, makeMaterial('iron', 6));
    addItem(stash, makeMaterial('timber', 2));
    const sel = { recipeId: 'r_short_sword', materials: ['iron', 'timber', null] };
    expect(craft(sel, stash, createRng(11), 0, 0)).toBeNull();
    expect(countOf(stash, 'material', 'iron')).toBe(6);
    const item = craft(sel, stash, createRng(11), 0, 5)!;
    expect(item.craftRank).toBe(5);
  });

  it('refuses materials of the wrong category', () => {
    const stash = createContainer(0);
    addItem(stash, makeMaterial('linen', 5));
    addItem(stash, makeMaterial('timber', 5));
    expect(selectionError({ recipeId: 'r_short_sword', materials: ['linen', 'timber', null] }, stash)).toMatch(/can't be used/);
  });
});
