import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import {
  identify,
  itemName,
  itemStats,
  itemValue,
  makeBlueprint,
  makeEquipment,
  makeMaterial,
  maxDurability,
  materialAvailableAtDepth,
  materialForDepth,
  rollContainerLoot,
  rollBlueprint,
  rollEnemyLoot,
  rollEquipment,
  rollRarity,
  salvage,
} from '../systems/items';
import { MATERIALS } from '../data/materials';

const MAX_MATERIAL_TIER = Math.max(...MATERIALS.map((m) => m.tier));
import { addItem, canFit, countOf, createContainer, removeOf, takeQty } from '../state/inventory';
import { studyBlueprint } from '../systems/crafting';
import { DEFAULT_CRIT_MULT, Rarity, RARITY_ORDER } from '../types';
import { enemyDef, BOSS_ID } from '../data/enemies';
import { GEAR_LINES, gearPredecessor, gearTier, itemBase } from '../data/items';
import { MAX_RECIPE_RANK, RECIPES, recipe, recipeForBase } from '../data/recipes';
import { derivePlayer, emptyEquipment } from '../systems/player';

describe('items', () => {
  it('rolls equipment deterministically', () => {
    const a = rollEquipment(createRng(5), 3, 0);
    const b = rollEquipment(createRng(5), 3, 0);
    expect({ ...a, uid: '' }).toEqual({ ...b, uid: '' });
  });

  it('material tier scales stats', () => {
    const copper = makeEquipment({ baseId: 'long_sword', materialId: 'copper', rarity: Rarity.Common, ilvl: 1 });
    const star = makeEquipment({ baseId: 'long_sword', materialId: 'star_iron', rarity: Rarity.Common, ilvl: 1 });
    expect(itemStats(star).attack).toBeGreaterThan(itemStats(copper).attack * 2);
    expect(itemStats(star).shadow).toBeGreaterThan(0);
    expect(itemValue(star)).toBeGreaterThan(itemValue(copper));
  });

  it('the mining pick is a craftable piercing weapon', () => {
    const base = itemBase('mining_pick');
    const pick = makeEquipment({ baseId: base.id, materialId: 'iron', rarity: Rarity.Common, ilvl: 1 });
    // Its own weapon class is what Rock and Stone keys off.
    expect(base.weaponClass).toBe('pick');
    expect(base.damageType).toBe('pierce');
    expect(itemStats(pick).attack).toBeGreaterThan(0);
    expect(maxDurability(pick)).toBeGreaterThan(0);
    expect(recipe('r_mining_pick').baseId).toBe(base.id);
  });

  it('hides affixes until identified', () => {
    const it = rollEquipment(createRng(11), 4, 0, { rarity: Rarity.Rare });
    expect(it.identified).toBe(false);
    expect(itemName(it)).toMatch(/^Unidentified /);
    const before = itemStats(it);
    identify(it);
    const after = itemStats(it);
    expect(itemName(it)).not.toMatch(/^Unidentified /);
    const sum = (s: typeof before) => Object.values(s).reduce((a, b) => a + Math.abs(b), 0);
    expect(sum(after)).toBeGreaterThan(sum(before));
  });

  it('rarity controls affix count', () => {
    const r = createRng(3);
    for (const rarity of [Rarity.Common, Rarity.Uncommon, Rarity.Rare, Rarity.Epic, Rarity.Legendary]) {
      const it = rollEquipment(r, 6, 0, { rarity, baseId: 'long_sword' });
      expect(it.affixes!.length).toBe(RARITY_ORDER[rarity]);
    }
  });

  it('unlocks natural high rarities deeper in the delve', () => {
    for (let seed = 0; seed < 500; seed++) {
      expect(RARITY_ORDER[rollRarity(createRng(seed), 1, 500)]).toBeLessThanOrEqual(RARITY_ORDER[Rarity.Uncommon]);
      expect(RARITY_ORDER[rollRarity(createRng(seed), 3, 500)]).toBeLessThanOrEqual(RARITY_ORDER[Rarity.Rare]);
      expect(RARITY_ORDER[rollRarity(createRng(seed), 5, 500)]).toBeLessThanOrEqual(RARITY_ORDER[Rarity.Epic]);
    }
  });

  it('does not roll equipment materials before their progression depth', () => {
    for (let depth = 1; depth <= 6; depth++) {
      for (let seed = 0; seed < 200; seed++) {
        const rolled = materialForDepth(createRng(seed), depth, ['metal', 'wood', 'hide', 'cloth', 'bone']);
        expect(materialAvailableAtDepth(rolled, depth)).toBe(true);
      }
    }
    expect(MATERIALS.filter((m) => materialAvailableAtDepth(m, 1)).map((m) => m.id)).not.toContain('gold');
  });

  it('makes rarer materials scarcer than commoner ones of the same tier', () => {
    const counts: Record<string, number> = {};
    // Silver and gold are both tier 3, so the tier-distance weighting cancels
    // and only the rarity weight is left — which is the thing under test. The
    // old version compared gold against iron, a tier apart, and so measured
    // the two weightings multiplied together. Depth 4 is the first floor
    // either of them can drop on.
    for (let seed = 0; seed < 1000; seed++) {
      const id = materialForDepth(createRng(seed), 4, ['metal']).id;
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(counts.silver).toBeGreaterThan(0);
    expect(counts.gold ?? 0).toBeLessThan(counts.silver / 2);
  });

  it('makes loot find raise quality, not just quantity', () => {
    // Common's weight used to be a flat 100, which anchored the whole roll: a
    // maxed Treasure Sense bought about 15% more drops of which nearly all were
    // still Common. "Loot find" has to mean better loot, not more junk.
    const share = (find: number) => {
      let common = 0;
      const rng = createRng(4);
      for (let i = 0; i < 4000; i++) if (rollRarity(rng, 4, find) === Rarity.Common) common++;
      return common / 4000;
    };
    const none = share(0);
    const maxed = share(60);
    expect(maxed).toBeLessThan(none * 0.75);
    // And it must change nothing at all for a player who has bought none.
    expect(share(0)).toBe(none);
  });

  it('keeps shallow special chests within the current depth band', () => {
    for (let seed = 0; seed < 100; seed++) {
      const loot = rollContainerLoot(createRng(seed), 1, 500, 'vault');
      const equipment = loot.items.filter((item) => item.kind === 'equipment');
      expect(equipment.length).toBeGreaterThanOrEqual(1);
      expect(equipment.length).toBeLessThanOrEqual(2);
      for (const item of equipment) {
        expect(item.rarity).toBe(Rarity.Uncommon);
        expect(item.ilvl).toBeLessThanOrEqual(4);
        expect(itemBase(item.ref).minDepth).toBe(1);
      }
    }
  });

  const maxed = (depth: number, except: Record<string, number> = {}): Record<string, number> => {
    const ranks: Record<string, number> = {};
    for (const r of RECIPES) if (itemBase(r.baseId).minDepth <= depth) ranks[r.id] = MAX_RECIPE_RANK;
    return { ...ranks, ...except };
  };

  it('prioritizes unknown blueprints, then uncapped mastery', () => {
    const unknownDagger = maxed(1);
    delete unknownDagger.r_dagger;
    for (let seed = 0; seed < 20; seed++) expect(rollBlueprint(createRng(seed), 1, unknownDagger).ref).toBe('r_dagger');
    const partialClub = maxed(1, { r_club: 2 });
    for (let seed = 0; seed < 20; seed++) expect(rollBlueprint(createRng(seed), 1, partialClub).ref).toBe('r_club');
  });

  it('drops blueprints higher up a line more rarely', () => {
    // Everything on the dagger line is open and part-ranked, so only the
    // ladder weighting separates them.
    const ranks = maxed(3, { r_dagger: 1, r_short_sword: 1, r_long_sword: 1 });
    const counts: Record<string, number> = { r_dagger: 0, r_short_sword: 0, r_long_sword: 0 };
    for (let seed = 0; seed < 3000; seed++) {
      const ref = rollBlueprint(createRng(seed), 3, { ...ranks }).ref;
      if (ref in counts) counts[ref]++;
    }
    expect(counts.r_dagger).toBeGreaterThan(counts.r_short_sword * 1.5);
    expect(counts.r_short_sword).toBeGreaterThan(counts.r_long_sword * 1.5);
  });

  it('always has a blueprint to give even with the ladder fully climbed', () => {
    const ranks = maxed(6);
    for (let seed = 0; seed < 40; seed++) {
      expect(rollBlueprint(createRng(seed), 6, { ...ranks }).kind).toBe('blueprint');
    }
  });

  it('still studies a blueprint the ladder would no longer hand out', () => {
    // Saves written before the chain existed can hold a gated blueprint. The
    // gate governs what drops, never what you already carry.
    const stash = createContainer(20);
    addItem(stash, makeBlueprint('r_plate'));
    const ranks: Record<string, number> = {};
    expect(studyBlueprint(makeBlueprint('r_plate'), stash, ranks)).toBe(1);
    expect(ranks.r_plate).toBe(1);
  });

  it('makes each step up a line beat the step below it at +2 material tiers', () => {
    // The promise of the ladder: a Long Sword in copper should edge out a
    // Short Sword in silver. Checked at every tier the two can share.
    const statOf = (baseId: string, tier: number, key: 'attack' | 'defense') => {
      const base = itemBase(baseId);
      return (base.base[key] ?? 0) + (base.perTier[key] ?? 0) * (tier - 1);
    };
    for (const line of GEAR_LINES) {
      for (let i = 1; i < line.length; i++) {
        const key = itemBase(line[i]).slot === 'weapon' ? 'attack' : 'defense';
        for (let tier = 1; tier + 2 <= MAX_MATERIAL_TIER; tier++) {
          const next = statOf(line[i], tier, key);
          const prev = statOf(line[i - 1], tier + 2, key);
          expect({ step: line[i], tier, next, under: line[i - 1], prev })
            .toMatchObject({ next: expect.any(Number) });
          expect(next).toBeGreaterThan(prev);
        }
      }
    }
  });

  it('makes the dagger the crit weapon, and crit gear worth stacking on it', () => {
    const dagger = itemBase('dagger');
    const sword = itemBase('long_sword');
    expect(dagger.swing!.critMult).toBeGreaterThan(DEFAULT_CRIT_MULT);
    expect(sword.swing!.critMult ?? DEFAULT_CRIT_MULT).toBe(DEFAULT_CRIT_MULT);
    // Crit chance has to actually scale with the blade, not sit at a token 3%.
    const luckAt = (tier: number) => (dagger.base.luck ?? 0) + (dagger.perTier.luck ?? 0) * (tier - 1);
    expect(luckAt(1)).toBeGreaterThanOrEqual(5);
    expect(luckAt(5)).toBeGreaterThan(luckAt(1) * 2);
    // The same Crit % ring is worth more than twice as much on the dagger.
    const gain = (m: number, luck: number) => (luck / 100) * (m - 1);
    const ring = 10;
    expect(gain(dagger.swing!.critMult!, ring)).toBeGreaterThan(gain(DEFAULT_CRIT_MULT, ring) * 2);
  });

  it('orders every gear line by depth, scarcity and worth', () => {
    for (const line of GEAR_LINES) {
      for (let i = 1; i < line.length; i++) {
        const prev = itemBase(line[i - 1]);
        const next = itemBase(line[i]);
        expect(next.minDepth).toBeGreaterThan(prev.minDepth);
        expect(next.weight).toBeLessThan(prev.weight);
        expect(next.value).toBeGreaterThan(prev.value);
        expect(recipeForBase(next.id)!.value).toBeGreaterThanOrEqual(recipeForBase(prev.id)!.value);
      }
    }
  });

  it('places every item base on exactly one line', () => {
    const listed = GEAR_LINES.flat();
    expect(new Set(listed).size).toBe(listed.length);
    for (const r of RECIPES) {
      expect(listed).toContain(r.baseId);
      const prev = gearPredecessor(r.baseId);
      if (prev) expect(gearTier(r.baseId)).toBe(gearTier(prev) + 1);
    }
  });

  it('lets a fresh smith reach every blueprint by ranking up', () => {
    // Walk the ladder from the starter recipes and check nothing is stranded.
    const ranks: Record<string, number> = {};
    for (const r of RECIPES) if (r.starter) ranks[r.id] = 1;
    const rng = createRng(7);
    for (let i = 0; i < 4000; i++) {
      const ref = rollBlueprint(rng, 6, ranks).ref;
      ranks[ref] = Math.min(MAX_RECIPE_RANK, (ranks[ref] ?? 0) + 1);
    }
    for (const r of RECIPES) expect(ranks[r.id] ?? 0).toBe(MAX_RECIPE_RANK);
  });

  it('applies mastery only to positive crafted core stats', () => {
    const spec = { baseId: 'long_sword', materialId: 'gold', rarity: Rarity.Rare, ilvl: 6, quality: 1, affixes: [{ id: 'vital', value: 10 }], crafted: true };
    const rank1 = makeEquipment({ ...spec, craftRank: 1 });
    const rank5 = makeEquipment({ ...spec, craftRank: 5 });
    const coreAttack = itemBase('long_sword').base.attack! + itemBase('long_sword').perTier.attack! * 2;
    expect(itemStats(rank5).attack).toBe(Math.round(coreAttack * 1.4));
    expect(itemStats(rank5).luck).toBe(itemStats(rank1).luck);
    expect(itemStats(rank5).find).toBe(itemStats(rank1).find);
    expect(itemStats(rank5).health).toBe(itemStats(rank1).health);
    expect(itemValue(rank5)).toBe(itemValue(rank1));

    const plate1 = makeEquipment({ baseId: 'plate', materialId: 'iron', rarity: Rarity.Common, ilvl: 4, quality: 1, crafted: true, craftRank: 1 });
    const plate5 = makeEquipment({ baseId: 'plate', materialId: 'iron', rarity: Rarity.Common, ilvl: 4, quality: 1, crafted: true, craftRank: 5 });
    expect(itemStats(plate5).speed).toBe(itemStats(plate1).speed);
    expect(itemStats(plate5).stamina).toBe(itemStats(plate1).stamina);
  });

  it('gives basic grip materials distinct secondary stats', () => {
    const make = (secondaryId?: string) => itemStats(makeEquipment({
      baseId: 'short_sword', materialId: 'iron', secondaryId, rarity: Rarity.Common, ilvl: 4, quality: 1, crafted: true,
    }));
    const plain = make();
    expect(make('bone').attack - plain.attack).toBe(2);
    expect(make('rat_hide').health).toBe(3);
    expect(make('timber').speed).toBe(2);
    expect(make('leather').health).toBe(5);
    expect(make('dragon_scale').health).toBe(41);
    expect(make('dragon_scale').fire).toBe(10);
    expect(make('dragon_scale').defense).toBe(4);
  });

  it('the boss always drops a legendary', () => {
    const loot = rollEnemyLoot(createRng(1), enemyDef(BOSS_ID), 6, 0);
    expect(loot.items.some((i) => i.rarity === Rarity.Legendary)).toBe(true);
    expect(loot.gold).toBeGreaterThan(100);
  });

  it('salvage gives back the primary material', () => {
    const sword = makeEquipment({ baseId: 'short_sword', materialId: 'iron', rarity: Rarity.Common, ilvl: 2 });
    const out = salvage(sword, createRng(2));
    expect(out.some((m) => m.ref === 'iron')).toBe(true);
  });

  it('derived player stats sum equipment', () => {
    const eq = emptyEquipment();
    const bare = derivePlayer(eq, {});
    eq.weapon = makeEquipment({ baseId: 'mace', materialId: 'iron', rarity: Rarity.Common, ilvl: 2 });
    eq.body = makeEquipment({ baseId: 'hauberk', materialId: 'iron', rarity: Rarity.Common, ilvl: 2 });
    const armed = derivePlayer(eq, { toughness: 2 });
    expect(armed.attack).toBeGreaterThan(bare.attack);
    expect(armed.stats.defense).toBeGreaterThan(0);
    expect(armed.damageType).toBe('blunt');
    expect(armed.maxHp).toBe(bare.maxHp + 24);
    expect(armed.swing.recovery).toBeGreaterThan(0);
  });
});

describe('inventory', () => {
  it('respects capacity', () => {
    const c = createContainer(2);
    const mk = () => makeEquipment({ baseId: 'dagger', materialId: 'copper', rarity: Rarity.Common, ilvl: 1 });
    expect(addItem(c, mk())).toBe(0);
    expect(addItem(c, mk())).toBe(0);
    const third = mk();
    expect(canFit(c, third)).toBe(false);
    expect(addItem(c, third)).toBe(1);
  });

  it('stacks materials to 20 per slot', () => {
    const c = createContainer(3);
    expect(addItem(c, makeMaterial('iron', 45))).toBe(0);
    expect(c.items.map((i) => i.qty)).toEqual([20, 20, 5]);
    expect(addItem(c, makeMaterial('iron', 20))).toBe(5);
    expect(countOf(c, 'material', 'iron')).toBe(60);
  });

  it('unlimited stash merges into one stack', () => {
    const s = createContainer(0);
    addItem(s, makeMaterial('bone', 50));
    addItem(s, makeMaterial('bone', 70));
    expect(s.items).toHaveLength(1);
    expect(s.items[0].qty).toBe(120);
  });

  it('stacks matching blueprints by recipe', () => {
    const stash = createContainer(0);
    addItem(stash, makeBlueprint('r_long_sword'));
    addItem(stash, makeBlueprint('r_long_sword'));
    addItem(stash, makeBlueprint('r_mace'));
    expect(stash.items.map((item) => [item.ref, item.qty])).toEqual([
      ['r_long_sword', 2],
      ['r_mace', 1],
    ]);

    const pack = createContainer(1);
    expect(addItem(pack, { ...makeBlueprint('r_long_sword'), qty: 21 })).toBe(1);
    expect(pack.items).toHaveLength(1);
    expect(pack.items[0].qty).toBe(20);
  });

  it('removeOf is all-or-nothing', () => {
    const c = createContainer(0);
    addItem(c, makeMaterial('linen', 3));
    expect(removeOf(c, 'material', 'linen', 5)).toBe(false);
    expect(countOf(c, 'material', 'linen')).toBe(3);
    expect(removeOf(c, 'material', 'linen', 3)).toBe(true);
    expect(c.items).toHaveLength(0);
  });

  it('takeQty splits a stack', () => {
    const c = createContainer(4);
    addItem(c, makeMaterial('copper', 10));
    const part = takeQty(c, c.items[0].uid, 4)!;
    expect(part.qty).toBe(4);
    expect(c.items[0].qty).toBe(6);
    expect(part.uid).not.toBe(c.items[0].uid);
  });
});
