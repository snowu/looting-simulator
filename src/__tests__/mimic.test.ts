import { describe, expect, it } from 'vitest';
import { DIRS, DX, DY } from '../core/dir';
import { createRng } from '../core/rng';
import { newGame } from '../state/game-state';
import { FLOOR, blocksMove, chestIsMimic, createEnemy, propAt } from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { findMaterial } from '../data/materials';
import { durability } from '../systems/items';
import { startRun } from '../systems/run';
import { World } from '../world/world';
import { spawnLabChest } from '../dev/lab-room';

function arena(seed = 71): World {
  const state = newGame(createRng(seed));
  startRun(state, seed);
  const w = new World(state);
  const f = w.floor;
  f.enemies = [];
  f.props = f.props.filter((p) => !p.blocking);
  const free = (x: number, y: number) =>
    f.tiles[y * f.width + x] === FLOOR && !f.doors.some((d) => d.x === x && d.y === y) && !f.stairs.some((s) => s.x === x && s.y === y);
  for (let y = 2; y < f.height - 2; y++) for (let x = 2; x < f.width - 2; x++) for (const d of DIRS) {
    if (!free(x, y) || !free(x + DX[d], y + DY[d])) continue;
    Object.assign(w.player, { x, y, facing: d });
    Object.assign(w.anim, { fromX: x, fromY: y, yaw: d * Math.PI / 2, yawTo: d * Math.PI / 2 });
    return w;
  }
  throw new Error('no mimic arena');
}

describe('mimics', () => {
  it('rolls on a deterministic stream at roughly the intended rate', () => {
    const rolls = Array.from({ length: 1000 }, (_, i) => chestIsMimic(12345, `p${i}`));
    expect(rolls.filter(Boolean).length).toBeGreaterThan(90);
    expect(rolls.filter(Boolean).length).toBeLessThan(150);
    expect(Array.from({ length: 1000 }, (_, i) => chestIsMimic(12345, `p${i}`))).toEqual(rolls);
  });

  it('turns into one enemy without yielding immediate loot', () => {
    const w = arena();
    const t = w.frontTile();
    w.floor.props.push({ id: 'bait', kind: 'chest', x: t.x, y: t.y, used: false, tier: 'vault', blocking: true, mimic: true });
    const gold = w.run.gold;
    const pickups = w.floor.pickups.length;

    w.interact();

    expect(w.floor.props.some((p) => p.id === 'bait')).toBe(false);
    expect(w.floor.pickups).toHaveLength(pickups);
    expect(w.run.gold).toBe(gold);
    expect(w.floor.enemies).toHaveLength(1);
    const mimic = w.floor.enemies[0];
    expect(mimic.def).toBe('mimic');
    expect(mimic.ai).toBe('recover');
    expect(mimic.alert).toBeGreaterThan(0);
    expect(mimic.maxHp).toBe(enemyDef('mimic').hp);
    expect(mimic.mimicTier).toBe('vault');

    w.interact();
    expect(w.floor.enemies).toHaveLength(1);
  });

  it('releases the disguised chest tier when slain', () => {
    const w = arena(72);
    const t = w.frontTile();
    w.floor.props.push({ id: 'hoard', kind: 'chest', x: t.x, y: t.y, used: false, tier: 'secret', blocking: true, mimic: true });
    w.interact();
    const mimic = w.floor.enemies[0];

    (w as unknown as { killEnemy(e: typeof mimic): void }).killEnemy(mimic);

    expect(w.run.stats.kills).toBe(1);
    const loot = w.floor.pickups.find((p) => p.x === t.x && p.y === t.y);
    expect(loot).toBeDefined();
    expect(loot!.gold).toBeGreaterThan(0);
    expect(loot!.items.length).toBeGreaterThan(0);
  });

  it('grabs whoever opens it and lands one bite nothing can refuse', () => {
    const w = arena(73);
    const t = w.frontTile();
    w.floor.props.push({ id: 'jaws', kind: 'chest', x: t.x, y: t.y, used: false, tier: 'chest', blocking: true, mimic: true });
    const hp = w.player.hp;

    w.interact();
    const mimic = w.floor.enemies[0];
    expect(mimic.grabT).toBeGreaterThan(0);
    expect(w.anim.stunT).toBeGreaterThan(mimic.grabT!);
    // Guard up and parry grace running: neither saves you from inside it.
    w.setBlock(true);
    w.anim.blockRaise = 1;
    w.anim.parryInvulnT = 5;
    expect(w.sipFlask()).toBe(false);

    for (let i = 0; i < 25 && (mimic.grabT ?? 0) > 0; i++) w.update(0.05);

    expect(mimic.grabT).toBeUndefined();
    expect(w.player.hp).toBeLessThan(hp);
    // Far more than an ordinary bite would take through the same armour.
    expect(hp - w.player.hp).toBeGreaterThan(30);
  });

  it('only wakes when struck: it rises at full health and cannot grab', () => {
    const w = arena(74);
    const t = w.frontTile();
    w.floor.props.push({ id: 'lurker', kind: 'chest', x: t.x, y: t.y, used: false, tier: 'chest', blocking: true, mimic: true });

    (w as unknown as { resolvePlayerAttack(): void }).resolvePlayerAttack();

    expect(w.floor.props.some((p) => p.id === 'lurker')).toBe(false);
    const mimic = w.floor.enemies[0];
    expect(mimic.def).toBe('mimic');
    expect(mimic.hp).toBe(mimic.maxHp);
    expect(mimic.grabT).toBeUndefined();
    expect(w.anim.stunT).toBe(0);
  });

  it('turns the blow off an honest chest and leaves it shut', () => {
    const w = arena(75);
    const t = w.frontTile();
    w.floor.props.push({ id: 'honest', kind: 'chest', x: t.x, y: t.y, used: false, tier: 'chest', blocking: true, mimic: false });
    const pickups = w.floor.pickups.length;

    (w as unknown as { resolvePlayerAttack(): void }).resolvePlayerAttack();

    const chest = w.floor.props.find((p) => p.id === 'honest')!;
    expect(chest.used).toBe(false);
    expect(w.floor.enemies).toHaveLength(0);
    expect(w.floor.pickups).toHaveLength(pickups);
  });

  it('lab places a resting chest on the faced tile, never into a wall', () => {
    const w = arena(76);
    expect(spawnLabChest(w, true)).toBe(true);
    const t = w.frontTile();
    const chest = w.floor.props.find((p) => p.x === t.x && p.y === t.y)!;
    expect(chest).toMatchObject({ kind: 'chest', used: false, mimic: true, blocking: true });
    expect(w.floor.enemies).toHaveLength(0);
    // The chest now blocks that tile, so a second one there is refused.
    expect(spawnLabChest(w, false)).toBe(false);
  });

  it('every blow on an honest chest breaks something, fragile pieces first, and untouched keeps it all', () => {
    const strike = (w: World) => (w as unknown as { resolvePlayerAttack(): void }).resolvePlayerAttack();
    const isFragile = (i: { kind: string; ref: string }) => i.kind === 'consumable' || i.kind === 'blueprint'
      || (i.kind === 'material' && ['gem', 'valuable'].includes(findMaterial(i.ref)?.category ?? ''));
    const units = (items: { kind: string; ref: string; qty: number }[], f: (i: { kind: string; ref: string }) => boolean) =>
      items.filter(f).reduce((n, i) => n + i.qty, 0);
    const open = (seed: number, blows: number) => {
      const w = arena(seed);
      const t = w.frontTile();
      w.floor.props.push({ id: 'box', kind: 'chest', x: t.x, y: t.y, used: false, tier: 'vault', blocking: true, mimic: false });
      for (let i = 0; i < blows; i++) strike(w);
      const box = w.floor.props.find((p) => p.id === 'box')!;
      const gold = w.run.gold;
      w.interact();
      const pile = w.floor.pickups.find((pk) => pk.x === t.x && pk.y === t.y);
      return { box, items: pile?.items ?? [], gold: w.run.gold - gold };
    };
    let checked = 0;
    for (let seed = 80; seed < 120 && checked < 3; seed++) {
      const whole = open(seed, 0);
      const fragile = units(whole.items, isFragile);
      if (fragile < 2) continue;
      // The short sword is neither blunt nor two-handed: exactly one loss per blow.
      const hit = open(seed, 2);
      expect(hit.box.used).toBe(true);
      expect(hit.box.shattered).toBe(2);
      expect(units(hit.items, isFragile)).toBe(fragile - 2);
      expect(units(hit.items, (i) => !isFragile(i))).toBe(units(whole.items, (i) => !isFragile(i)));
      expect(hit.gold).toBe(whole.gold);
      checked++;
    }
    expect(checked).toBe(3);
  });

  it('keeps costing once the chest has nothing fragile left: materials, then gear, then coin', () => {
    const w = arena(81);
    const t = w.frontTile();
    w.floor.props.push({ id: 'box', kind: 'chest', x: t.x, y: t.y, used: false, tier: 'chest', blocking: true, mimic: false });
    const clean = arena(81);
    clean.floor.props.push({ id: 'box', kind: 'chest', x: t.x, y: t.y, used: false, tier: 'chest', blocking: true, mimic: false });
    const before = clean.run.gold;
    clean.interact();
    const wholeGold = clean.run.gold - before;

    // Far more blows than the chest has pieces: everything goes, then the coin bleeds.
    for (let i = 0; i < 40; i++) (w as unknown as { resolvePlayerAttack(): void }).resolvePlayerAttack();
    const g = w.run.gold;
    w.interact();
    const left = w.floor.pickups.find((pk) => pk.x === t.x && pk.y === t.y)?.items ?? [];
    expect(left.filter((i) => i.kind !== 'equipment')).toHaveLength(0);
    for (const it of left) expect(durability(it).cur).toBe(0);
    expect(w.run.gold - g).toBeLessThan(wholeGold);
  });

  it('clangs: striking a chest wakes what is near and not what is far', () => {
    const w = arena(77);
    const t = w.frontTile();
    w.floor.props.push({ id: 'loud', kind: 'chest', x: t.x, y: t.y, used: false, tier: 'chest', blocking: true, mimic: false });
    const near = { ...createEnemyAt(w, 3) };
    const far = { ...createEnemyAt(w, 20) };
    w.floor.enemies = [near, far];

    (w as unknown as { resolvePlayerAttack(): void }).resolvePlayerAttack();

    expect(near.alert).toBeGreaterThan(0);
    expect([near.lastSeenX, near.lastSeenY]).toEqual([w.player.x, w.player.y]);
    expect(far.alert).toBe(0);
  });

  it('an opened chest breaks in one blow and stops blocking, quietly', () => {
    const w = arena(78);
    const t = w.frontTile();
    w.floor.props.push({ id: 'done', kind: 'chest', x: t.x, y: t.y, used: false, tier: 'chest', blocking: true, mimic: false });
    const strike = () => (w as unknown as { resolvePlayerAttack(): void }).resolvePlayerAttack();

    strike();
    const box = w.floor.props.find((p) => p.id === 'done')!;
    expect(box.smashed).toBeUndefined();
    expect(blocksMove(w.floor, t.x, t.y)).toBe(true);

    w.interact();
    const pile = w.floor.pickups.find((pk) => pk.x === t.x && pk.y === t.y);
    const near = createEnemyAt(w, 3);
    w.floor.enemies = [near];
    strike();

    expect(box.smashed).toBe(true);
    expect(blocksMove(w.floor, t.x, t.y)).toBe(false);
    expect(near.alert).toBe(0);
    expect(w.floor.pickups.find((pk) => pk.x === t.x && pk.y === t.y)).toBe(pile);
  });

  it('a chest set down on splinters can still be struck, opened and walked into', () => {
    const w = arena(79);
    const t = w.frontTile();
    w.floor.props.push({ id: 'old', kind: 'chest', x: t.x, y: t.y, used: true, tier: 'chest', blocking: true, mimic: false, smashed: true });
    expect(blocksMove(w.floor, t.x, t.y)).toBe(false);

    expect(spawnLabChest(w, false)).toBe(true);
    const fresh = w.floor.props[w.floor.props.length - 1];
    expect(propAt(w.floor, t.x, t.y)).toBe(fresh);
    expect(blocksMove(w.floor, t.x, t.y)).toBe(true);
    expect(w.interactionHint()).toBe('Open chest');

    w.interact();
    expect(fresh.used).toBe(true);
  });
});

function createEnemyAt(w: World, dist: number) {
  const e = createEnemy(enemyDef('skeleton'), w.player.x + dist, w.player.y, 0, `e${dist}`, 1);
  e.alert = 0;
  return e;
}
