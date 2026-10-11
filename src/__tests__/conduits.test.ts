import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { Rarity } from '../types';
import { CHILL_WINDUP, CONDUIT_SPELLS, WEAVE_REGROW } from '../data/conduit-spells';
import { itemBase } from '../data/items';
import { enemyDef, enemyView } from '../data/enemies';
import { SAVE_VERSION, newGame } from '../state/game-state';
import { parseSave } from '../state/save-format';
import { SAVE_REVISION } from '../state/migrations';
import { addItem } from '../state/inventory';
import { learnTome, loadedSpells, makeTome, toggleLoaded, unknownConduitSpells } from '../systems/conduits';
import { makeEquipment } from '../systems/items';
import { derivePlayer } from '../systems/player';
import { startRun } from '../systems/run';
import { createEnemy, FLOOR } from '../systems/dungeon';
import { World, tomeChance } from '../world/world';

const conduit = (baseId: 'wand' | 'rod', materialId = baseId === 'wand' ? 'ironwood' : 'iron') =>
  makeEquipment({ baseId, materialId, rarity: Rarity.Common, ilvl: 4, quality: 1, identified: true });

/** A cleared room, a wand in the offhand, both starter-era spells known and loaded. */
function battlemage(baseId: 'wand' | 'rod' = 'wand'): World {
  const state = newGame(createRng(91));
  state.equipment.offhand = conduit(baseId);
  state.spellbook = ['ember_bolt', 'rime_lance'];
  state.loadedSpells = ['ember_bolt', 'rime_lance'];
  startRun(state, 91);
  const w = new World(state);
  w.floor.enemies = [];
  w.floor.traps = [];
  const x = 10, y = 10;
  Object.assign(w.player, { x, y, facing: 0 });
  for (let yy = y - 7; yy <= y + 7; yy++) for (let xx = x - 7; xx <= x + 7; xx++) w.floor.tiles[yy * w.floor.width + xx] = FLOOR;
  w.floor.doors = w.floor.doors.filter((d) => Math.abs(d.x - x) + Math.abs(d.y - y) > 8);
  w.floor.stairs = w.floor.stairs.filter((s) => Math.abs(s.x - x) + Math.abs(s.y - y) > 8);
  w.floor.props = w.floor.props.filter((p) => Math.abs(p.x - x) + Math.abs(p.y - y) > 8);
  return w;
}

/** A sturdy target `dist` tiles in front, never acting on its own. */
function target(w: World, dist: number, def = 'ghoul') {
  const t = w.frontTile(dist);
  const e = createEnemy(enemyDef(def), t.x, t.y, 2, 'target', 1);
  e.hp = e.maxHp = 400;
  e.attackCd = 999;
  w.floor.enemies.push(e);
  return e;
}

function run(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

describe('conduits', () => {
  it('keep their Power out of your melee Attack and guard worse than a shield', () => {
    const state = newGame(createRng(90));
    const bare = derivePlayer({ ...state.equipment, offhand: null }, state.meta);
    const wand = derivePlayer({ ...state.equipment, offhand: conduit('wand') }, state.meta);
    expect(wand.attack).toBe(bare.attack);
    expect(wand.conduitPower).toBeGreaterThan(0);
    expect(wand.hasShield).toBe(false);
    expect(wand.block).toBeCloseTo(0.3);
    expect(wand.conduit?.slots).toBe(2);
  });

  it('make the Rod better than the Wand on every axis', () => {
    const wand = itemBase('wand'), rod = itemBase('rod');
    const state = newGame(createRng(90));
    const w = derivePlayer({ ...state.equipment, offhand: conduit('wand', 'ironwood') }, state.meta);
    const r = derivePlayer({ ...state.equipment, offhand: conduit('rod', 'iron') }, state.meta);
    expect(r.conduitPower).toBeGreaterThan(w.conduitPower);
    expect(r.block).toBeGreaterThan(w.block);
    expect(r.stats.defense).toBeGreaterThan(w.stats.defense);
    expect(rod.conduit!.charges).toBeGreaterThan(wand.conduit!.charges);
    expect(rod.conduit!.slots).toBeGreaterThan(wand.conduit!.slots);
    expect(rod.conduit!.regrow).toBeLessThan(wand.conduit!.regrow);
  });
});

describe('the spellbook', () => {
  it('learns from tomes, never offers a known or carried spell, and loads in order', () => {
    const state = newGame(createRng(92));
    expect(state.spellbook).toEqual(['ember_bolt']);
    expect(unknownConduitSpells(state.spellbook)).toEqual(['rime_lance']);
    expect(unknownConduitSpells(state.spellbook, ['rime_lance'])).toEqual([]);
    const tome = makeTome('rime_lance');
    addItem(state.stash, tome);
    expect(learnTome(state, state.stash, tome.uid)).toBe(true);
    expect(state.spellbook).toContain('rime_lance');
    expect(toggleLoaded(state, 'rime_lance')).toBe(true);
    expect(loadedSpells(state, 3)).toEqual(['ember_bolt', 'rime_lance']);
    // A Wand-sized conduit reads only as far as its slots.
    expect(loadedSpells(state, 1)).toEqual(['ember_bolt']);
  });

  it('locks the loadout on a delve unless a portal is open', () => {
    const state = newGame(createRng(93));
    state.spellbook.push('rime_lance');
    startRun(state, 93);
    expect(toggleLoaded(state, 'rime_lance')).toBe(false);
    state.run!.portal = { depth: 1, x: 1, y: 1 };
    expect(toggleLoaded(state, 'rime_lance')).toBe(true);
  });

  it('migrates an older save: Ember Bolt known and loaded, the Wand recipe learned', () => {
    const state = newGame(createRng(94)) as any;
    state.revision = 29;
    delete state.spellbook;
    delete state.loadedSpells;
    delete state.recipeRanks.r_wand;
    const loaded = parseSave(JSON.stringify(state))!;
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.revision).toBe(SAVE_REVISION);
    expect(loaded.spellbook).toEqual(['ember_bolt']);
    expect(loaded.loadedSpells).toEqual(['ember_bolt']);
    expect(loaded.recipeRanks.r_wand).toBe(1);
  });

  it('rolls tomes mostly from vaults and secret rooms, and never on depth 1 from a plain chest', () => {
    expect(tomeChance('chest', 1)).toBe(0);
    expect(tomeChance('chest', 5)).toBeGreaterThan(0);
    expect(tomeChance('vault', 1)).toBeGreaterThan(tomeChance('chest', 5));
  });
});

describe('casting', () => {
  it('spends a charge and stamina, flies, and lands as the spell element', () => {
    const w = battlemage();
    const e = target(w, 3);
    const charges = w.run.conduit!.charges;
    const stamina = w.player.stamina;
    expect(w.castSpell()).toBe(true);
    expect(w.run.conduit!.charges).toBe(charges - 1);
    expect(w.player.stamina).toBeLessThan(stamina);
    run(w, 1);
    expect(e.hp).toBeLessThan(400);
  });

  it('Ember Bolt keeps burning after it lands', () => {
    const w = battlemage();
    const e = target(w, 2);
    w.castSpell();
    run(w, 0.5);
    expect(e.burn).toBeDefined();
    const after = e.hp;
    run(w, 3.5);
    expect(e.hp).toBeLessThan(after);
    expect(e.burn).toBeUndefined();
  });

  it('Rime Lance stretches the next wind-up, but not the King\'s', () => {
    const w = battlemage();
    w.nextSpell();
    expect(w.selectedSpell()?.id).toBe('rime_lance');
    const e = target(w, 2);
    w.castSpell();
    run(w, 0.5);
    expect(e.chillT).toBeGreaterThan(0);
    const plain = enemyView(enemyDef('ghoul'), e.hp, e.maxHp);
    const chilled = enemyView(enemyDef('ghoul'), e.hp, e.maxHp, { chilled: true });
    expect(chilled.windup).toBeCloseTo(plain.windup * CHILL_WINDUP);
    const king = enemyDef('ashen_king');
    expect(enemyView(king, king.hp, king.hp, { chilled: true }).windup).toBe(enemyView(king, king.hp, king.hp).windup);
  });

  it('refuses with an empty conduit, and the charge grows back', () => {
    const w = battlemage();
    const cast = (): boolean => {
      w.player.stamina = w.derived.maxStamina;
      const ok = w.castSpell();
      run(w, 0.7);
      return ok;
    };
    const max = w.derived.conduit!.charges;
    for (let i = 0; i < max; i++) expect(cast()).toBe(true);
    expect(cast()).toBe(false);
    run(w, w.derived.conduit!.regrow);
    expect(w.run.conduit!.charges).toBeGreaterThanOrEqual(1);
  });

  it('weaves: a landed spell charges the next blow, and a landed blow hurries the regrow', () => {
    const w = battlemage();
    const e = target(w, 1);
    w.castSpell();
    run(w, 0.6);
    expect(w.anim.weave?.element).toBe('fire');
    w.run.conduit!.regrow = 0;
    w.player.stamina = w.derived.maxStamina;
    w.attack();
    run(w, 0.3);
    expect(w.anim.weave).toBeNull();
    expect(w.run.conduit!.regrow).toBeGreaterThanOrEqual(WEAVE_REGROW - 0.01);
    expect(e.hp).toBeLessThan(400);
  });

  it('cycles through what is loaded, and only that', () => {
    const w = battlemage();
    expect(w.conduitSpells().map((s) => s.id)).toEqual(['ember_bolt', 'rime_lance']);
    w.nextSpell();
    w.nextSpell();
    expect(w.selectedSpell()?.id).toBe('ember_bolt');
    expect(CONDUIT_SPELLS.length).toBeGreaterThanOrEqual(2);
  });

  it('does not refill the pool by taking the conduit off and on', () => {
    const w = battlemage();
    w.castSpell();
    run(w, 0.7);
    const left = w.run.conduit!.charges;
    const wand = w.state.equipment.offhand;
    w.state.equipment.offhand = null;
    w.refreshDerived();
    w.state.equipment.offhand = wand;
    w.refreshDerived();
    expect(w.run.conduit!.charges).toBe(left);
  });
});
