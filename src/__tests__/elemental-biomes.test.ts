import { describe, expect, it, vi } from 'vitest';
import { createRng } from '../core/rng';
import { Dir } from '../core/dir';
import { ENEMIES, enemyDef } from '../data/enemies';
import { ELEMENTAL_VARIANTS, ELEMENTAL_VARIANT_IDS } from '../data/elemental-variants';
import { BIOMES } from '../data/biomes';
import { getArt } from '../art/registry';
import { rasterize } from '../art/raster';
import { FLOOR, blocksMove, blocksSight, createEnemy, generateFloor, propAt } from '../systems/dungeon';
import * as decor from '../systems/ceiling-decor';
import { newGame } from '../state/game-state';
import { parseSave, serializeSave } from '../state/save-format';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { createShared, ps1Material } from '../render/ps1';
import { Texture } from 'three';

const seeded = (value: unknown) => JSON.stringify(value, (key, v) => key === 'uid' ? undefined : v);

function frostFloor() {
  for (let seed = 1; seed < 100; seed++) {
    const floor = generateFloor(seed, 3);
    if (floor.biome === 'frostvault') return { seed, floor };
  }
  throw new Error('no frost floor');
}
function arena(): World {
  const s = newGame(createRng(31));
  startRun(s, 31);
  const w = new World(s), f = w.floor;
  f.tiles.fill(FLOOR); f.enemies = []; f.props = []; f.traps = []; f.doors = []; f.stairs = []; f.secrets = [];
  Object.assign(w.player, { x: 5, y: 5, facing: Dir.N });
  Object.assign(w.anim, { fromX: 5, fromY: 5, moveT: 1 });
  return w;
}

describe('elemental relatives', () => {
  it('inherits every non-overridden stat, timing, AI, drop rate and scale', () => {
    // `pack` is not inherited: variants have always spawned 1–2 at a time.
    const overrides = new Set(['id', 'name', 'sprite', 'element', 'damageType', 'resist', 'loot', 'description', 'weight', 'pack']);
    for (const v of ELEMENTAL_VARIANTS) {
      const base = enemyDef(v.base), actual = enemyDef(v.id);
      const stable = (e: typeof base) => Object.fromEntries(Object.entries(e).filter(([key]) => !overrides.has(key)));
      expect(stable(actual), v.id).toEqual(stable(base));
      expect(actual.weight).toBe(base.weight * 0.5);
      expect(actual.loot.map(({ id, ...drop }) => drop)).toEqual(base.loot.map(({ id, ...drop }) => drop));
      for (const difficulty of ['hard', 'normal'] as const) for (let d = 1; d <= 6; d++) {
        expect(createEnemy(actual, 1, 1, Dir.N, 'v', d, difficulty).hp).toBe(createEnemy(base, 1, 1, Dir.N, 'b', d, difficulty).hp);
      }
      expect(BIOMES.every((b) => !b.favoredEnemies?.includes(v.id))).toBe(true);
    }
  });

  it('spawns each new resident only at home and retains neutral encounters', () => {
    const seen = new Set<string>();
    const totals = { fire: { neutral: 0, all: 0 }, frost: { neutral: 0, all: 0 } };
    for (let seed = 1; seed <= 120; seed++) for (let d = 1; d <= 6; d++) {
      const f = generateFloor(seed, d), theme = BIOMES.find((b) => b.id === f.biome)!.element;
      for (const e of f.enemies) {
        const def = enemyDef(e.def);
        if (ELEMENTAL_VARIANT_IDS.has(e.def)) { expect(def.element).toBe(theme); seen.add(e.def); }
        if (e.def === 'mole') { expect(f.biome).toBe('burrows'); seen.add(e.def); }
        if (theme) { totals[theme].all++; if (!def.element) totals[theme].neutral++; }
      }
    }
    expect([...seen].sort()).toEqual([...ELEMENTAL_VARIANT_IDS, 'mole'].sort());
    for (const sample of Object.values(totals)) expect(sample.neutral / sample.all).toBeGreaterThan(0.1);
    expect(ENEMIES.map((e) => e.id).length).toBe(new Set(ENEMIES.map((e) => e.id)).size);
  }, 30_000);

  it('lets the mole absorb a frontal blow but exposes its back', () => {
    const damage = (front: boolean) => {
      const w = arena(), def = enemyDef('mole');
      const e = createEnemy(def, 5, 4, front ? Dir.S : Dir.N, 'm', 1);
      e.guard = 'up'; e.guardT = 20; e.ai = 'chase'; e.hp = 1000;
      w.floor.enemies.push(e);
      // Resolve the exact same blow without allowing AI to turn between samples.
      (w as unknown as { hitEnemy(enemy: typeof e): void }).hitEnemy(e);
      return 1000 - e.hp;
    };
    expect(damage(true)).toBeLessThan(damage(false));
  });
});

describe('ceiling decoration and root caches', () => {
  it('does not consume gameplay RNG or alter any existing floor content', () => {
    const { seed, floor } = frostFloor();
    const mock = vi.spyOn(decor, 'iciclesFor').mockReturnValue([]);
    try {
      const bare = generateFloor(seed, 3);
      expect(seeded({ ...floor, props: floor.props.filter((p) => p.kind !== 'icicle') })).toEqual(seeded(bare));
    } finally { mock.mockRestore(); }
    expect(seeded(generateFloor(seed, 3))).toEqual(seeded(floor));
  });

  it('hangs in separated clusters, off stairs and doors, without blocking or interaction', () => {
    const { floor } = frostFloor();
    const ice = floor.props.filter((p) => p.kind === 'icicle');
    expect(ice.length).toBeGreaterThanOrEqual(16);
    expect(ice.length).toBeLessThanOrEqual(70);
    for (const p of ice) {
      expect(p.ceiling!.height).toBeGreaterThanOrEqual(0.35);
      expect(p.ceiling!.height).toBeLessThanOrEqual(0.9);
      expect(getArt(p.ceiling!.sprite)).toBeDefined();
      expect(floor.tiles[p.y * floor.width + p.x]).toBe(FLOOR);
      expect([...floor.stairs, ...floor.doors].some((s) => s.x === p.x && s.y === p.y)).toBe(false);
      expect(ice.some((q) => q !== p && Math.abs(q.x - p.x) + Math.abs(q.y - p.y) <= 2)).toBe(true);
      const isolated = { ...floor, props: [p] };
      expect(propAt(isolated, p.x, p.y)).toBeUndefined();
      expect(blocksMove(isolated, p.x, p.y)).toBe(false);
      expect(blocksSight(isolated, p.x, p.y)).toBe(false);
    }
  });

  it('preserves ceiling metadata and new enemy IDs through the real save format', () => {
    const state = newGame(createRng(1)); startRun(state, 1);
    const { floor } = frostFloor();
    state.run!.floors[2] = floor;
    const back = parseSave(serializeSave(state))!;
    expect(back.run!.floors[2]).toEqual(floor);
  });

  it('smashes a root cache and opens its tile, leaving ceiling props inert', () => {
    const w = arena();
    const p = { id: 'cache', kind: 'root_cache' as const, x: 5, y: 4, used: false, tier: 'urn' as const, blocking: true, mimic: false };
    w.floor.props.push(p);
    expect(w.interactionHint()).toBe('Smash root cache');
    expect(blocksMove(w.floor, 5, 4)).toBe(true);
    w.interact();
    expect(p.used).toBe(true);
    expect(blocksMove(w.floor, 5, 4)).toBe(false);
    w.floor.props = [{ ...p, kind: 'icicle', tier: 'none', blocking: false, used: false }];
    expect(w.interactionHint()).toBeNull();
  });
});

describe('frozen art and pulse uniforms', () => {
  it('has five distinct frost walls, two floors, and its own roof', () => {
    const b = BIOMES.find((b) => b.id === 'frostvault')!;
    expect(b.wallVariants).toHaveLength(5); expect(b.floorVariants).toHaveLength(2);
    expect(b.ceiling).toBe('ceil_frostvault');
    const ids = [...b.wallVariants!, ...b.floorVariants!, b.ceiling];
    const data = ids.map((id) => rasterize(getArt(id)!, undefined, getArt).data);
    expect(new Set(data.map((a) => Array.from(a).join(','))).size).toBe(ids.length);
    // Most ice is lit surface, never an emissive blue lava sheet.
    for (const a of data) expect(a.filter((v, i) => i % 4 === 3 && v === 250).length).toBeLessThan(32);
  });

  it('shares the clock while keeping the material pulse opt-in', () => {
    const shared = createShared(), tex = new Texture();
    const ordinary = ps1Material(shared, tex), hot = ps1Material(shared, tex, { pulse: [0.35, 3.8] });
    expect(ordinary.uniforms.uPulse.value.toArray()).toEqual([0, 0]);
    expect(hot.uniforms.uPulse.value.toArray()).toEqual([0.35, 3.8]);
    shared.uTime.value = 3;
    expect(hot.uniforms.uTime.value).toBe(3);
    ordinary.dispose(); hot.dispose(); tex.dispose();
  });
});
