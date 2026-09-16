import { expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { RECIPES, recipe } from '../data/recipes';
import { MATERIALS } from '../data/materials';
import { newGame } from '../state/game-state';
import { addItem, countOf, createContainer } from '../state/inventory';
import { parseSave, serializeSave } from '../state/save-format';
import { buildCrafted, craft, materialsForSlot, selectionError } from '../systems/crafting';
import { itemStats, makeEquipment, makeMaterial, salvage } from '../systems/items';
import { Rarity } from '../types';

const stocked = () => {
  const stash = createContainer();
  for (const mat of MATERIALS) addItem(stash, makeMaterial(mat.id, 30));
  return stash;
};

it('offers all five complete material families in both secondary slots of every recipe', () => {
  const stash = stocked();
  const ids = MATERIALS.filter(m => !['gem', 'valuable'].includes(m.category)).map(m => m.id).sort();
  for (const r of RECIPES) {
    expect(r.slots).toHaveLength(4);
    expect(r.slots[1].optional).not.toBe(true);
    expect(r.slots[2].optional).toBe(true);
    expect(r.slots[2].qty).toBe(1);
    for (const i of [1, 2]) expect(materialsForSlot(r.slots[i], stash).map(o => o.def.id).sort()).toEqual(ids);
  }
});

it('keeps the club body wood or bone and the sword blade metal', () => {
  const stash = stocked();
  expect(recipe('r_club').slots[0].categories).toEqual(['wood', 'bone']);
  expect(selectionError({ recipeId: 'r_club', materials: ['iron', 'timber', 'linen', null] }, stash)).toMatch(/can't be used as Body/);
  expect(selectionError({ recipeId: 'r_short_sword', materials: ['linen', 'iron', 'bone', null] }, stash)).toMatch(/can't be used as Blade/);
  expect(selectionError({ recipeId: 'r_club', materials: ['timber', 'iron', 'linen', null] }, stash)).toBeNull();
});

it('mixes bone and cloth in either secondary slot and applies both bonuses with a catalyst', () => {
  const a = buildCrafted({ recipeId: 'r_dagger', materials: ['iron', 'titan_bone', 'astral_silk', 'flame_shard'] }, 0);
  const b = buildCrafted({ recipeId: 'r_dagger', materials: ['iron', 'astral_silk', 'titan_bone', 'flame_shard'] }, 0);
  const plain = buildCrafted({ recipeId: 'r_dagger', materials: ['iron', 'timber', null, 'flame_shard'] }, 0);
  expect(a.secondaryId).toBe('titan_bone');
  expect(a.secondary2Id).toBe('astral_silk');
  expect(itemStats(a)).toEqual(itemStats(b));
  expect(itemStats(a).attack - itemStats(plain).attack).toBe(20);
  expect(itemStats(a).stamina - itemStats(plain).stamina).toBe(30);
  expect(itemStats(a).fire).toBe(itemStats(plain).fire);
  expect(itemStats(a).fire).toBeGreaterThan(0);
});

it('allows omitting the second slot, without charging for or creating a phantom material', () => {
  const stash = stocked();
  const item = craft({ recipeId: 'r_dagger', materials: ['iron', 'linen', null, null] }, stash, createRng(1), 0)!;
  expect(item).not.toBeNull();
  expect(item.secondary2Id).toBeUndefined();
  expect(countOf(stash, 'material', 'iron')).toBe(28);
  expect(countOf(stash, 'material', 'linen')).toBe(29);
  expect(countOf(stash, 'material', 'bone')).toBe(30);
});

it('aggregates repeated selections across primary and both secondary slots before consuming anything', () => {
  const stash = createContainer();
  addItem(stash, makeMaterial('iron', 3));
  const sel = { recipeId: 'r_dagger', materials: ['iron', 'iron', 'iron', null] };
  expect(selectionError(sel, stash)).toMatch(/3\/4/);
  expect(craft(sel, stash, createRng(1), 0)).toBeNull();
  expect(countOf(stash, 'material', 'iron')).toBe(3);
  addItem(stash, makeMaterial('iron', 1));
  const item = craft(sel, stash, createRng(1), 0)!;
  expect(itemStats(item).defense).toBe(6);
  expect(countOf(stash, 'material', 'iron')).toBe(0);
});

it('charges the first slot recipe quantity and one unit for the extra slot', () => {
  const stash = stocked();
  const item = craft({ recipeId: 'r_halberd', materials: ['iron', 'linen', 'bone', 'jade'] }, stash, createRng(1), 0)!;
  expect(item).not.toBeNull();
  expect(countOf(stash, 'material', 'iron')).toBe(26);
  expect(countOf(stash, 'material', 'linen')).toBe(26);
  expect(countOf(stash, 'material', 'bone')).toBe(29);
  expect(countOf(stash, 'material', 'jade')).toBe(29);
});

it('retains the mandatory pendant stone separately from its two secondary materials', () => {
  const stash = stocked();
  expect(selectionError({ recipeId: 'r_pendant', materials: ['iron', 'linen', 'bone', null] }, stash)).toMatch(/Stone/);
  const item = craft({ recipeId: 'r_pendant', materials: ['iron', 'linen', 'bone', 'jade'] }, stash, createRng(1), 0)!;
  expect(item.ref).toBe('pendant');
  expect(item.affixes?.some(a => a.id === 'vital')).toBe(true);
});

it('round-trips both materials and keeps older one-secondary gear unchanged', () => {
  const s = newGame(createRng(1));
  const modern = buildCrafted({ recipeId: 'r_club', materials: ['timber', 'moonsilver', 'shadow_silk', null] }, 0);
  const old = makeEquipment({ baseId: 'dagger', materialId: 'iron', secondaryId: 'linen', rarity: Rarity.Common, ilvl: 4, crafted: true });
  addItem(s.stash, modern);
  addItem(s.stash, old);
  const loaded = parseSave(serializeSave(s))!;
  for (const item of [modern, old]) {
    const saved = loaded.stash.items.find(i => i.uid === item.uid)!;
    expect(saved.secondaryId).toBe(item.secondaryId);
    expect(saved.secondary2Id).toBe(item.secondary2Id);
    expect(itemStats(saved)).toEqual(itemStats(item));
  }
  const legacy = JSON.parse(serializeSave(s));
  legacy.revision = 19;
  legacy.stash.items = [old];
  const migrated = parseSave(JSON.stringify(legacy))!;
  expect(migrated.revision).toBe(21);
  expect(migrated.stash.items[0].secondary2Id).toBeUndefined();
  expect(itemStats(migrated.stash.items[0])).toEqual(itemStats(old));
});

it('salvages each selected secondary independently, including repeated materials', () => {
  const item = buildCrafted({ recipeId: 'r_dagger', materials: ['iron', 'linen', 'linen', null] }, 0);
  const rng = { ...createRng(1), chance: () => true };
  const returned = salvage(item, rng);
  expect(returned.filter(i => i.ref === 'linen').reduce((sum, i) => sum + i.qty, 0)).toBe(2);
});
