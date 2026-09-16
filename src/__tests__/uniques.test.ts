import { describe, it, expect } from 'vitest';
import { createRng } from '../core/rng';
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { newGame } from '../state/game-state';
import { migrateSave, SAVE_REVISION } from '../state/migrations';
import { startRun } from '../systems/run';
import { World, STAMINA_REGEN } from '../world/world';
import { EnemyState, FLOOR, createEnemy } from '../systems/dungeon';
import { enemyDef, BOSS_ID } from '../data/enemies';
import { itemBase } from '../data/items';
import { consumable } from '../data/items';
import { material } from '../data/materials';
import { UNIQUES, findUnique } from '../data/uniques';
import { RELIC_ORDER, findRelic, forgetRelic, isFound, relicProgress } from '../systems/relics';
import { derivePlayer, emptyEquipment } from '../systems/player';
import {
  durability,
  itemName,
  itemStats,
  itemValue,
  makeEquipment,
  makeUnique,
  rollEnemyLoot,
  rollEquipment,
  uniqueOf,
  wearItem,
} from '../systems/items';
import { Item, Rarity } from '../types';
import { BASE_LIGHT_RADIUS } from '../systems/meta';
import { addItem } from '../state/inventory';
import { makeConsumable } from '../systems/items';

function tick(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

function arena(seed = 1): World {
  const state = newGame(createRng(seed));
  startRun(state, seed);
  const w = new World(state);
  const f = w.floor;
  f.enemies = [];
  f.traps = [];
  f.props = f.props.filter((p) => !p.blocking);
  const free = (x: number, y: number) =>
    f.tiles[y * f.width + x] === FLOOR && !f.doors.some((d) => d.x === x && d.y === y) && !f.stairs.some((s) => s.x === x && s.y === y);
  for (let y = 2; y < f.height - 6; y++) for (let x = 2; x < f.width - 6; x++) {
    for (const d of DIRS) {
      let ok = free(x, y) && free(x - DX[d], y - DY[d]);
      for (let k = 1; k <= 5 && ok; k++) ok = free(x + DX[d] * k, y + DY[d] * k);
      if (ok) {
        Object.assign(w.player, { x, y, facing: d });
        Object.assign(w.anim, { fromX: x, fromY: y, yaw: (d * Math.PI) / 2, yawTo: (d * Math.PI) / 2 });
        return w;
      }
    }
  }
  throw new Error('no arena');
}

function spawn(w: World, id: string, dist: number): EnemyState {
  const t = w.frontTile(dist);
  const e = createEnemy(enemyDef(id), t.x, t.y, turnAround(w.player.facing), `e${id}${dist}`, 1);
  w.floor.enemies.push(e);
  return e;
}

function windUp(w: World, e: EnemyState): void {
  e.ai = 'windup';
  e.timer = 0.12;
  e.alert = 6;
  e.lastSeenX = w.player.x;
  e.lastSeenY = w.player.y;
}

/** Put one relic on the player and re-derive, the way equipping does. */
function wearRelic(w: World, uniqueId: string): Item {
  const def = findUnique(uniqueId)!;
  const item = makeUnique(def, createRng(7), 6, true);
  const slot = itemBase(def.baseId).slot;
  w.state.equipment[slot === 'ring' ? 'ring1' : slot] = item;
  w.refreshDerived();
  return item;
}

describe('unique definitions', () => {
  it('every relic is a real base in a material that base accepts', () => {
    for (const u of UNIQUES) {
      expect(u.rule.length, `${u.id} rule`).toBeGreaterThan(0);
      expect(u.detail.length, `${u.id} detail`).toBeGreaterThan(0);
      expect(u.detail, `${u.id} registers differ`).not.toBe(u.rule);
      // The plain words are the ones a reader meets first: keep them short.
      expect(u.rule.length, `${u.id} rule stays terse`).toBeLessThan(130);
      expect(u.flavour.length, `${u.id} flavour`).toBeGreaterThan(0);
      if (u.kind === 'tonic') {
        const c = consumable(u.baseId);
        expect(c.rarity, `${u.id} rarity`).toBe(Rarity.Legendary);
        expect(c.effect.type, `${u.id} effect`).toBe('tonic');
        continue;
      }
      const base = itemBase(u.baseId);
      const mat = material(u.materialId!);
      expect(base.primary, `${u.id} material category`).toContain(mat.category);
    }
  });

  it('never rolls a tonic as a piece of gear', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const it = rollEquipment(createRng(seed), 6, 0, { rarity: Rarity.Legendary });
      expect(uniqueOf(it)!.kind, `seed ${seed}`).toBe('gear');
    }
  });

  it('ids are unique and every one is reachable at depth 6', () => {
    expect(new Set(UNIQUES.map((u) => u.id)).size).toBe(UNIQUES.length);
    expect(UNIQUES.every((u) => u.minDepth <= 6)).toBe(true);
  });
});

describe('a Legendary roll becomes a relic', () => {
  it('diverts into a unique rather than a four-affix Rare', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const it = rollEquipment(createRng(seed), 6, 0, { rarity: Rarity.Legendary });
      expect(uniqueOf(it), `seed ${seed}`).not.toBeNull();
      // Two ordinary affixes for texture, never the Legendary's four.
      expect(it.affixes!.length).toBeLessThanOrEqual(2);
    }
  });

  it('leaves a caller that asked for a specific base alone', () => {
    const it = rollEquipment(createRng(3), 6, 0, { rarity: Rarity.Legendary, baseId: 'war_axe' });
    expect(it.ref).toBe('war_axe');
    expect(it.uniqueId).toBeUndefined();
  });

  it('is worth appreciably more than the same base rolled ordinarily', () => {
    const def = findUnique('ordinary_sword')!;
    const relic = makeUnique(def, createRng(5), 6, true);
    const plain = makeEquipment({
      baseId: def.baseId, materialId: def.materialId!, rarity: Rarity.Legendary,
      ilvl: relic.ilvl!, quality: relic.quality, affixes: relic.affixes,
    });
    expect(itemValue(relic)).toBeGreaterThan(itemValue(plain));
  });
});

describe('the Ashen King always gives up a new one', () => {
  it('drops a relic the playthrough has not held', () => {
    const seen = UNIQUES.slice(0, UNIQUES.length - 1).map((u) => u.id);
    const last = UNIQUES[UNIQUES.length - 1].id;
    for (let seed = 1; seed <= 10; seed++) {
      const loot = rollEnemyLoot(createRng(seed), enemyDef(BOSS_ID), 6, 0, undefined, {}, {}, seen);
      const relics = loot.items.map(uniqueOf).filter(Boolean);
      expect(relics.length, `seed ${seed}`).toBeGreaterThan(0);
      expect(relics[0]!.id, `seed ${seed}`).toBe(last);
    }
  });

  it('still drops one once the whole set has been found', () => {
    const seen = UNIQUES.map((u) => u.id);
    const loot = rollEnemyLoot(createRng(4), enemyDef(BOSS_ID), 6, 0, undefined, {}, {}, seen);
    expect(loot.items.some((i) => uniqueOf(i))).toBe(true);
  });

  it('does not count a relic left lying on the floor', () => {
    const w = arena(9);
    const e = spawn(w, BOSS_ID, 1);
    e.hp = 1;
    // At one hit left he is in his last phase, which carries a guard — and this
    // test is about who gets credit for the relic, not about getting through it.
    e.guard = 'down';
    e.guardT = 99;
    w.player.stamina = w.derived.maxStamina;
    w.attack();
    tick(w, 1.5);
    // It dropped, but nobody picked it up. Dying here should cost you the find.
    expect(w.state.lifetime.uniquesSeen).toEqual([]);
    const pk = w.floor.pickups.find((p) => p.items.some((i) => uniqueOf(i)))!;
    expect(pk, 'the King dropped a relic').toBeTruthy();
    w.take(pk.id);
    expect(w.state.lifetime.uniquesSeen!.length).toBe(1);
  });
});

describe('naming and identification', () => {
  it('wears its own name once identified, and hides behind the material before', () => {
    const def = findUnique('implication')!;
    const known = makeUnique(def, createRng(1), 6, true);
    const unknown = makeUnique(def, createRng(1), 6, false);
    expect(itemName(known)).toBe('The Implication');
    expect(itemName(unknown)).toContain('Unidentified');
    expect(itemName(unknown)).not.toContain('Implication');
  });

  it('withholds its bespoke stats until it is identified', () => {
    const def = findUnique('ordinary_sword')!;
    const known = makeUnique(def, createRng(2), 6, true);
    const unknown = makeUnique(def, createRng(2), 6, false);
    expect(itemStats(known).attack).toBeGreaterThan(itemStats(unknown).attack);
  });
});

describe('the effects', () => {
  it('An Entirely Ordinary Sword sits outside the durability system', () => {
    const sword = makeUnique(findUnique('ordinary_sword')!, createRng(1), 6, true);
    expect(durability(sword).wears).toBe(false);
    expect(wearItem(sword, 50)).toBe('none');
    expect(sword.dur).toBeUndefined();
  });

  it('an unidentified relic grants no effect at all', () => {
    const eq = emptyEquipment();
    eq.hands = makeUnique(findUnique('kitten_mittens')!, createRng(1), 6, false);
    expect(derivePlayer(eq, {}).traits.unseen).toBe(0);
    eq.hands.identified = true;
    expect(derivePlayer(eq, {}).traits.unseen).toBeGreaterThan(0);
  });

  it("Bergholt's Bright Error carries light and barely blocks", () => {
    const eq = emptyEquipment();
    const bare = derivePlayer(eq, {});
    eq.offhand = makeUnique(findUnique('bright_error')!, createRng(1), 6, true);
    const lit = derivePlayer(eq, {});
    expect(lit.traits.light).toBeGreaterThan(0);
    // A real buckler absorbs 35-45%; this stops next to nothing, as advertised.
    expect(lit.block).toBeLessThan(0.15);
    expect(lit.block).toBeGreaterThanOrEqual(0);
    expect(bare.traits.light).toBe(0);
  });

  it('Charlie Work reads the floor two tiles further ahead', () => {
    // A World reads the floor for traps as it is built, so the same state read
    // twice — once bare, once wearing the ring — is the honest comparison.
    const spotsAt = (dist: number, relic: string | null): boolean => {
      const w = arena(3);
      if (relic) wearRelic(w, relic);
      const t = w.frontTile(dist);
      w.floor.traps = [{ id: 'tt', kind: 'dart', x: t.x, y: t.y, armed: true, found: false, dir: w.player.facing }];
      return new World(w.state).floor.traps[0].found;
    };
    expect(spotsAt(2, null)).toBe(true);
    expect(spotsAt(3, null)).toBe(false);
    expect(spotsAt(3, 'charlie_work')).toBe(true);
    expect(spotsAt(4, 'charlie_work')).toBe(true);
  });

  it('Kitten Mittens take tiles off what the floor can see', () => {
    const w = arena(3);
    wearRelic(w, 'kitten_mittens');
    expect(w.derived.traits.unseen).toBe(2);
  });

  it('Champion of the Sun only favours the dead', () => {
    const eq = emptyEquipment();
    eq.weapon = makeUnique(findUnique('champion_of_the_sun')!, createRng(1), 6, true);
    expect(derivePlayer(eq, {}).traits.undeadBane).toBeGreaterThan(1);
    expect(enemyDef('skeleton').undead).toBe(true);
  });

  it('Eulogy Plate halves what a draught gives back', () => {
    const drink = (relic: string | null): { healed: number; full: number } => {
      const w = arena(5);
      if (relic) wearRelic(w, relic);
      const potion = makeConsumable('healing_draught');
      addItem(w.run.backpack, potion);
      // Read the fraction off the data rather than restating it: this test is
      // about the relic halving a draught, not about how big a draught is.
      const effect = consumable('healing_draught').effect;
      const fraction = effect.type === 'heal' ? effect.fraction : 0;
      const full = Math.round(w.derived.maxHp * fraction);
      w.player.hp = 1;
      w.use(potion.uid);
      return { healed: w.player.hp - 1, full };
    };
    const bare = drink(null);
    expect(bare.healed).toBe(bare.full);
    const plated = drink('eulogy_plate');
    expect(plated.healed).toBe(Math.round(plated.full * 0.5));
  });

  it('The Implication banks parries and loses them to an unblocked hit', () => {
    const w = arena(2);
    wearRelic(w, 'implication');
    const e = spawn(w, 'skeleton', 1);
    windUp(w, e);
    w.setBlock(true);
    tick(w, 0.2);
    expect(w.anim.parryStacks).toBeGreaterThan(0);
    // Now take one on the chin: the guard comes down and the blow lands.
    // Wait out the post-parry immunity first — since parries started covering
    // stacked attacks, a swing thrown straight after one is denied, not taken.
    w.setBlock(false);
    tick(w, 1);
    e.vuln = 0;
    e.attackCd = 0;
    windUp(w, e);
    tick(w, 0.6);
    expect(w.player.hp).toBeLessThan(w.derived.maxHp);
    expect(w.anim.parryStacks).toBe(0);
  });

  it('a banked parry makes the next blow land harder', () => {
    const hit = (stacks: number): number => {
      const w = arena(8);
      wearRelic(w, 'implication');
      const e = spawn(w, 'skeleton', 1);
      e.hp = 5000;
      w.anim.parryStacks = stacks;
      w.player.stamina = w.derived.maxStamina;
      w.attack();
      tick(w, 0.6);
      return 5000 - e.hp;
    };
    expect(hit(3)).toBeGreaterThan(hit(0));
  });

  it("Riggs' Answer deals a parried blow straight back", () => {
    const w = arena(2);
    wearRelic(w, 'riggs_answer');
    const e = spawn(w, 'skeleton', 1);
    e.hp = 500;
    windUp(w, e);
    w.setBlock(true);
    tick(w, 0.25);
    expect(e.hp).toBeLessThan(500);
  });

  it('Fight Milk lasts the delve as an infusion, and trades the size of the bar for the speed of it', () => {
    const w = arena(6);
    const before = { regen: w.derived.traits.staminaRegen, max: w.derived.maxStamina };
    w.state.flask.infusion = 'fight_milk';
    w.refreshDerived();
    expect(w.derived.traits.staminaRegen).toBeGreaterThan(before.regen);
    expect(w.derived.maxStamina).toBeLessThan(before.max);
    // It survives the floor, and the world being rebuilt from the save.
    expect(new World(w.state).derived.maxStamina).toBeLessThan(before.max);
  });

  it('a drunk bottle of Fight Milk is refused, never double-applied', () => {
    const w = arena(6);
    w.state.flask.infusion = 'fight_milk';
    w.refreshDerived();
    const max = w.derived.maxStamina;
    const b = makeConsumable('fight_milk');
    addItem(w.run.backpack, b);
    w.use(b.uid);
    expect(w.run.tonics ?? []).toEqual([]);
    expect(w.derived.maxStamina).toBe(max);
    // And the bottle is still in the pack, not poured away for nothing.
    expect(w.run.backpack.items.some((i) => i.uid === b.uid)).toBe(true);
  });

  it('the infusion regenerates stamina faster in the run itself', () => {
    const bar = (infused: boolean): number => {
      const w = arena(6);
      if (infused) {
        w.state.flask.infusion = 'fight_milk';
        w.refreshDerived();
      }
      w.player.stamina = 0;
      tick(w, 1.2);
      return w.player.stamina;
    };
    expect(bar(true)).toBeGreaterThan(bar(false));
  });
});

/**
 * The rules quote real figures, which is the whole point of them — a
 * description that says "a little further" is worth nothing. These lock each
 * quoted number to the constant it came from, so a tuning change that makes a
 * rule a lie fails here instead of in front of a player.
 */
describe('every number a rule quotes is true', () => {
  const rule = (id: string) => findUnique(id)!.detail;

  it('An Entirely Ordinary Sword: +8 Attack, 0 durability', () => {
    expect(rule('ordinary_sword')).toContain('+8 Attack');
    expect(findUnique('ordinary_sword')!.stats!.attack).toBe(8);
    const sword = makeUnique(findUnique('ordinary_sword')!, createRng(1), 6, true);
    expect(durability(sword).max).toBe(0);
  });

  it('The Implication: +25% a stack to 3, +75% at the top', () => {
    expect(rule('implication')).toContain('+25%');
    expect(rule('implication')).toContain('+75%');
    const eq = emptyEquipment();
    eq.weapon = makeUnique(findUnique('implication')!, createRng(1), 6, true);
    const t = derivePlayer(eq, {}).traits;
    expect(t.parryFeed).toBe(0.25);
    expect(t.parryFeedMax).toBe(3);
    expect(t.parryFeed * t.parryFeedMax).toBeCloseTo(0.75);
  });

  it('Champion of the Sun: +70%', () => {
    expect(rule('champion_of_the_sun')).toContain('+70%');
    expect(findUnique('champion_of_the_sun')!.power).toBeCloseTo(1.7);
  });

  it("Riggs' Answer: 100% back", () => {
    expect(rule('riggs_answer')).toContain('100%');
    expect(findUnique('riggs_answer')!.power).toBe(1);
  });

  it("Bergholt's Bright Error: +4 radius off 9.5, and 7-15% against a plain 45%", () => {
    const r = rule('bright_error');
    expect(r).toContain('+4 light radius');
    expect(r).toContain('9.5');
    expect(r).toContain('13.5');
    expect(r).toContain('7-15%');
    expect(r).toContain('45%');
    expect(BASE_LIGHT_RADIUS).toBe(9.5);
    expect(findUnique('bright_error')!.power).toBe(4);
    expect(BASE_LIGHT_RADIUS + findUnique('bright_error')!.power).toBe(13.5);
    // The measured spread across every roll it can come out as.
    const blocks: number[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      const eq = emptyEquipment();
      eq.offhand = makeUnique(findUnique('bright_error')!, createRng(seed), 6, true);
      blocks.push(derivePlayer(eq, {}).block);
    }
    expect(Math.min(...blocks)).toBeGreaterThanOrEqual(0.07);
    expect(Math.max(...blocks)).toBeLessThanOrEqual(0.15);
    const plain = emptyEquipment();
    plain.offhand = makeEquipment({ baseId: 'buckler', materialId: 'gold', rarity: Rarity.Common, ilvl: 6, quality: 1 });
    expect(derivePlayer(plain, {}).block).toBeCloseTo(0.45);
  });

  it('Eulogy Plate: +14 Defense, +20 Health, healing at 50%', () => {
    const def = findUnique('eulogy_plate')!;
    expect(rule('eulogy_plate')).toContain('+14 Defense');
    expect(rule('eulogy_plate')).toContain('+20 Health');
    expect(rule('eulogy_plate')).toContain('x0.5');
    expect(def.stats!.defense).toBe(14);
    expect(def.stats!.health).toBe(20);
    expect(def.power).toBe(0.5);
  });

  it('Charlie Work: 2 tiles becomes 4', () => {
    expect(rule('charlie_work')).toContain('4 tiles ahead');
    expect(findUnique('charlie_work')!.power).toBe(2);
  });

  it('Kitten Mittens: 2 tiles off a skeleton that sees 7', () => {
    expect(rule('kitten_mittens')).toContain('7 tiles');
    expect(rule('kitten_mittens')).toContain('at 5');
    expect(enemyDef('skeleton').sight).toBe(7);
    expect(findUnique('kitten_mittens')!.power).toBe(2);
  });

  it('Fight Milk multiplies stamina regen by 1.7 and costs 20 maximum', () => {
    // The printed rate is derived from STAMINA_REGEN rather than restated, so
    // retuning stamina cannot leave the relic's own description lying.
    const boosted = Math.round(STAMINA_REGEN * 1.7 * 10) / 10;
    const r = rule('fight_milk');
    expect(r).toContain(`${STAMINA_REGEN}/s`);
    expect(r).toContain(`${boosted}/s`);
    expect(r).toContain('-20 maximum stamina');
    const w = arena(6);
    const before = w.derived.maxStamina;
    w.state.flask.infusion = 'fight_milk';
    w.refreshDerived();
    expect(w.derived.traits.staminaRegen * STAMINA_REGEN).toBeCloseTo(boosted);
    expect(before - w.derived.maxStamina).toBe(20);
  });
});

describe('the relic codex', () => {
  it('starts empty, records a find, and the bench can take it back', () => {
    const seen: string[] = [];
    expect(relicProgress(seen, []).found).toBe(0);
    expect(relicProgress(seen, []).total).toBe(RELIC_ORDER.length);
    expect(findRelic(seen, 'fight_milk')).toBe(true);
    expect(findRelic(seen, 'fight_milk')).toBe(false);
    expect(isFound(seen, 'fight_milk')).toBe(true);
    expect(forgetRelic(seen, 'fight_milk')).toBe(true);
    expect(isFound(seen, 'fight_milk')).toBe(false);
  });

  it('holding a relic is not the same as knowing what it is', () => {
    const w = arena(11);
    const relic = makeUnique(findUnique('ordinary_sword')!, createRng(3), 6, false);
    w.floor.pickups.push({ id: 'p1', x: w.player.x, y: w.player.y, items: [relic], gold: 0 });
    w.take('p1');
    // Held, so the King owes you a different one — but the codex stays shut.
    expect(w.state.lifetime.uniquesSeen).toContain('ordinary_sword');
    expect(w.state.lifetime.uniquesKnown ?? []).not.toContain('ordinary_sword');
    expect(relicProgress(w.state.lifetime.uniquesSeen, w.state.lifetime.uniquesKnown)).toMatchObject({ found: 1, named: 0 });
  });

  it('opens the page the moment it is identified', () => {
    const w = arena(12);
    const relic = makeUnique(findUnique('champion_of_the_sun')!, createRng(3), 6, false);
    w.floor.pickups.push({ id: 'p1', x: w.player.x, y: w.player.y, items: [relic], gold: 0 });
    w.take('p1');
    const scroll = makeConsumable('scroll_identify');
    addItem(w.run.backpack, scroll);
    w.use(scroll.uid);
    expect(w.state.lifetime.uniquesKnown).toContain('champion_of_the_sun');
  });

  it('names a relic that arrives already identified', () => {
    const w = arena(13);
    const relic = makeUnique(findUnique('charlie_work')!, createRng(3), 6, true);
    w.floor.pickups.push({ id: 'p1', x: w.player.x, y: w.player.y, items: [relic], gold: 0 });
    w.take('p1');
    expect(w.state.lifetime.uniquesKnown).toContain('charlie_work');
  });
});

describe('the save', () => {
  it('gives an older playthrough an empty relic record without touching the rest', () => {
    const state = newGame(createRng(1));
    state.gold = 999;
    delete (state.lifetime as { uniquesSeen?: string[] }).uniquesSeen;
    startRun(state, 4);
    delete (state.run as unknown as { tonics?: string[] }).tonics;
    (state as { revision?: number }).revision = 12;
    const out = migrateSave(state);
    expect(out.lifetime.uniquesSeen).toEqual([]);
    expect(out.lifetime.uniquesKnown).toEqual([]);
    expect(out.run!.tonics).toEqual([]);
    expect(out.gold).toBe(999);
    expect(out.revision).toBe(SAVE_REVISION);
  });

  it('carries an already-legible codex entry across the held/named split', () => {
    const state = newGame(createRng(1));
    state.lifetime.uniquesSeen = ['whetless_placeholder', 'charlie_work'];
    delete (state.lifetime as { uniquesKnown?: string[] }).uniquesKnown;
    (state as { revision?: number }).revision = 14;
    const out = migrateSave(state);
    // Recorded under the old rule and already readable — not taken away.
    expect(out.lifetime.uniquesKnown).toEqual(['whetless_placeholder', 'charlie_work']);
  });
});
