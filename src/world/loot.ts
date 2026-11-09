/**
 * Loot and the things that hold it: drops and loose pickups, chests and
 * urns (their rolls, dents, clang and spill), mimics waking and biting, and
 * props breaking. Sigil and tome drops roll here too.
 */
import { DIRS, DX, DY, turnAround } from '../core/dir';
import { gold } from '../core/format';
import { manhattan } from '../core/math';
import { createRng, hashString, Rng } from '../core/rng';
import { biomeForFloor } from '../data/biomes';
import { enemyDef } from '../data/enemies';
import { consumable } from '../data/items';
import { LAWS, ROOT_CACHE_LURE } from '../data/laws';
import { findMaterial } from '../data/materials';
import { sigil } from '../data/spells';
import { bestiaryEntry } from '../systems/bestiary';
import { makeTome, unknownConduitSpells } from '../systems/conduits';
import { attackPower, blocksMove, createEnemy, EnemyState, Pickup, portalAt, Prop } from '../systems/dungeon';
import { ContainerTier, durability, isIdentified, itemName, LootRoll, rollContainerLoot, uniqueOf } from '../systems/items';
import { nameRelic } from '../systems/relics';
import { makeSigil, unknownSigils } from '../systems/spells';
import { Item } from '../types';
import * as Hazards from './hazards';
import * as Boss from './boss';
import * as Combat from './combat';
import * as EnemyAi from './enemy-ai';
import type { World } from './world';

export const MIMIC_BITE = 2.5;

/**
 * Striking a chest is a test, and it is never free. Every blow on an honest
 * chest breaks one thing inside (see chestLoot for the order), and a blunt or
 * two-handed weapon has CHEST_SHATTER_HEAVY_EXTRA odds of breaking a second.
 * The clang carries too, waking anything within CHEST_CLANG_RADIUS tiles. A
 * player who reads the lid tell and just opens it keeps everything and stays
 * quiet.
 */
export const CHEST_SHATTER_HEAVY_EXTRA = 0.55;

/** Share of a gear piece's max durability one blow knocks off, once nothing smaller is left to break. */
export const CHEST_DENT = 0.4;

/** Share of the remaining coin one blow spills, once there is nothing else. */
export const CHEST_SPILL = 0.25;

export const CHEST_CLANG_RADIUS = 7;

/** Compact button label for an interaction hint. */
/** What a blow on a chest breaks first: gems, valuables, and anything in a flask or on a page. */
export function fragileLoot(it: Item): boolean {
  if (it.kind === 'consumable' || it.kind === 'blueprint') return true;
  if (it.kind !== 'material') return false;
  const cat = findMaterial(it.ref)?.category;
  return cat === 'gem' || cat === 'valuable';
}

/**
 * A walkable tile next to (x, y) — never the tile itself, since something is
 * about to be put there that would cover a loot pile. Falls back to (x, y).
 */
export function freeTileNear(w: World, x: number, y: number): { x: number; y: number } {
  const f = w.floor;
  const ok = (tx: number, ty: number) =>
    !blocksMove(f, tx, ty) && !portalAt(f, tx, ty);
  for (const d of DIRS) {
    const tx = x + DX[d], ty = y + DY[d];
    if (ok(tx, ty)) return { x: tx, y: ty };
  }
  return { x, y };
}

/** A container's loot, rolled with this run's depth, find and unlocks. */
export function containerLoot(w: World, rng: Rng, tier: ContainerTier): LootRoll {
  return rollContainerLoot(rng, w.run.depth, w.lootFind, tier, w.identifyBelow, w.state.recipeRanks, w.seenUniques, w.difficultyId);
}

/**
 * A spell tome, rolled where sigil stones roll but on its own `tome:` stream,
 * so adding tomes moved no chest's existing contents. Never one you know or
 * are already carrying anywhere, the same rule as a stone.
 */
export function rollTome(w: World, stream: string, chance: number): Item | null {
  const carried = [
    ...w.state.stash.items,
    ...w.state.loadout.items,
    ...w.run.backpack.items,
    ...w.run.floors.flatMap((f) => f?.pickups.flatMap((p) => p.items) ?? []),
  ].filter((i) => i.kind === 'tome').map((i) => i.ref);
  const unknown = unknownConduitSpells(w.state.spellbook ?? [], carried);
  if (!unknown.length) return null;
  const rng = createRng(hashString(`tome:${w.run.seed}:${w.run.depth}:${stream}`));
  return rng.chance(chance) ? makeTome(rng.pick(unknown)) : null;
}

export function rollSigil(w: World, stream: string, chance: number): Item | null {
  const carried = [
    ...w.state.stash.items,
    ...w.state.loadout.items,
    ...w.run.backpack.items,
    ...w.run.floors.flatMap((f) => f?.pickups.flatMap((p) => p.items) ?? []),
  ].filter((i) => i.kind === 'sigil').map((i) => i.ref);
  // Temper mends worn gear, and on Normal nothing wears: it never drops there.
  const unknown = unknownSigils(w.state.spells ?? [], carried).filter((id) => w.diff.gearWears || id !== 'temper');
  if (!unknown.length) return null;
  const rng = createRng(hashString(`sigil:${w.run.seed}:${w.run.depth}:${stream}`));
  return rng.chance(chance) ? makeSigil(rng.pick(unknown)) : null;
}

/**
 * Note a relic that has just come into your hands. Recorded on pickup rather
 * than on drop: leaving it on the floor or dying on the way out means you
 * never held it, and the King's promise reads this list.
 *
 * Naming it is a second step that waits for identification, so the codex
 * never tells you what the unappraised lump in your pack is.
 */
export function recordUnique(w: World, item: Item): void {
  const u = uniqueOf(item);
  if (!u) return;
  const seen = w.seenUniques;
  if (!seen.includes(u.id)) seen.push(u.id);
  if (!isIdentified(item)) return;
  if (nameRelic(w.knownUniques, u.id)) {
    w.msg(`${u.name}. The codex has a page for it now.`, '#e8b84a');
  }
}

export function dropLoot(w: World, x: number, y: number, items: Item[], gold: number): Pickup | null {
  if (!items.length && gold <= 0) return null;
  const f = w.floor;
  let pk = f.pickups.find((p) => p.x === x && p.y === y);
  if (!pk) {
    pk = { id: `d${Math.floor(w.time * 1000)}_${x}_${y}`, x, y, items: [], gold: 0 };
    f.pickups.push(pk);
  }
  pk.items.push(...items);
  pk.gold += gold;
  // Standing on it already? Grab the coin.
  if (x === w.player.x && y === w.player.y) collectLoose(w, pk);
  return pk;
}

export function propRng(w: World, p: Prop): Rng {
  return createRng(hashString(`${w.floor.seed}:${p.id}`));
}

/**
 * What a chest holds, less whatever blows have already broken inside it.
 * Each recorded blow takes one thing, worst first: a fragile piece (gem,
 * valuable, consumable, blueprint), then a unit of material, then a dent in
 * the gear, and once nothing else is left, a quarter of the coin.
 */
export function chestLoot(w: World, p: Prop, tier: ContainerTier): { items: Item[]; gold: number; lost: string[] } {
  const loot = containerLoot(w, propRng(w, p), tier);
  // Its own stream, so which piece broke never moves the loot roll itself.
  const pick = createRng(hashString(`chest-shatter:${w.floor.seed}:${p.id}`));
  const lost: string[] = [];
  const takeOne = (it: Item) => {
    lost.push(itemName(it));
    it.qty -= 1;
    if (it.qty <= 0) loot.items.splice(loot.items.indexOf(it), 1);
  };
  for (let n = p.shattered ?? 0; n > 0; n--) {
    const fragile = loot.items.filter(fragileLoot);
    if (fragile.length) { takeOne(pick.pick(fragile)); continue; }
    const mats = loot.items.filter((it) => it.kind === 'material');
    if (mats.length) { takeOne(pick.pick(mats)); continue; }
    // Where nothing wears, a blow dents nothing either: it spills coin instead.
    const gear = w.diff.gearWears ? loot.items.filter((it) => it.kind === 'equipment' && durability(it).wears && durability(it).cur > 0) : [];
    if (gear.length) {
      const it = pick.pick(gear);
      const d = durability(it);
      it.dur = Math.max(0, d.cur - Math.ceil(d.max * CHEST_DENT));
      lost.push(`dent:${itemName(it)}`);
      continue;
    }
    if (loot.gold > 0) {
      const spilt = Math.max(1, Math.round(loot.gold * CHEST_SPILL));
      loot.gold -= spilt;
      lost.push(`${spilt} gold`);
    }
  }
  return { ...loot, lost };
}

/** Record what one blow on an honest chest breaks inside it: always one thing, sometimes two. */
export function shatterInChest(w: World, p: Prop): void {
  const heavy = w.derived.twoHanded || w.derived.damageType === 'blunt';
  const struck = createRng(hashString(`chest-strike:${w.floor.seed}:${p.id}:${w.chestBlows++}`));
  p.shattered = (p.shattered ?? 0) + (heavy && struck.chance(CHEST_SHATTER_HEAVY_EXTRA) ? 2 : 1);
}

/** Iron on iron carries: anything near enough comes to see what it was. */
export function chestClang(w: World, p: Prop): void {
  let woken = 0;
  for (const e of w.floor.enemies) {
    if (e.ai === 'dead' || Boss.protectedByFog(w, e)) continue;
    if (manhattan(e.x, e.y, p.x, p.y) > EnemyAi.noise(w, CHEST_CLANG_RADIUS)) continue;
    if (e.alert <= 0) woken++;
    e.alert = Math.max(e.alert, 6);
    e.lastSeenX = w.player.x;
    e.lastSeenY = w.player.y;
  }
  if (woken) w.msg('The clang echoes down the halls. Something heard it.', '#ff9070');
}

/** Swap a disguised chest for the mimic inside it, holding the chest's reward. */
export function wakeMimic(w: World, p: Prop, rise: number): EnemyState {
  const f = w.floor;
  f.props = f.props.filter((q) => q !== p);
  const mimic = createEnemy(enemyDef('mimic'), p.x, p.y, turnAround(w.player.facing), `mimic:${p.id}`, w.run.depth, w.difficultyId);
  mimic.ai = 'recover';
  mimic.timer = rise;
  mimic.alert = 6;
  mimic.lastSeenX = w.player.x;
  mimic.lastSeenY = w.player.y;
  mimic.mimicTier = p.tier === 'none' ? 'chest' : p.tier;
  mimic.mimicPropId = p.id;
  f.enemies.push(mimic);
  return mimic;
}

/**
 * The held bite of a mimic you opened: nothing refuses it but armour.
 *
 * The first bite a save ever takes never kills, on any difficulty. Nothing
 * can be answered once the lid is up, so a death there teaches nothing; a
 * bite that leaves you on 1 health and names the tells teaches the chest.
 * "Ever" is the codex's worst hit from a mimic, so it needs no save field.
 */
export function mimicBite(w: World, e: EnemyState): void {
  const def = Combat.view(w, e);
  w.sfx('swing', e.x, e.y);
  e.strikeT = 0;
  const was = bestiaryEntry(w.state.bestiary, def.id);
  const first = was.worstHit === 0 && was.deaths === 0;
  Combat.damagePlayer(w, 
    Math.max(1, Math.round(def.attack * MIMIC_BITE * attackPower(e.power) * w.diff.enemyDamage * w.diff.mimicBite)),
    def.damageType, e.x, e.y, def.name, def.id, e, true, w.diff.mimicMercy || first,
  );
  if (w.run.outcome !== 'active') return;
  w.msg('It chews, then spits you out. Get up!', '#ff9070');
  if (first) w.msg('That was no chest. A mimic breathes when you watch it, and shows two pale points in its lid seam; strike a chest you doubt before you open it.', '#ffd080');
}

export function breakProp(w: World, p: Prop): void {
  if (p.oil) {
    Hazards.spillBarrel(w, p);
    return;
  }
  p.used = true;
  w.sfx('break', p.x, p.y);
  // Burrows: the crack of old roots is a lure. What hears it comes to the
  // cache, not to you — so break it and be somewhere else.
  if (p.kind === 'root_cache' && biomeForFloor(w.floor).law === 'noise') {
    let drawn = 0;
    for (const e of w.floor.enemies) {
      if (e.ai === 'dead' || e.lurk || manhattan(e.x, e.y, p.x, p.y) > ROOT_CACHE_LURE) continue;
      e.alert = Math.max(e.alert, 8);
      e.lastSeenX = p.x;
      e.lastSeenY = p.y;
      drawn++;
    }
    w.msg(drawn ? 'The roots crack like a shot. Something skitters towards the sound.' : 'The roots crack like a shot. Nothing answers.', LAWS.noise.color);
  }
  const loot = containerLoot(w, propRng(w, p), 'urn');
  dropLoot(w, p.x, p.y, loot.items, loot.gold);
}

export function collectLoose(w: World, pk: Pickup): void {
  if (pk.gold > 0) {
    w.run.gold += pk.gold;
    w.run.stats.goldFound += pk.gold;
    w.emit({ type: 'float', x: pk.x, y: pk.y, text: `+${gold(pk.gold)}`, color: '#ffd24a' });
    w.msg(`Picked up ${pk.gold} gold.`, '#ffd24a');
    w.sfx('gold');
    pk.gold = 0;
  }
  if (pk.keyId) {
    const key = w.floor.keys.find((k) => k.id === pk.keyId);
    w.run.keys.push(pk.keyId);
    w.msg(`Found the ${key?.name ?? 'key'}.`, '#ffe08a');
    w.sfx('unlock');
    pk.keyId = undefined;
  }
  prunePickups(w);
}

export function prunePickups(w: World): void {
  w.floor.pickups = w.floor.pickups.filter((q) => q.items.length > 0 || q.gold > 0 || q.keyId || q.flaskShard);
}
