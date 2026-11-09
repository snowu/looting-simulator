import { describe, expect, it } from 'vitest';
import { DIRS, DX, DY } from '../core/dir';
import { FLOOR, EnemyState, createEnemy, generateFloor } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { GRAVE_BIOMES, RAISE_CHANNEL, RAISE_HP, RAISE_LIMIT, SHATTER_OVERKILL } from '../data/necromancy';
import { World } from '../world/world';
import { room } from './harness';
import * as Combat from '../world/combat';
import * as EnemyAi from '../world/enemy-ai';

const arena = (seed = 171): World => room({ seed });

function run(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) w.update(1 / 60);
}

/** A Gravecaller two tiles off the player, aware of them, and a fresh skeleton corpse beside it. */
function scene(seed = 171): { w: World; caller: EnemyState; corpse: EnemyState } {
  const w = arena(seed);
  const p = w.player;
  const caller = createEnemy(enemyDef('gravecaller'), p.x + 2, p.y, 0, 'gc', 2);
  caller.alert = 8;
  caller.ai = 'chase';
  const corpse = createEnemy(enemyDef('skeleton'), p.x + 2, p.y + 1, 0, 'sk', 2);
  corpse.ai = 'dead';
  corpse.hp = 0;
  w.floor.enemies.push(caller, corpse);
  return { w, caller, corpse };
}

describe('placement', () => {
  it('only on Ossuary and Catacombs floors, never on the first', () => {
    let placed = 0;
    for (let seed = 0; seed < 80; seed++) {
      for (let depth = 1; depth <= 6; depth++) {
        const f = generateFloor(seed, depth, 'hard');
        const callers = f.enemies.filter((e) => e.def === 'gravecaller');
        expect(callers.length).toBeLessThanOrEqual(1);
        if (callers.length) {
          placed++;
          expect(GRAVE_BIOMES.has(f.biome)).toBe(true);
          expect(depth).toBeGreaterThanOrEqual(2);
        }
      }
    }
    expect(placed).toBeGreaterThan(5);
  }, 60_000);
});

describe('the chant', () => {
  it('stands a fallen undead back up, risen, at half health, not swinging', () => {
    const { w, caller, corpse } = scene();
    run(w, 0.1);
    expect(caller.channel?.target).toBe('sk');
    run(w, RAISE_CHANNEL);
    expect(caller.channel).toBeUndefined();
    expect(corpse.ai).toBe('recover');
    expect(corpse.risen).toBe(true);
    expect(corpse.hp).toBe(Math.round(corpse.maxHp * RAISE_HP));
    expect(caller.raised).toBe(1);
  });

  it('a blow breaks the chant', () => {
    const { w, caller, corpse } = scene(172);
    run(w, 0.5);
    expect(caller.channel).toBeDefined();
    caller.hurtT = 0.3;
    run(w, 0.05);
    expect(caller.channel).toBeUndefined();
    run(w, RAISE_CHANNEL);
    expect(corpse.ai).toBe('dead');
  });

  it('never raises the living-dead twice past its limit, and never a goblin', () => {
    const { w, caller, corpse } = scene(173);
    corpse.def = 'goblin';
    run(w, RAISE_CHANNEL + 0.5);
    expect(corpse.ai).toBe('dead');
    expect(caller.raised ?? 0).toBe(0);
    caller.raised = RAISE_LIMIT;
    corpse.def = 'skeleton';
    run(w, RAISE_CHANNEL + 0.5);
    expect(corpse.ai).toBe('dead');
  });
});

describe('remains', () => {
  it('shattered or sanctified remains stay down', () => {
    for (const remains of ['shattered', 'sanctified'] as const) {
      const { w, corpse } = scene(174);
      corpse.remains = remains;
      run(w, RAISE_CHANNEL + 0.5);
      expect(corpse.ai, remains).toBe('dead');
    }
  });

  it('a blunt killing blow shatters, a big overkill shatters, holy sanctifies', () => {
    const w = arena(175);
    const sk = createEnemy(enemyDef('skeleton'), 0, 0, 0, 'a', 2);
    const set = (patch: Partial<typeof w.derived>) => Object.assign(w.derived, patch);

    set({ damageType: 'blunt' });
    sk.hp = -1;
    EnemyAi.markRemains(w, sk);
    expect(sk.remains).toBe('shattered');

    delete sk.remains;
    set({ damageType: 'slash' });
    sk.hp = -Math.ceil(sk.maxHp * SHATTER_OVERKILL);
    EnemyAi.markRemains(w, sk);
    expect(sk.remains).toBe('shattered');

    delete sk.remains;
    sk.hp = -1;
    w.derived.stats.holy = 3;
    EnemyAi.markRemains(w, sk);
    expect(sk.remains).toBe('sanctified');

    delete sk.remains;
    w.derived.stats.holy = 0;
    EnemyAi.markRemains(w, sk);
    expect(sk.remains).toBeUndefined();

    const gob = createEnemy(enemyDef('goblin'), 0, 0, 0, 'b', 2);
    set({ damageType: 'blunt' });
    gob.hp = -1;
    EnemyAi.markRemains(w, gob);
    expect(gob.remains).toBeUndefined();
  });

  it('a raised corpse pays nothing when it falls again', () => {
    const { w, corpse } = scene(176);
    run(w, RAISE_CHANNEL + 0.2);
    expect(corpse.risen).toBe(true);
    const kills = w.run.stats.kills;
    Combat.killEnemy(w, corpse);
    expect(w.run.stats.kills).toBe(kills);
  });
});

it('the ground is open enough for the scene', () => {
  const w = arena();
  for (const d of DIRS) expect(w.floor.tiles[(w.player.y + DY[d]) * w.floor.width + w.player.x + DX[d]]).toBe(FLOOR);
});
