/**
 * Dev-only: a combat lab for weapon feel and mob configurations.
 *
 * Reached with `?autostart=lab` or the "Lab" button on the title screen.
 * Same contract as `./boss-arena`: only ever imported behind an
 * `import.meta.env.DEV` guard, so the dynamic import is dropped and none of
 * this reaches a production bundle. Runs on a throwaway game (`devScratch`)
 * that is never saved.
 *
 * What you get:
 * - every recipe unlocked at Rank 5 (all blueprints mastered)
 * - 999 of every material in the stash (town forge), so crafting is free
 * - one of every weapon in the pack, Epic ilvl 16, plus a sane kit equipped
 * - a cleared room to fight in, with a floating panel (`./lab-panel`) to
 *   spawn mobs on command, hand yourself weapons, heal, repair and clear
 * - inventory works as normal in the dungeon (I / Tab); the forge itself is
 *   town-side, and recall scrolls are in the pack for going back to craft
 */
import { PROPERTY_IDS } from '../data/properties';
import { GameState } from '../state/game-state';
import { emptyEquipment } from '../systems/player';
import { makeConsumable, makeEquipment, makeMaterial, repairItem, thrownCapacity } from '../systems/items';
import { addItem } from '../state/inventory';
import { syncLoadout } from '../systems/run';
import { Rarity } from '../types';
import { World } from '../world/world';
import { quirkDef } from '../data/quirks';
import { dressFloor } from '../systems/quirks';
import { ITEM_BASES } from '../data/items';
import { MATERIALS } from '../data/materials';
import { MAX_RECIPE_RANK, RECIPES } from '../data/recipes';
import { META_UPGRADES } from '../systems/meta';
import { enemyDef } from '../data/enemies';
import { blocksMove, createEnemy, doorAt, enemyAt, generateFloor, promoteElite, stairsAt } from '../systems/dungeon';
import { EliteTrait, eligibleTraits } from '../data/elites';
import { BIOMES, biomeForDepth } from '../data/biomes';
import { hashString } from '../core/rng';
import { Dir } from '../core/dir';
import { biggestRoom, clearRoom, face } from './squad-room';
import { LabMobEntry } from './lab-configs';

export const LAB_ILVL = 16;
export const LAB_MATS_QTY = 999;

function bestMaterialFor(baseId: string): string {
  const base = ITEM_BASES.find((b) => b.id === baseId);
  if (!base) return 'iron';
  const mat = MATERIALS
    .filter((m) => (base.primary as string[]).includes(m.category))
    .sort((a, b) => b.tier - a.tier || b.value - a.value)[0];
  return mat?.id ?? 'iron';
}

/** Kit the character out and fill every bag, before the run starts. */
export function prepare(state: GameState): void {
  // All blueprints unlocked and mastered.
  for (const r of RECIPES) state.recipeRanks[r.id] = MAX_RECIPE_RANK;

  // Maxed warden upgrades: biggest pack, most health/stamina to play with.
  for (const u of META_UPGRADES) state.meta[u.id] = u.costs.length;
  state.gold = 999999;
  state.renown = 999;

  // All sigils inscribed and attuned, with spares for the forge bench.
  state.spells = ['wardcry', 'snuff', 'sounding', 'threshold', 'temper'];
  // Every build property learned, so the Inscribe bench can be tried without keeping an oath.
  state.properties = [...PROPERTY_IDS];
  state.attuned = 'wardcry';

  // 999 of everything in the stash (unlimited, so it fits). The forge is
  // town-side, so this is where crafting draws from — go back through a
  // recall scroll whenever you want to smith something new.
  for (const m of MATERIALS) addItem(state.stash, makeMaterial(m.id, LAB_MATS_QTY));
  // One of every gear piece in the stash too, for outfitting via town.
  for (const base of ITEM_BASES) {
    addItem(state.stash, makeEquipment({
      baseId: base.id, materialId: bestMaterialFor(base.id),
      rarity: Rarity.Epic, ilvl: LAB_ILVL, quality: 1, identified: true,
    }));
  }

  // A sane kit equipped through direct assignment (dev scratch game only).
  const e = emptyEquipment();
  e.weapon = makeEquipment({ baseId: 'long_sword', materialId: 'moonsilver', rarity: Rarity.Epic, ilvl: LAB_ILVL, identified: true });
  e.offhand = makeEquipment({ baseId: 'tower_shield', materialId: 'moonsilver', rarity: Rarity.Epic, ilvl: LAB_ILVL, identified: true });
  e.body = makeEquipment({ baseId: 'plate', materialId: 'moonsilver', rarity: Rarity.Epic, ilvl: LAB_ILVL, identified: true });
  e.head = makeEquipment({ baseId: 'great_helm', materialId: 'moonsilver', rarity: Rarity.Epic, ilvl: LAB_ILVL, identified: true });
  e.hands = makeEquipment({ baseId: 'gauntlets', materialId: 'moonsilver', rarity: Rarity.Epic, ilvl: LAB_ILVL, identified: true });
  state.equipment = e;

  // One of every weapon in the loadout so it rides into the dungeon pack:
  // this is the weapon-feel rack. Swap with I (inventory) at any time.
  const pack = syncLoadout(state);
  for (const base of ITEM_BASES) {
    if (base.slot !== 'weapon' && base.slot !== 'thrown') continue;
    addItem(pack, makeEquipment({
      baseId: base.id, materialId: bestMaterialFor(base.id),
      rarity: Rarity.Epic, ilvl: LAB_ILVL, quality: 1, identified: true,
    }));
  }
  addItem(pack, makeConsumable('greater_healing', 5));
  addItem(pack, makeConsumable('scroll_recall', 3));
  addItem(pack, makeConsumable('scroll_identify', 3));
}

/**
 * Clear the biggest ordinary room on this floor and stand the player in its
 * middle. No enemies to start with — the panel spawns them on command.
 */
export function dropIntoLab(world: World): string {
  const f = world.floor;
  const room = biggestRoom(f);
  if (!room) return 'no ordinary room on this floor';
  clearRoom(f, room);

  const free: Array<{ x: number; y: number }> = [];
  for (let dy = 1; dy < room.h - 1; dy++) {
    for (let dx = 1; dx < room.w - 1; dx++) {
      const x = room.x + dx, y = room.y + dy;
      if (blocksMove(f, x, y)) continue;
      free.push({ x, y });
    }
  }
  if (!free.length) return 'no free tile in the lab';
  const cx = room.x + room.w / 2, cy = room.y + room.h / 2;
  const spot = [...free].sort((a, b) => Math.abs(a.x - cx) + Math.abs(a.y - cy) - (Math.abs(b.x - cx) + Math.abs(b.y - cy)))[0];
  world.placePlayer(spot.x, spot.y, world.player.facing);
  // Thrown belts equipped mid-run miss the delve-start stock fill; top up.
  world.run.thrown ??= { held: {}, retrieveCd: 0 };
  for (const base of ITEM_BASES) {
    if (!base.thrown) continue;
    const probe = makeEquipment({ baseId: base.id, materialId: bestMaterialFor(base.id), rarity: Rarity.Epic, ilvl: LAB_ILVL });
    if (world.run.thrown.held[base.id] === undefined) world.run.thrown.held[base.id] = thrownCapacity(probe);
  }
  world.player.hp = world.derived.maxHp;
  world.player.stamina = world.derived.maxStamina;
  world.refreshDerived();
  world.player.hp = world.derived.maxHp;
  return `${room.w - 2}×${room.h - 2} cleared stage`;
}

export interface LabSpawnOpts {
  count?: number;
  /** Tiles off the player to aim for; melee crowds, ranged keeps distance. */
  spacing?: 'near' | 'ranged';
  /** 'alert' = aware of you; 'windup' = already mid-swing. */
  prime?: 'alert' | 'windup';
  /** Promote each spawn to this elite trait. */
  elite?: EliteTrait;
}

/**
 * Spawn `count` copies of `id` on free tiles around the player, facing them.
 * Returns how many actually spawned (room may be full).
 */
export function spawnLabMob(world: World, id: string, opts: LabSpawnOpts = {}): number {
  const def = enemyDef(id);
  const count = Math.max(1, Math.min(20, Math.floor(opts.count ?? 1)));
  const wantDist = opts.spacing === 'ranged' ? 4 : 1;
  const f = world.floor;
  const occupied = new Set(f.enemies.filter((e) => e.ai !== 'dead').map((e) => `${e.x},${e.y}`));
  occupied.add(`${world.player.x},${world.player.y}`);
  const px = world.player.x, py = world.player.y;
  const cands: Array<{ x: number; y: number; d: number }> = [];
  // Search a widening box around the player for walkable, unoccupied tiles.
  for (let r = 1; r <= 12 && cands.length < count * 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = px + dx, y = py + dy;
        if (x < 0 || y < 0 || x >= f.width || y >= f.height) continue;
        if (blocksMove(f, x, y) || occupied.has(`${x},${y}`)) continue;
        cands.push({ x, y, d: Math.abs(dx) + Math.abs(dy) });
      }
    }
  }
  cands.sort((a, b) => Math.abs(a.d - wantDist) - Math.abs(b.d - wantDist));
  let n = 0;
  for (const c of cands.slice(0, count)) {
    const e = createEnemy(def, c.x, c.y, face(c.x, c.y, px, py, Dir.N), `lab:${id}:${Date.now().toString(36)}:${n}`, world.run.depth);
    e.alert = 6;
    e.lastSeenX = px;
    e.lastSeenY = py;
    if (opts.elite && eligibleTraits(def).includes(opts.elite)) promoteElite(e, opts.elite);
    if (opts.prime === 'windup') {
      e.ai = 'windup';
      e.timer = 0.12;
    }
    f.enemies.push(e);
    occupied.add(`${c.x},${c.y}`);
    n++;
  }
  return n;
}

/** Remove every living enemy on this floor. Returns how many were cleared. */
export function clearLabMobs(world: World): number {  const live = world.floor.enemies.filter((e) => e.ai !== 'dead');
  world.floor.enemies = world.floor.enemies.filter((e) => e.ai === 'dead');
  world.projectiles.length = 0;
  return live.length;
}

/** Kill every living enemy on this floor (lets loot/xp flow). Returns count. */
export function killLabMobs(world: World): number {
  let n = 0;
  for (const e of world.floor.enemies) {
    if (e.ai === 'dead') continue;
    e.hp = 0;
    e.ai = 'dead';
    n++;
  }
  world.projectiles.length = 0;
  return n;
}

/**
 * Put a closed chest, at rest, on the tile you face: a mimic to test the grab
 * (open it) and the reveal (strike it), or an honest one to test the glance.
 * Returns false if that tile is not open floor.
 */
export function spawnLabChest(world: World, mimic: boolean): boolean {
  const f = world.floor;
  const { x, y } = world.frontTile();
  if (x < 0 || y < 0 || x >= f.width || y >= f.height) return false;
  if (blocksMove(f, x, y) || enemyAt(f, x, y) || doorAt(f, x, y) || stairsAt(f, x, y)) return false;
  f.pickups = f.pickups.filter((pk) => pk.x !== x || pk.y !== y);
  f.props.push({
    id: `labchest:${Date.now().toString(36)}`, kind: 'chest', x, y,
    used: false, tier: 'chest', blocking: true, mimic,
  });
  return true;
}

/** Spawn every entry of a config. Returns the total actually spawned. */
export function spawnLabConfig(world: World, entries: LabMobEntry[]): number {
  let n = 0;
  for (const e of entries) n += spawnLabMob(world, e.id, { count: e.count, spacing: e.spacing, prime: e.prime });
  return n;
}

/** Top every material in the stash back up to lab quantity (forge fuel). */
export function restockLabMats(state: GameState): void {
  for (const m of MATERIALS) {
    let owned = 0;
    for (const it of state.stash.items) if (it.kind === 'material' && it.ref === m.id) owned += it.qty;
    if (owned < LAB_MATS_QTY) addItem(state.stash, makeMaterial(m.id, LAB_MATS_QTY - owned));
  }
}

/** Full heal + stamina + repair everything worn and carried. */
export function refurbish(world: World): void {
  for (const slot of Object.keys(world.state.equipment) as (keyof typeof world.state.equipment)[]) {
    const it = world.state.equipment[slot];
    if (it) repairItem(it);
  }
  for (const it of world.run.backpack.items) if (it.kind === 'equipment') repairItem(it);
  world.refreshDerived();
  world.player.hp = world.derived.maxHp;
  world.player.stamina = world.derived.maxStamina;
  // Top up thrown stocks.
  world.run.thrown ??= { held: {}, retrieveCd: 0 };
  for (const base of ITEM_BASES) {
    if (!base.thrown) continue;
    const probe = makeEquipment({ baseId: base.id, materialId: bestMaterialFor(base.id), rarity: Rarity.Epic, ilvl: LAB_ILVL });
    world.run.thrown.held[base.id] = thrownCapacity(probe);
  }
}

/** Pick a seed that naturally generates the requested biome, including its residents. */
/**
 * Load a map into the lab.
 *
 * `quirk` forces a strange floor rather than waiting on its 5–9.5% roll, which
 * is the only practical way to look at one: the natural path is to delve until
 * the dungeon decides, and that is the right experience for a player and a
 * useless one for whoever is tuning the thing. Passing `'none'` (or nothing)
 * loads an ordinary floor.
 */
export function loadLabLevel(world: World, biomeId: string, depth: number, seed: number, quirk?: string): string {
  const biome = BIOMES.find((b) => b.id === biomeId);
  if (!biome || !biome.depths.includes(depth) || !Number.isInteger(seed)) throw new Error('Invalid lab map selection');
  let mapSeed = seed >>> 0;
  while (biomeForDepth(depth, hashString(`floor:${mapSeed}:${depth}`)).id !== biomeId) mapSeed = (mapSeed + 1) >>> 0;
  const floor = generateFloor(mapSeed, depth, world.difficultyId);
  const forced = quirk && quirk !== 'none' ? quirkDef(quirk) : null;
  if (forced) dressFloor(floor, forced.id, mapSeed, world.difficultyId);
  // Use normal transitions for projectile recovery, path-cache cleanup and renderer events.
  if (world.run.depth === depth) world.changeFloorForTest(depth === 1 ? 'down' : 'up');
  world.run.floors[depth - 1] = floor;
  while (world.run.depth !== depth) world.changeFloorForTest(world.run.depth < depth ? 'down' : 'up');
  world.anim.transition = null;
  world.anim.recall = null;
  world.anim.cast = null;
  const stage = dropIntoLab(world);
  const dressed = forced ? ` · ${forced.name}` : '';
  return `${biome.name} · depth ${depth} · seed ${seed}${dressed}: ${stage}`;
}
