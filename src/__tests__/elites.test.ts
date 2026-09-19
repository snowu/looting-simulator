import { describe, expect, it } from 'vitest';
import { DIRS, DX, DY } from '../core/dir';
import { createRng } from '../core/rng';
import { newGame } from '../state/game-state';
import { addItem } from '../state/inventory';
import { FLOOR, EnemyState, createEnemy, generateFloor, promoteElite } from '../systems/dungeon';
import { BOSS_ID, ENEMIES, THIEF_GLOW, enemyDef, enemyView } from '../data/enemies';
import {
  ELITES, ELITE_GOLD_MULT, ELITE_HP_MULT, FRENZY_AT, HASTED_WINDUP_MULT, IRONHIDE_DEFENSE_MULT, IRONHIDE_HP_MULT,
  THIEF_ESCAPE, VENGEFUL_FUSE, eliteChance, eliteFor, eligibleTraits,
} from '../data/elites';
import { makeMaterial, rollEnemyLoot } from '../systems/items';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import type { DamageType } from '../types';

interface Private {
  killEnemy(e: EnemyState): void;
  damagePlayer(attack: number, type: DamageType, fromX: number, fromY: number, source: string, sourceId?: string, attacker?: EnemyState): void;
  runWithLoot(e: EnemyState, def: ReturnType<typeof enemyDef>, dist: number, sees: boolean, dt: number): boolean;
}
const priv = (w: World) => w as unknown as Private;

/** A cleared floor-1 world with the player facing an open tile. */
function arena(seed = 91): World {
  const state = newGame(createRng(seed));
  startRun(state, seed);
  const w = new World(state);
  const f = w.floor;
  f.enemies = [];
  f.traps = [];
  f.props = f.props.filter((p) => !p.blocking);
  const free = (x: number, y: number) =>
    f.tiles[y * f.width + x] === FLOOR && !f.doors.some((d) => d.x === x && d.y === y) && !f.stairs.some((s) => s.x === x && s.y === y);
  for (let y = 2; y < f.height - 2; y++) for (let x = 2; x < f.width - 2; x++) for (const d of DIRS) {
    const bx = x - DX[d], by = y - DY[d];
    if (!free(x, y) || !free(x + DX[d], y + DY[d]) || !free(bx, by)) continue;
    Object.assign(w.player, { x, y, facing: d });
    Object.assign(w.anim, { fromX: x, fromY: y, yaw: d * Math.PI / 2, yawTo: d * Math.PI / 2 });
    return w;
  }
  throw new Error('no arena');
}

/** An enemy of `id` on the tile the player faces. */
function facing(w: World, id: string): EnemyState {
  const t = w.frontTile();
  const e = createEnemy(enemyDef(id), t.x, t.y, 0, `t_${id}`, 1);
  e.ai = 'chase';
  e.alert = 6;
  w.floor.enemies.push(e);
  return e;
}

function run(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

describe('elite chance and eligibility', () => {
  it('is zero on the first two floors and climbs from depth 3', () => {
    expect(eliteChance(1)).toBe(0);
    expect(eliteChance(2)).toBe(0);
    expect(eliteChance(3)).toBeCloseTo(0.05);
    expect(eliteChance(6)).toBeCloseTo(0.11);
  });

  it('never promotes the King, and never gives a thief or an archer Thieving', () => {
    expect(eligibleTraits(enemyDef(BOSS_ID))).toEqual([]);
    expect(eligibleTraits(enemyDef('goblin'))).not.toContain('thieving');
    expect(eligibleTraits(enemyDef('skeleton_archer'))).not.toContain('thieving');
    expect(eligibleTraits(enemyDef('skeleton'))).toContain('thieving');
  });

  it('is deterministic per floor and monster', () => {
    const def = enemyDef('skeleton');
    const rolls = Array.from({ length: 400 }, (_, i) => eliteFor(777, `e${i}`, 6, def));
    expect(Array.from({ length: 400 }, (_, i) => eliteFor(777, `e${i}`, 6, def))).toEqual(rolls);
    const hits = rolls.filter(Boolean).length;
    expect(hits).toBeGreaterThan(20);
    expect(hits).toBeLessThan(75);
  });

  it('shows up on generated floors from depth 3, never shallower, never on the throne guard', () => {
    let deep = 0;
    for (let seed = 0; seed < 60; seed++) {
      for (let depth = 1; depth <= 6; depth++) {
        const f = generateFloor(seed, depth, 'hard');
        const elites = f.enemies.filter((e) => e.elite);
        if (depth < 3) expect(elites).toEqual([]);
        else deep += elites.length;
        if (depth === 6) {
          expect(f.enemies.find((e) => e.def === BOSS_ID)!.elite).toBeUndefined();
          // The King and his guards are the first three spawned.
          for (const e of f.enemies.slice(0, 3)) expect(e.elite).toBeUndefined();
        }
      }
    }
    expect(deep).toBeGreaterThan(60);
    // Generating 360 floors outruns the default budget when files run in parallel.
  }, 60_000);
});

describe('what a trait changes', () => {
  it('bakes in the extra health at promotion', () => {
    const plain = createEnemy(enemyDef('ghoul'), 0, 0, 0, 'a', 4);
    const hasted = createEnemy(enemyDef('ghoul'), 0, 0, 0, 'b', 4);
    const iron = createEnemy(enemyDef('ghoul'), 0, 0, 0, 'c', 4);
    promoteElite(hasted, 'hasted');
    promoteElite(iron, 'ironhide');
    expect(hasted.maxHp).toBe(Math.round(plain.maxHp * ELITE_HP_MULT));
    expect(iron.maxHp).toBe(Math.round(plain.maxHp * ELITE_HP_MULT * IRONHIDE_HP_MULT));
    expect(hasted.hp).toBe(hasted.maxHp);
  });

  it('reads through the view, leaving the stat block alone', () => {
    const def = enemyDef('skeleton');
    expect(enemyView(def, 10, 10)).toBe(def);
    expect(enemyView(def, 10, 10, {})).toBe(def);
    const hasted = enemyView(def, 10, 10, { elite: 'hasted' });
    expect(hasted.name).toBe('Hasted Skeleton');
    expect(hasted.id).toBe('skeleton');
    expect(hasted.glow).toBe(ELITES.hasted.color);
    expect(hasted.windup).toBeCloseTo(def.windup * HASTED_WINDUP_MULT);
    expect(enemyView(def, 10, 10, { elite: 'ironhide' }).defense).toBeCloseTo(def.defense * IRONHIDE_DEFENSE_MULT);
    expect(def.name).toBe('Skeleton');
  });

  it('frenzies only below the threshold', () => {
    const def = enemyDef('skeleton');
    expect(enemyView(def, 60, 100, { elite: 'frenzied' }).windup).toBe(def.windup);
    expect(enemyView(def, FRENZY_AT * 100 - 1, 100, { elite: 'frenzied' }).windup).toBeLessThan(def.windup);
  });

  it('lights a thief running with your things', () => {
    expect(enemyView(enemyDef('goblin'), 10, 10, { carrying: true }).glow).toBe(THIEF_GLOW);
    expect(enemyView(enemyDef('skeleton'), 10, 10, { elite: 'thieving' }).thief).toBe(true);
  });

  it('pays more from the same draws, and changes nothing for an ordinary kill', () => {
    const def = enemyDef('ghoul');
    let plainGold = 0, eliteGold = 0, plainItems = 0, eliteItems = 0;
    for (let seed = 0; seed < 300; seed++) {
      const plain = rollEnemyLoot(createRng(seed), def, 4, 0, undefined, {}, undefined, [], 'hard');
      expect(rollEnemyLoot(createRng(seed), def, 4, 0, undefined, {}, undefined, [], 'hard', false).gold).toBe(plain.gold);
      const elite = rollEnemyLoot(createRng(seed), def, 4, 0, undefined, {}, undefined, [], 'hard', true);
      plainGold += plain.gold; eliteGold += elite.gold;
      plainItems += plain.items.filter((i) => i.kind === 'equipment').length;
      eliteItems += elite.items.filter((i) => i.kind === 'equipment').length;
    }
    expect(eliteGold).toBeGreaterThan(plainGold * (ELITE_GOLD_MULT - 0.3));
    expect(eliteItems).toBeGreaterThan(plainItems * 2);
  });
});

describe('the thieving Cutpurse', () => {
  it('takes half a stack on a blow that gets through, and runs', () => {
    const w = arena();
    w.run.backpack.items = [];
    addItem(w.run.backpack, makeMaterial('iron', 10));
    const e = facing(w, 'goblin');
    priv(w).damagePlayer(8, 'slash', e.x, e.y, 'Goblin Cutpurse', 'goblin', e);
    expect(e.stolen?.[0].qty).toBe(5);
    expect(w.run.backpack.items[0].qty).toBe(5);
    expect(e.ai).toBe('flee');
  });

  it('takes nothing through a raised guard or a parry', () => {
    const w = arena(92);
    w.run.backpack.items = [];
    addItem(w.run.backpack, makeMaterial('iron', 10));
    const e = facing(w, 'goblin');
    w.anim.blockRaise = 1;
    priv(w).damagePlayer(8, 'slash', e.x, e.y, 'Goblin Cutpurse', 'goblin', e);
    expect(e.stolen).toBeUndefined();
    Object.assign(w.anim, { blockRaise: 0, parryArmed: true, blockT: 0 });
    priv(w).damagePlayer(8, 'slash', e.x, e.y, 'Goblin Cutpurse', 'goblin', e);
    expect(e.stolen).toBeUndefined();
    expect(w.run.backpack.items[0].qty).toBe(10);
  });

  it('only thieves steal', () => {
    const w = arena(93);
    addItem(w.run.backpack, makeMaterial('iron', 10));
    const e = facing(w, 'skeleton');
    priv(w).damagePlayer(8, 'slash', e.x, e.y, 'Skeleton', 'skeleton', e);
    expect(e.stolen).toBeUndefined();
    e.elite = 'thieving';
    priv(w).damagePlayer(8, 'slash', e.x, e.y, 'Skeleton', 'skeleton', e);
    expect(e.stolen?.length).toBe(1);
  });

  it('drops what it took when it dies', () => {
    const w = arena(94);
    w.run.backpack.items = [];
    addItem(w.run.backpack, makeMaterial('iron', 4));
    const e = facing(w, 'goblin');
    priv(w).damagePlayer(8, 'slash', e.x, e.y, 'Goblin Cutpurse', 'goblin', e);
    priv(w).killEnemy(e);
    const pile = w.floor.pickups.find((p) => p.x === e.x && p.y === e.y)!;
    expect(pile.items.some((i) => i.ref === 'iron' && i.qty === 2)).toBe(true);
    expect(e.stolen).toBeUndefined();
  });

  it('gets away after long enough out of sight, with the goods', () => {
    const w = arena(95);
    const e = facing(w, 'goblin');
    e.stolen = [makeMaterial('iron', 3)];
    e.stolenT = 0;
    priv(w).runWithLoot(e, enemyDef('goblin'), 9, false, THIEF_ESCAPE - 1);
    expect(e.ai).not.toBe('dead');
    priv(w).runWithLoot(e, enemyDef('goblin'), 9, true, 0.1);
    expect(e.stolenT).toBe(0);
    priv(w).runWithLoot(e, enemyDef('goblin'), 9, false, THIEF_ESCAPE);
    expect(e.ai).toBe('dead');
    expect(e.stolen).toBeUndefined();
    expect(w.floor.pickups.some((p) => p.items.some((i) => i.ref === 'iron' && i.qty === 3))).toBe(false);
  });
});

describe('the Vengeful burst', () => {
  it('strikes the player standing beside the corpse after the fuse', () => {
    const w = arena(96);
    const e = facing(w, 'skeleton');
    e.elite = 'vengeful';
    priv(w).killEnemy(e);
    expect(e.burstT).toBe(VENGEFUL_FUSE);
    const hp = w.player.hp;
    run(w, VENGEFUL_FUSE * 0.5);
    expect(w.player.hp).toBe(hp);
    run(w, VENGEFUL_FUSE * 0.7);
    expect(e.burstT).toBeUndefined();
    expect(w.player.hp).toBeLessThan(hp);
  });

  it('misses a player who stepped away, and catches the monsters beside it', () => {
    const w = arena(97);
    const e = facing(w, 'skeleton');
    e.elite = 'vengeful';
    // A rat beside the corpse, on the side away from the player.
    const d = w.player.facing;
    const rat = createEnemy(enemyDef('rat'), e.x + DX[d], e.y + DY[d], 0, 'rat', 1);
    w.floor.enemies.push(rat);
    priv(w).killEnemy(e);
    // Back off two tiles.
    w.player.x -= DX[d] * 2;
    w.player.y -= DY[d] * 2;
    const hp = w.player.hp;
    run(w, VENGEFUL_FUSE + 0.1);
    expect(w.player.hp).toBe(hp);
    expect(rat.hp).toBeLessThan(rat.maxHp);
  });
});

it('keeps every monster eligible for at least four traits', () => {
  for (const def of ENEMIES) if (def.behavior !== 'boss') expect(eligibleTraits(def).length).toBeGreaterThanOrEqual(4);
});
