/**
 * Projectiles in flight: monster bolts, your reflected bolts, and blows a
 * Vengeful elite or a parry turns back on their source. Functions take the
 * world first; World.update calls updateProjectiles once a tick.
 */
import { enemyDef } from '../data/enemies';
import { recordDamageDealt } from '../systems/bestiary';
import { blocksSight, enemyAt, EnemyState } from '../systems/dungeon';
import { DamageType } from '../types';
import type { World } from './world';
import { PARRY_GRACE, Projectile } from './world';
import * as Hazards from './hazards';

export function updateProjectiles(w: World, dt: number): void {
  const f = w.floor;
  const p = w.player;
  for (const pr of w.projectiles) {
    pr.x += pr.dx * pr.speed * dt;
    pr.y += pr.dy * pr.speed * dt;
    // A shaft on its way back to your hand hits nothing and is stopped by
    // nothing: it steers at you every frame, so it still arrives if you walk
    // while it flies, and it is collected the moment it is close enough.
    // Checked before the tile-crossing early-out, because over a short
    // distance it can arrive without ever leaving the tile it started in.
    if (pr.returning) {
      const ddx = p.x + 0.5 - pr.x, ddy = p.y + 0.5 - pr.y;
      const dist = Math.hypot(ddx, ddy);
      if (dist <= 0.45) {
        pr.speed = 0;
        if (pr.thrownBase) w.collectReturn(pr.thrownBase);
        continue;
      }
      pr.dx = ddx / dist;
      pr.dy = ddy / dist;
      const rx = Math.floor(pr.x), ry = Math.floor(pr.y);
      if (pr.damage > 0 && (rx !== pr.tileX || ry !== pr.tileY)) {
        const cut = enemyAt(f, rx, ry);
        if (cut && !pr.hitIds?.includes(cut.id)) {
          (pr.hitIds ??= []).push(cut.id);
          w.thrownHit(pr, cut);
        }
      }
      pr.tileX = rx;
      pr.tileY = ry;
      continue;
    }
    const tx = Math.floor(pr.x), ty = Math.floor(pr.y);
    if (tx === pr.tileX && ty === pr.tileY) continue;
    const previous = { x: pr.tileX, y: pr.tileY };
    pr.tileX = tx;
    pr.tileY = ty;
    if (pr.thrownBase || pr.spell) pr.traveled = (pr.traveled ?? 0) + 1;
    if (blocksSight(f, tx, ty) || w.crossesBossBoundary(previous.x, previous.y, tx, ty)) {
      pr.speed = 0;
      if (pr.thrownBase) w.landThrown(pr.thrownBase, previous.x, previous.y);
      else w.sfx('break', tx, ty);
      continue;
    }
    // Fire and frost act on every tile they fly over, whoever loosed them:
    // an Ember Bolt lights the oil it crosses, a frost bolt freezes water.
    Hazards.elementReaches(w, tx, ty, pr.type);
    // A spell is spent where it strikes, and gutters out at the end of its
    // range: nothing lands, so there is nothing to go and fetch.
    if (pr.spell) {
      const enemy = enemyAt(f, tx, ty);
      if (enemy) {
        pr.speed = 0;
        w.spellHit(pr, enemy);
      } else if ((pr.traveled ?? 0) >= (pr.thrownRange ?? 0)) {
        pr.speed = 0;
        w.sfx('break', tx, ty);
      }
      continue;
    }
    if (pr.thrownBase) {
      const enemy = enemyAt(f, tx, ty);
      if (enemy) {
        pr.speed = 0;
        w.thrownHit(pr, enemy);
        // The shaft drops where it struck, not on the tile behind. Landing it
        // behind meant a point blank throw fell at your own feet and was
        // collected the same frame, so throwing into something adjacent cost
        // no ammunition at all — the one range at which a thrown weapon is
        // supposed to be a bad idea was the one where it was free.
        w.landThrown(pr.thrownBase, tx, ty);
        continue;
      }
      if ((pr.traveled ?? 0) >= (pr.thrownRange ?? 0)) {
        pr.speed = 0;
        w.landThrown(pr.thrownBase, tx, ty);
      }
      continue;
    }
    // Incoming bolts fly past their own kind; a parried one is yours, and
    // buries itself in the first thing it meets.
    if (pr.reflected) {
      const hit = enemyAt(f, tx, ty);
      if (hit) {
        pr.speed = 0;
        reflectedHit(w, pr, hit);
      }
      continue;
    }
    if (tx === p.x && ty === p.y) {
      if (w.parriesProjectile(tx - pr.dx, ty - pr.dy)) {
        reflect(w, pr);
        continue;
      }
      pr.speed = 0;
      w.damagePlayer(pr.damage, pr.type, tx - pr.dx, ty - pr.dy, pr.source, pr.reflected ? undefined : pr.sourceId);
    }
  }
  if (w.projectiles.some((pr) => pr.speed <= 0)) {
    // Frost lands where a bolt stops: the Catacombs' flood freezes there.
    for (const pr of w.projectiles) {
      if (pr.speed <= 0 && pr.type === 'frost' && !pr.thrownBase) Hazards.frostLands(w, pr.tileX, pr.tileY, !!pr.spell || !!pr.reflected);
    }
    w.projectiles = w.projectiles.filter((pr) => pr.speed > 0);
  }
  const receiving = w.anim.retrieving;
  if (receiving && receiving.left <= 0
    && !w.projectiles.some(pr => pr.returning && pr.thrownBase === receiving.base)) {
    w.anim.retrieving = null;
  }
}

/** Send a bolt back the way it came, now hostile to whatever shot it. */
export function reflect(w: World, pr: Projectile): void {
  const followUp = !w.anim.parryArmed;
  w.parryFlourish(w.player.x, w.player.y);
  w.anim.rangedParryT = followUp ? 0 : PARRY_GRACE * w.diff.parryGrace;
  pr.dx = -pr.dx;
  pr.dy = -pr.dy;
  pr.reflected = true;
  pr.source = 'your own parry';
  // Restart it on your own tile, not the next one along: nudging it forward
  // would mark the adjacent tile as already visited and skip whoever is
  // standing there — which is exactly where the archer's escort tends to be.
  pr.x = w.player.x + 0.5;
  pr.y = w.player.y + 0.5;
  pr.tileX = w.player.x;
  pr.tileY = w.player.y;
  w.msg('You knock the bolt back the way it came.', '#ffe8a0');
}

export function reflectOntoAttacker(w: World, e: EnemyState, attack: number, type: DamageType): void {
  if (w.protectedByFog(e)) return;
  const def = enemyDef(e.def);
  const mult = def.resist[type] ?? 1;
  const damage = Math.max(mult > 0 ? 1 : 0, Math.round(attack * mult));
  if (damage <= 0) return;
  w.hurt(e, damage, `${damage}!`, '#ffe8a0');
  recordDamageDealt(w.state.bestiary, def.id, damage);
  w.sfx('hit', e.x, e.y);
  w.msg(`The shield answers for you.`, '#ffe8a0');
  if (e.hp <= 0) w.killEnemy(e);
}

/** A reflected bolt landing on a monster: its own damage, its own element. */
export function reflectedHit(w: World, pr: Projectile, e: EnemyState): void {
  if (w.protectedByFog(e)) return;
  const def = enemyDef(e.def);
  const mult = def.resist[pr.type] ?? 1;
  const damage = Math.max(mult > 0 ? 1 : 0, Math.round(pr.damage * mult));
  w.hurt(e, damage, `${damage}`, mult >= 1.4 ? '#ff9a40' : mult <= 0.7 ? '#9a9aa8' : '#ffe8a0');
  e.alert = Math.max(e.alert, 8);
  e.lastSeenX = w.player.x;
  e.lastSeenY = w.player.y;
  w.sfx('hit', e.x, e.y);
  if (mult >= 1.4) w.msg(`Its own ${pr.type} burns it.`, '#ff9a40');
  if (e.hp <= 0) w.killEnemy(e);
}
