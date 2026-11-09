/**
 * Thrown weapons: the belt's stock, throws in flight and where they land,
 * the wear on them, and Retrieval calling the shafts back to your hand.
 * hurl and retrieve on World are the entry points; World.update calls
 * updateRetrieve once a tick.
 */
import { DX, DY } from '../core/dir';
import { itemBase } from '../data/items';
import { RETRIEVAL_MULT } from '../data/properties';
import { recordDamageDealt } from '../systems/bestiary';
import { playerHitsEnemy } from '../systems/combat';
import { defensePower, EnemyState } from '../systems/dungeon';
import { wearItem } from '../systems/items';
import { thrownView } from '../systems/player';
import * as Hazards from './hazards';
import * as Boss from './boss';
import type { World } from './world';
import { Projectile, RETRIEVE_PER_SHAFT } from './world';
import * as Combat from './combat';

/** Tiles per second a called shaft travels on its way back to your hand. */
export const RETURN_SPEED = 11;

// Fog fully hides the dungeon at 18 world units (nine two-unit tiles).
export const RETURN_VISIBLE_TILES = 9;

export const RETURN_LOCAL_TILES = 2;

export function ensureThrownStock(w: World): void {
  const base = w.state.equipment.thrown?.ref;
  if (!base || !w.derived.thrown) return;
  w.run.thrown ??= { held: {}, retrieveCd: 0 };
  w.run.thrown.held ??= {};
  if (w.run.thrown.held[base] === undefined) w.run.thrown.held[base] = w.derived.thrownCapacity;
}

/** Current floor first; remote stock never needs a cross-floor projectile. */
export function retrievalStock(w: World, base: string) {
  const floors = [w.floor, ...w.run.floors.filter(f => f && f !== w.floor)];
  return floors.flatMap(floor => (floor?.thrown ?? [])
    .filter(marker => marker.base === base && marker.n > 0)
    .map(marker => ({ floor: floor!, marker })));
}

/** Shafts of this kind lying on any floor. Allocation-free: the HUD asks every frame. */
export function thrownOnFloors(w: World, base: string): number {
  let n = 0;
  for (const floor of w.run.floors) {
    if (!floor || floor === w.floor) continue;
    for (const marker of floor.thrown ?? []) if (marker.base === base && marker.n > 0) n += marker.n;
  }
  for (const marker of w.floor.thrown ?? []) if (marker.base === base && marker.n > 0) n += marker.n;
  return n;
}

export function outgoingThrows(w: World, base: string): Projectile[] {
  return w.projectiles.filter(pr => pr.thrownBase === base && !pr.returning && pr.speed > 0);
}

export function retrievableCount(w: World, base: string): number {
  const windingUp = w.anim.attackThrow && w.anim.attack === 'windup' && w.anim.attackBase === base ? 1 : 0;
  return thrownOnFloors(w, base) + outgoingThrows(w, base).length + windingUp;
}

/** One tick of the retrieval channel. */
export function updateRetrieve(w: World, dt: number): void {
  const a = w.anim;
  const r = a.retrieving;
  if (!r) return;
  // Swinging, casting and being stunned all end it; walking does not, because
  // the shafts are coming to you rather than you to them.
  const thrown = w.derived.thrown;
  if (!thrown || w.state.equipment.thrown?.ref !== r.base || (a.attack !== 'idle' && !a.attackThrow) || a.stunT > 0 || a.cast) {
    a.retrieving = null;
    return;
  }
  // The final charge is complete: keep the receiving pose until arrival.
  // Release/attack still cancels the pose without cancelling airborne shafts.
  if (r.left <= 0) return;
  r.t -= dt;
  if (r.t > 1e-9) return;
  const stock = retrievalStock(w, r.base)[0];
  const outgoing = outgoingThrows(w, r.base)[0];
  if (!stock && !outgoing) {
    // The floor ran dry without a launch spending the last of `left` — that
    // happens when shafts are picked up by walking mid-call. Walking is the
    // other cost, already paid in steps, so the call just ends: no cooldown
    // for recovering the rest on foot.
    a.retrieving = null;
    return;
  }
  // The shaft leaves the floor now and flies home; it is added to the stock
  // when it arrives, not here. Nothing is ever in limbo: it is either a
  // marker on the floor, a projectile in the air, or in your stock, and
  // stopping the call mid-flight still lets the one already airborne land.
  let fromX: number, fromY: number, otherFloor = false;
  if (stock) {
    const { marker, floor } = stock;
    marker.n--;
    floor.thrown = (floor.thrown ?? []).filter(m => m.n > 0);
    fromX = marker.x;
    fromY = marker.y;
    otherFloor = floor !== w.floor;
  } else {
    // Transfer the outgoing shaft to its return only once charging finishes.
    fromX = outgoing.x - 0.5;
    fromY = outgoing.y - 0.5;
    w.projectiles = w.projectiles.filter(pr => pr !== outgoing);
  }
  const remote = otherFloor || Math.hypot(fromX - w.player.x, fromY - w.player.y) > RETURN_VISIBLE_TILES;
  launchReturn(w, r.base,
    remote ? w.player.x + DX[w.player.facing] * RETURN_LOCAL_TILES : fromX,
    remote ? w.player.y + DY[w.player.facing] * RETURN_LOCAL_TILES : fromY);
  w.sfx('retrieve');
  r.left = retrievableCount(w, r.base);
  if (r.left <= 0) {
    r.t = 0;
    w.msg(`${itemBase(r.base).name} coming back to your hand.`, '#c8b890');
    return;
  }
  r.t += RETRIEVE_PER_SHAFT;
}

/** Send one recovered shaft flying from where it lay back to your hand. */
export function launchReturn(w: World, base: string, fromX: number, fromY: number): void {
  const thrown = w.derived.thrown;
  const dx = w.player.x - fromX, dy = w.player.y - fromY;
  const len = Math.hypot(dx, dy) || 1;
  w.projectiles.push({
    id: w.projN++,
    x: fromX + 0.5, y: fromY + 0.5,
    dx: dx / len, dy: dy / len,
    speed: RETURN_SPEED,
    // Retrieval: a shaft on its way home cuts what it passes through, for
    // half a throw — scored as a throw, off the belt, like the one that
    // sent it out. It used to carry the plain player, so a knife flying home
    // hit with your greatsword's Attack and damage type.
    damage: w.derived.traits.retrieval && thrown ? thrown.power * RETRIEVAL_MULT : 0,
    type: w.derived.thrownDamageType,
    sprite: thrown?.sprite ?? 'proj_knife',
    tileX: fromX, tileY: fromY,
    source: 'your hand',
    returning: true,
    thrownBase: base,
    player: w.derived.traits.retrieval ? thrownView(w.derived) : undefined,
    hitIds: [],
  });
}

/**
 * A called shaft has reached your hand.
 *
 * The stock is credited here rather than when it left the floor, so it is
 * never in limbo — a shaft is a marker on the floor, a projectile in the air,
 * or in your stock, and nothing can lose one in between. Stopping the call
 * still lets whatever is already airborne land.
 */
export function collectReturn(w: World, base: string): void {
  w.run.thrown ??= { held: {}, retrieveCd: 0 };
  w.run.thrown.held[base] = (w.run.thrown.held[base] ?? 0) + 1;
  w.wear('thrown');
  w.emit({ type: 'float', x: w.player.x, y: w.player.y, text: `+1`, color: '#c8b890' });
}

export function throwWeapon(w: World): void {
  const base = w.anim.attackBase;
  const snapshot = w.anim.attackSnapshot;
  const thrown = snapshot?.thrown;
  if (!base || !thrown || (w.run.thrown.held[base] ?? 0) <= 0) return;
  w.run.thrown.held[base]--;
  w.projectiles.push({
    id: w.projN++, x: w.player.x + 0.5, y: w.player.y + 0.5,
    dx: DX[w.player.facing], dy: DY[w.player.facing], speed: thrown.speed,
    damage: w.anim.attackPower * thrown.power, type: snapshot.damageType, sprite: thrown.sprite,
    tileX: w.player.x, tileY: w.player.y, source: 'your throw',
    thrownBase: base, thrownRange: thrown.range, traveled: 0, player: snapshot, weaponUid: w.anim.attackWeaponUid ?? undefined,
  });
  w.sfx('shoot');
}

export function thrownHit(w: World, pr: Projectile, e: EnemyState): void {
  if (Boss.protectedByFog(w, e)) return;
  const player = pr.player ?? w.derived;
  const def = Combat.view(w, e);
  const reaction = Combat.guardReaction(w, e, def);
  if (reaction) {
    Combat.shieldChip(w, e, def, 1, pr.damage, player);
    wearThrown(w, pr.weaponUid);
    return;
  }
  const hit = playerHitsEnemy(w.rng, player, pr.damage, def, defensePower(e.power) * w.diff.enemyDefense);
  w.hurt(e, hit.damage, hit.crit ? `${hit.damage}!` : `${hit.damage}`, hit.crit ? '#ffe040' : hit.effective === 'weak' ? '#ff9a40' : hit.effective === 'resist' ? '#9a9aa8' : '#ffffff');
  e.alert = 8;
  e.lastSeenX = w.player.x;
  e.lastSeenY = w.player.y;
  recordDamageDealt(w.state.bestiary, def.id, hit.damage);
  w.sfx(hit.crit ? 'crit' : 'hit', e.x, e.y);
  if (player.stats.leech > 0) w.heal(Math.max(1, Math.round(hit.damage * player.stats.leech / 100)), 'leech');
  wearThrown(w, pr.weaponUid);
  if (e.hp <= 0) Combat.killEnemy(w, e);
  else Hazards.slip(w, e);
}

export function landThrown(w: World, base: string, x: number, y: number): void {
  const markers = (w.floor.thrown ??= []);
  const marker = markers.find((m) => m.x === x && m.y === y && m.base === base);
  if (marker) marker.n++;
  else markers.push({ x, y, base, n: 1 });
  if (x === w.player.x && y === w.player.y) collectThrownHere(w);
}

export function wearThrown(w: World, uid: string | undefined): void {
  if (!uid) return;
  const equipped = w.state.equipment.thrown;
  if (equipped?.uid === uid) {
    w.wear('thrown');
    return;
  }
  const item = w.run.backpack.items.find((it) => it.uid === uid);
  if (item && w.diff.gearWears) wearItem(item);
}

export function collectThrownHere(w: World): number {
  const base = w.state.equipment.thrown?.ref;
  if (!base || !w.derived.thrown) return 0;
  const markers = (w.floor.thrown ??= []);
  let found = 0;
  w.floor.thrown = markers.filter((m) => {
    if (m.base !== base || m.x !== w.player.x || m.y !== w.player.y) return true;
    found += m.n;
    return false;
  });
  if (found) {
    w.run.thrown.held[base] = (w.run.thrown.held[base] ?? 0) + found;
    // A call in progress counted these before you walked over them. Re-anchor
    // its remainder to what is actually still out there rather than
    // decrementing a snapshot: a snapshot goes stale the moment the floor
    // holds shafts the call never counted, and the counter it shows must
    // stay honest. Nothing is left for it to send home, the call just ends —
    // with no cooldown, since the steps were the price.
    const r = w.anim.retrieving;
    if (r && r.base === base) {
      const remaining = retrievableCount(w, base);
      r.left = remaining;
      if (remaining <= 0) {
        r.t = 0;
        if (!w.projectiles.some(pr => pr.returning && pr.thrownBase === base)) w.anim.retrieving = null;
      }
    }
    w.msg(`You pick up ${found} ${itemBase(base).name.toLowerCase()}.`, '#c8b890');
    w.sfx('pickup');
  }
  return found;
}
