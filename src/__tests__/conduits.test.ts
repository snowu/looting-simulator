import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { Rarity } from '../types';
import { CHILL_WINDUP, CONDUIT_SPELLS, HEX_SECONDS, WEAVE_REGROW } from '../data/conduit-spells';
import { itemBase } from '../data/items';
import { PENGUIN_SPRITE, enemyDef, enemyView } from '../data/enemies';
import { SAVE_VERSION, newGame } from '../state/game-state';
import { parseSave } from '../state/save-format';
import { SAVE_REVISION } from '../state/migrations';
import { addItem } from '../state/inventory';
import { learnTome, loadedSpells, makeTome, toggleLoaded, unknownConduitSpells } from '../systems/conduits';
import { makeEquipment, makeUnique } from '../systems/items';
import { findUnique } from '../data/uniques';
import { COUNTERCHARM_CHARGES } from '../data/properties';
import { derivePlayer } from '../systems/player';
import { startRun } from '../systems/run';
import { createEnemy, FLOOR, WALL } from '../systems/dungeon';
import { World, tomeChance } from '../world/world';

const conduit = (baseId: 'wand' | 'rod', materialId = baseId === 'wand' ? 'ironwood' : 'iron') =>
  makeEquipment({ baseId, materialId, rarity: Rarity.Common, ilvl: 4, quality: 1, identified: true });

/** A cleared room, a wand in the offhand, both starter-era spells known and loaded. */
function battlemage(baseId: 'wand' | 'rod' = 'wand', spells = ['ember_bolt', 'rime_lance']): World {
  const state = newGame(createRng(91));
  state.equipment.offhand = conduit(baseId);
  state.spellbook = [...spells];
  state.loadedSpells = [...spells];
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
    expect(unknownConduitSpells(state.spellbook)).toEqual(['rime_lance', 'smite', 'hex']);
    expect(unknownConduitSpells(state.spellbook, ['rime_lance', 'hex'])).toEqual(['smite']);
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

describe('Smite', () => {
  it('lands at once on the first monster in your line, with no bolt', () => {
    const w = battlemage('rod', ['smite']);
    const near = target(w, 3, 'goblin');
    const far = target(w, 4);
    w.castSpell();
    run(w, w.selectedSpell()!.windup + 0.02);
    expect(w.projectiles.filter((p) => p.spell)).toHaveLength(0);
    expect(near.hp).toBeLessThan(400);
    expect(far.hp).toBe(400);
    expect(w.spellFx.some((fx) => fx.kind === 'smite' && fx.x === near.x && fx.y === near.y)).toBe(true);
  });

  it('is stopped by a wall, and reaches no further than its range', () => {
    const w = battlemage('rod', ['smite']);
    const wall = w.frontTile(2);
    w.floor.tiles[wall.y * w.floor.width + wall.x] = WALL;
    const behind = target(w, 3);
    w.castSpell();
    run(w, 0.5);
    expect(behind.hp).toBe(400);
    const w2 = battlemage('rod', ['smite']);
    const beyond = target(w2, 6);
    // Held where it stands, so it cannot walk into range.
    beyond.ai = 'recover';
    beyond.timer = 99;
    w2.castSpell();
    run(w2, 0.5);
    expect(beyond.hp).toBe(400);
  });

  it('hits the undead harder, and what it kills stays down', () => {
    const w = battlemage('rod', ['smite']);
    const ghoul = target(w, 2);
    w.castSpell();
    run(w, 0.5);
    const dealt = 400 - ghoul.hp;
    const w2 = battlemage('rod', ['smite']);
    const goblin = target(w2, 2, 'goblin');
    w2.castSpell();
    run(w2, 0.5);
    expect(dealt).toBeGreaterThan(400 - goblin.hp);

    const w3 = battlemage('rod', ['smite']);
    const weak = target(w3, 2);
    weak.hp = 1;
    w3.castSpell();
    run(w3, 0.5);
    expect(weak.ai).toBe('dead');
    expect(weak.remains).toBe('sanctified');
  });
});

describe('Hex', () => {
  function hexed(def = 'ghoul') {
    const w = battlemage('rod', ['hex']);
    const e = target(w, 1, def);
    e.attackCd = 0;
    e.alert = 6;
    w.player.stamina = w.derived.maxStamina;
    const charges = w.run.conduit!.charges;
    expect(w.castSpell()).toBe(true);
    expect(w.run.conduit!.charges).toBe(charges - 2);
    run(w, w.selectedSpell()!.windup + 0.02);
    return { w, e };
  }

  it('costs two charges and makes a penguin of it, health and all', () => {
    const { w, e } = hexed();
    expect(e.hexT).toBeGreaterThan(HEX_SECONDS - 0.2);
    expect(e.hp).toBe(400);
    const view = enemyView(enemyDef(e.def), e.hp, e.maxHp, { hexed: true });
    expect(view.sprite).toBe(PENGUIN_SPRITE);
    expect(view.shield).toBeUndefined();
    expect(w.anim.weave?.element).toBe('shadow');
  });

  it('cannot fight back, and hitting it does not break the spell', () => {
    const { w, e } = hexed();
    const hp = w.player.hp;
    run(w, 4);
    expect(w.player.hp).toBe(hp);
    expect(e.ai).not.toBe('windup');
    // Whatever hurts it goes through `hurt`; none of it turns it back.
    (w as unknown as { hurt(e: unknown, n: number, text: string, color: string): void }).hurt(e, 50, '50', '#fff');
    run(w, 0.2);
    expect(e.hp).toBeLessThan(400);
    expect(e.hexT).toBeGreaterThan(0);
  });

  it('wears off after fifteen seconds, and it is itself again', () => {
    const { w, e } = hexed();
    run(w, HEX_SECONDS + 0.2);
    expect(e.hexT).toBeUndefined();
    expect(enemyView(enemyDef(e.def), e.hp, e.maxHp, { hexed: (e.hexT ?? 0) > 0 }).sprite).not.toBe(PENGUIN_SPRITE);
  });

  it('works on an elite', () => {
    const w = battlemage('rod', ['hex']);
    const e = target(w, 2);
    e.elite = 'ironhide';
    w.castSpell();
    run(w, 0.5);
    expect(e.hexT).toBeGreaterThan(0);
  });

  it('is refused by the King, and the charges come back', () => {
    const w = battlemage('rod', ['hex']);
    const king = target(w, 2, 'ashen_king');
    const charges = w.run.conduit!.charges;
    w.castSpell();
    run(w, 0.5);
    expect(king.hexT).toBeUndefined();
    expect(w.run.conduit!.charges).toBe(charges);
  });

  it('dies as itself', () => {
    const { w, e } = hexed();
    e.hp = 1;
    w.player.stamina = w.derived.maxStamina;
    w.attack();
    run(w, 1);
    if (e.ai === 'dead') expect(e.hexT).toBeUndefined();
  });
});

describe('the Stave', () => {
  const stave = (materialId = 'ironwood') =>
    makeEquipment({ baseId: 'stave', materialId, rarity: Rarity.Common, ilvl: 4, quality: 1, identified: true });

  it('is a two-handed weapon and a conduit at once', () => {
    const state = newGame(createRng(95));
    const d = derivePlayer({ ...state.equipment, weapon: stave(), offhand: null }, state.meta);
    expect(d.twoHanded).toBe(true);
    expect(d.conduitHand).toBe('weapon');
    expect(d.conduit?.slots).toBe(4);
    expect(d.block).toBeCloseTo(0.2);
    expect(d.attack).toBeGreaterThan(0);
    // Only part of its Attack reaches a spell, and the rest is still a blow.
    expect(d.conduitPower).toBe(Math.round(d.attack * itemBase('stave').conduit!.power!));
  });

  it('holds more and grows back faster than a Rod, and casts harder', () => {
    const state = newGame(createRng(95));
    const r = derivePlayer({ ...state.equipment, offhand: conduit('rod', 'iron') }, state.meta);
    const s = derivePlayer({ ...state.equipment, weapon: stave('ironwood'), offhand: null }, state.meta);
    const rod = itemBase('rod').conduit!, st = itemBase('stave').conduit!;
    expect(st.slots).toBeGreaterThan(rod.slots);
    expect(st.charges).toBeGreaterThan(rod.charges);
    expect(st.regrow).toBeLessThan(rod.regrow);
    expect(s.conduitPower).toBeGreaterThan(r.conduitPower);
  });

  it('casts from the weapon hand', () => {
    const state = newGame(createRng(96));
    state.equipment.weapon = stave();
    state.equipment.offhand = null;
    startRun(state, 96);
    const w = new World(state);
    w.floor.enemies = [];
    expect(w.derived.conduit).not.toBeNull();
    expect(w.run.conduit?.charges).toBe(5);
    expect(w.castSpell()).toBe(true);
    expect(w.anim.attackWeaponUid).toBe(state.equipment.weapon!.uid);
  });
});

describe('battlemage payoffs', () => {
  type Priv = { parryFlourish(x: number, y: number): void; hurt(e: unknown, dealt: number, text: string, color: string): void };
  const priv = (w: World) => w as unknown as Priv;

  it('Countercharm: a parry puts a charge back, never past full', () => {
    const w = battlemage('rod');
    w.state.equipment.offhand!.property = 'countercharm';
    w.refreshDerived();
    w.run.conduit!.charges = 1;
    priv(w).parryFlourish(w.player.x, w.player.y - 1);
    expect(w.run.conduit!.charges).toBe(1 + COUNTERCHARM_CHARGES);
    w.run.conduit!.charges = w.derived.conduit!.charges;
    priv(w).parryFlourish(w.player.x, w.player.y - 1);
    expect(w.run.conduit!.charges).toBe(w.derived.conduit!.charges);
  });

  it('Countercharm does nothing on gear it was not made for', () => {
    const w = battlemage('rod');
    w.state.equipment.body = makeEquipment({ baseId: 'jerkin', materialId: 'leather', rarity: Rarity.Common, ilvl: 2, identified: true });
    w.state.equipment.body.property = 'countercharm';
    w.refreshDerived();
    expect(w.derived.traits.countercharm).toBe(false);
  });

  it('Requiem: a spell that kills gives its charges back; one that does not, does not', () => {
    const w = battlemage('rod', ['ember_bolt']);
    w.state.equipment.hands = makeEquipment({ baseId: 'gloves', materialId: 'leather', rarity: Rarity.Common, ilvl: 2, identified: true });
    w.state.equipment.hands.property = 'requiem';
    w.refreshDerived();
    const full = w.run.conduit!.charges;
    const sturdy = target(w, 2);
    expect(w.castSpell()).toBe(true);
    run(w, 1);
    expect(sturdy.hp).toBeLessThan(400);
    expect(w.run.conduit!.charges).toBe(full - 1);
    sturdy.hp = 1;
    sturdy.burn = undefined;
    w.player.stamina = w.derived.maxStamina;
    expect(w.castSpell()).toBe(true);
    run(w, 1);
    expect(sturdy.ai).toBe('dead');
    expect(w.run.conduit!.charges).toBe(full - 1);
  });

  it("Dr. Mantis Toboggan's Rod casts on credit, in health, but never the last point", () => {
    const state = newGame(createRng(97));
    const rod = makeUnique(findUnique('mantis_toboggan')!, createRng(97), 5, true);
    state.equipment.offhand = rod;
    state.spellbook = ['ember_bolt', 'hex'];
    state.loadedSpells = ['hex'];
    startRun(state, 97);
    const w = new World(state);
    w.floor.enemies = [];
    expect(w.derived.traits.bloodCast).toBeCloseTo(0.1);
    w.run.conduit!.charges = 1;
    const hp = w.player.hp = w.derived.maxHp;
    expect(w.spellReady()).toBe(true);
    expect(w.castSpell()).toBe(true);
    // One charge short of Hex's two: 10% of max health.
    expect(w.player.hp).toBe(hp - Math.round(0.1 * w.derived.maxHp));
    expect(w.run.conduit!.charges).toBe(0);
    run(w, 1);
    w.player.stamina = w.derived.maxStamina;
    w.player.hp = Math.round(0.2 * w.derived.maxHp);
    expect(w.spellReady()).toBe(false);
    expect(w.castSpell()).toBe(false);
    expect(w.player.hp).toBe(Math.round(0.2 * w.derived.maxHp));
  });

  it('an ordinary conduit still refuses a cast it cannot pay for', () => {
    const w = battlemage('rod');
    w.run.conduit!.charges = 0;
    expect(w.spellReady()).toBe(false);
    expect(w.castSpell()).toBe(false);
  });
});
