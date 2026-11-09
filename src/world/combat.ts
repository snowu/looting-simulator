/**
 * Blows between you and the monsters: your swing landing (cleave, crits,
 * weave, Horn charge), monster guards and shields, parries and their
 * flourish, damage you take, and what happens when a monster falls.
 * attack on World starts a swing; World.update resolves it.
 */
import { dirOf, DX, DY } from '../core/dir';
import { gold } from '../core/format';
import { clamp, manhattan } from '../core/math';
import { createRng, hashString } from '../core/rng';
import { biomeForFloor } from '../data/biomes';
import { WEAVE_REGROW } from '../data/conduit-spells';
import { VENGEFUL_FUSE } from '../data/elites';
import { enemyDef, enemyView } from '../data/enemies';
import { DUELIST_KILLS, HUNTER_MARKS, OATHS } from '../data/oaths';
import { BULWARK_MULT, BULWARK_SOAK, BULWARK_WINDOW, COUNTERCHARM_CHARGES, EXECUTION_REFUND_MULT, RIPOSTE_MULT, RIPOSTE_WINDOW } from '../data/properties';
import { sigil } from '../data/spells';
import { PLAYER_SLIP_SECONDS } from '../data/surfaces';
import { recordDamageDealt, recordDamageTaken, recordDeath as recordBestiaryDeath, recordKill as recordBestiaryKill } from '../systems/bestiary';
import { enemyHitsPlayer, playerHitsEnemy } from '../systems/combat';
import { recordKill } from '../systems/contracts';
import { blocksSight, crackAt, defensePower, enemyAt, EnemyState, isVessel, lurkerAt, propAt } from '../systems/dungeon';
import { SHADE_ID } from '../systems/grave';
import { MORSEL_HEAL, morselChance } from '../systems/healing';
import { draught } from '../systems/infusion';
import { durability, itemName, rollEnemyLoot } from '../systems/items';
import { runOath } from '../systems/oaths';
import { surfaceKindAt } from '../systems/surfaces';
import { DamageType, EnemyDef, Item } from '../types';
import * as Projectiles from './projectiles';
import * as Hazards from './hazards';
import * as Boss from './boss';
import * as Spells from './spells';
import * as Sigils from './sigils';
import * as Thrown from './thrown';
import type { World } from './world';
import { CONDUIT_PARRY_WINDOW, GUARD_DOWN, PARRY_GRACE, PARRY_VULN_MULT, PARRY_WINDOW, tomeChance } from './world';
import * as EnemyAi from './enemy-ai';
import * as Features from './features';

/** How long a mimic takes to rise after being struck awake. */
export const MIMIC_RISE = 0.9;

/** Crowd control after turning aside a melee blow. */
export const MELEE_PARRY_SPLASH_STUN = 0.5;

/** How long a parried melee attacker is left open, and how much harder it takes hits. */
export const PARRY_STUN = 1;

/**
 * How long a turned blow counts toward a shield-bash: keep swinging into the
 * wall for this long and the second consecutive block bashes you. Back off,
 * circle behind, or let the bearer start a swing, and the count goes stale.
 */
export const BLOCK_EXPIRY = 2.5;

/**
 * The guard rhythm. The shield sweeps center fast, holds long enough to chip
 * two swings, then drops long enough to punish. Hitting the raise is the
 * parry the bearer lands on *you*; chipping three in a row sags the arm and
 * opens them up. Everything is read off the sprite, never off a counter.
 */
export const GUARD_RAISE = 0.25;

export const GUARD_UP = 1.4;

export const GUARD_BREAK_AT = 3;

export const STAGGER_HP = 55;

export function resolvePlayerAttack(w: World): void {
  const f = w.floor;
  if (w.anim.attackSpell) {
    Spells.launchSpell(w, w.anim.attackSpell);
    return;
  }
  if (w.anim.attackThrow) {
    Thrown.throwWeapon(w);
    return;
  }
  w.sfx('swing');
  for (let d = 1; d <= w.derived.swing.reach; d++) {
    const t = w.frontTile(d);
    // A spotted dropper overhead, or any mound, can be struck where it
    // hides: it comes out early, reeling and open.
    const hidden = d === 1 ? lurkerAt(f, t.x, t.y) : undefined;
    if (hidden && (hidden.lurk === 'buried' || hidden.spotted)) {
      EnemyAi.knockOut(w, hidden);
      w.wear('weapon', 2);
      return;
    }
    const e = enemyAt(f, t.x, t.y);
    if (e) {
      hitEnemy(w, e);
      // 2 per landed blow, 3 on a cleave (was 1/2): ~55 hits to break a
      // weapon, roughly a floor and a half of fighting, not four floors.
      w.wear('weapon', cleave(w, t.x, t.y) ? 3 : 2);
      return;
    }
    const p = propAt(f, t.x, t.y);
    if (p && d === 1 && isVessel(p) && !p.used) {
      w.breakProp(p);
      return;
    }
    const crack = d === 1 ? crackAt(f, t.x, t.y) : undefined;
    if (crack) {
      EnemyAi.strikeCrack(w, crack);
      return;
    }
    // An emptied chest is only boards now: one blow and it is splinters.
    if (p && p.kind === 'chest' && p.used && !p.smashed) {
      p.smashed = true;
      w.sfx('break', p.x, p.y);
      w.emit({ type: 'shake', amount: 0.15 });
      return;
    }
    // Dark Souls rules: an honest chest shrugs off a blow like a wall does,
    // and a mimic takes it and wakes up. Hitting first is the test.
    if (p && p.kind === 'chest' && !p.used) {
      w.wear('weapon', 1);
      w.chestClang(p);
      // The blow only wakes it: it rises at full health, as in Dark Souls.
      if (p.mimic) {
        w.wakeMimic(p, MIMIC_RISE);
        w.sfx('alert', p.x, p.y);
        w.emit({ type: 'shake', amount: 0.4 });
        w.msg('The chest rises up and reveals itself. Prepare to fight!', '#e8c080');
        return;
      }
      w.sfx('block', p.x, p.y);
      w.emit({ type: 'shake', amount: 0.15 });
      w.shatterInChest(p);
      w.msg('Your blow glances off the chest. Something inside breaks.', '#d0a070');
      return;
    }
    if (blocksSight(f, t.x, t.y)) break;
  }
  w.wearWhiff();
  w.sfx('miss');
}

/**
 * Spill a two-hander's blow into everything touching the thing it landed on.
 *
 * The cleave is centred on the *target*, not on you, which is the whole
 * difference between it and a shield: a guard covers the tile you face, and
 * this covers the rank behind that tile. With a halberd's reach the centre is
 * two tiles out, so the cleave lands entirely among the things you cannot
 * touch with anything else in the game.
 *
 * Your own tile is excluded — you are standing on it, and a swing that
 * wrapped all the way back around would be free damage on anything that had
 * already closed, which is exactly the position a two-hander is supposed to
 * be bad in. The main target is excluded because it already took the blow in
 * full.
 *
 * Returns whether anything was caught, which is all the caller wants: a
 * cleave that bit costs the weapon a second point of wear.
 */
export function cleave(w: World, cx: number, cy: number): boolean {
  const mult = w.derived.swing.cleave;
  if (!mult) return false;
  // A broken edge spills nothing: the blow still lands single-target at
  // 15%, but there is no splash into its neighbours.
  const weapon = w.state.equipment.weapon;
  if (weapon && durability(weapon).broken) return false;
  const caught: EnemyState[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const x = cx + dx, y = cy + dy;
    if (x === w.player.x && y === w.player.y) continue;
    const e = enemyAt(w.floor, x, y);
    if (e) caught.push(e);
  }
  // Every cleaved blow is a glancing one: one guard chip, never the two a
  // two-hander's full swing is worth, and never the bash that opens a shield.
  for (const e of caught) hitEnemy(w, e, true, 1, mult);
  return caught.length > 0;
}

/**
 * What the bearer's shield does about this blow. Frontal only, and only
 * while the guard is up in some form: committed to a swing, reeling from
 * your parry, running, or guard down, and the shield might as well be
 * firewood. A blow into the *raise* is the parry the bearer lands on you;
 * a blow into the hold just chips.
 */
/**
 * This creature as it is right now. Identical to its stat block for
 * everything in the game except the King, who answers from his phase — so the
 * guard rhythm, the sprite picker, the wind-up and the volley all keep
 * reading the fields they always read.
 */
export function view(w: World, e: EnemyState): EnemyDef {
  return enemyView(enemyDef(e.def), e.hp, e.maxHp, { elite: e.elite, carrying: !!e.stolen?.length, marked: e.marked, shadeType: e.shadeType, calm: e.calm, chilled: (e.chillT ?? 0) > 0, hexed: (e.hexT ?? 0) > 0 });
}

export function guardReaction(w: World, e: EnemyState, def: EnemyDef): 'bash' | 'chip' | null {
  if (!def.shield) return null;
  if ((e.vuln ?? 0) > 0) return null;
  if (e.ai === 'windup' || e.ai === 'recover' || e.ai === 'flee') return null;
  if ((e.guard ?? 'down') === 'down') return null;
  const d = dirOf(Math.sign(w.player.x - e.x), Math.sign(w.player.y - e.y));
  if (d === null || d !== e.facing) return null;
  return e.guard === 'raising' ? 'bash' : 'chip';
}

/**
 * The guard rhythm runs on its own while you are close: raise, hold, drop.
 * The sprite is the whole telegraph — shield sweeping center means back
 * off, held means circle, dropped means strike.
 */
export function updateGuard(w: World, e: EnemyState, def: EnemyDef, dt: number, threat: boolean): void {
  if (!def.shield) return;
  if (e.ai === 'windup' || e.ai === 'recover' || e.ai === 'flee' || e.ai === 'dead') return;
  if (!threat) {
    e.guard = 'down';
    e.blocks = 0;
    e.guardT = Math.max(e.guardT ?? 0, 0.5);
    return;
  }
  const left = (e.guardT ?? 0) - dt;
  switch (e.guard ?? 'down') {
    case 'down':
      if (left <= 0) {
        e.guard = 'raising';
        e.guardT = GUARD_RAISE;
        const d = dirOf(Math.sign(w.player.x - e.x), Math.sign(w.player.y - e.y));
        if (d !== null) e.facing = d;
      } else {
        e.guardT = left;
      }
      break;
    case 'raising':
      if (left <= 0) {
        e.guard = 'up';
        e.guardT = GUARD_UP;
      } else {
        e.guardT = left;
      }
      break;
    case 'up':
      if (left <= 0) {
        e.guard = 'down';
        e.guardT = GUARD_DOWN;
        e.blocks = 0;
      } else {
        e.guardT = left;
      }
      break;
  }
}

/**
 * A blow into the held guard: most of it absorbed, no stagger — the guard
 * holds. Lean on it three chips running and the arm sags, dropping the
 * guard wide open. Flank it, meet its swing, or time the drop instead.
 */
export function shieldChip(w: World, e: EnemyState, def: EnemyDef, chips = 1, power = w.anim.attackPower, player = w.derived): void {
  if (Boss.protectedByFog(w, e)) return;
  const sh = def.shield!;
  // Difficulty thins the armour on Normal; Hard multiplies by exactly 1.
  const hit = playerHitsEnemy(w.rng, player, power, def, defensePower(e.power) * w.diff.enemyDefense);
  const dmg = Math.max(0, Math.round(hit.damage * (1 - sh.block)));
  e.hp -= dmg;
  e.blocks = (e.blocks ?? 0) + chips;
  e.blockT = BLOCK_EXPIRY;
  e.hurtT = 0.3;
  e.alert = 8;
  e.lastSeenX = w.player.x;
  e.lastSeenY = w.player.y;
  const life = w.state.lifetime;
  if (dmg > (life.bestHit ?? 0)) life.bestHit = dmg;
  recordDamageDealt(w.state.bestiary, def.id, dmg);
  w.emit({ type: 'float', x: e.x, y: e.y, text: `${dmg}`, color: '#9a9aa8' });
  w.sfx('block', e.x, e.y);
  // Leech off a shield is still leech: it heals through heal(), like the
  // other three, so half_healing, Normal's healing and Last Flask apply.
  if (player.stats.leech > 0 && dmg > 0) w.heal(Math.max(1, Math.round((dmg * player.stats.leech) / 100)), 'leech');
  if (e.hp <= 0) {
    killEnemy(w, e);
    return;
  }
  if ((e.blocks ?? 0) >= GUARD_BREAK_AT) {
    e.blocks = 0;
    e.guard = 'down';
    e.guardT = GUARD_DOWN;
    w.sfx('break', e.x, e.y);
    w.msg(`The ${def.name}'s guard sags!`, '#ffe8a0');
  }
}

export function shieldBash(w: World, e: EnemyState, def: EnemyDef): void {
  const a = w.anim;
  a.attack = 'idle';
  a.attackThrow = false;
  a.attackT = 0;
  a.blockRaise = 0;
  a.blockT = Infinity;
  a.parryArmed = false;
  a.stunT = def.shield!.stun;
  e.alert = 8;
  e.blocks = 0;
  e.guard = 'down';
  e.guardT = GUARD_DOWN;
  e.lastSeenX = w.player.x;
  e.lastSeenY = w.player.y;
  w.emit({ type: 'shake', amount: 0.6 });
  w.sfx('block', e.x, e.y);
  w.msg(`The ${def.name} turns your blow aside and bashes you!`, '#ff9070');
  // The sure hit: it starts its swing now, while you can't move or guard.
  EnemyAi.beginWindup(w, e, def, w.player.x, w.player.y);
}

export function hitEnemy(w: World, e: EnemyState, neverBash = false, chips = w.derived.swing.chips ?? 1, powerMult = 1): void {
  if (Boss.protectedByFog(w, e)) return;
  const def = view(w, e);
  if ((e.eating ?? 0) > 0) e.eating = undefined;
  const reaction = guardReaction(w, e, def);
  if (reaction === 'bash' && !neverBash) {
    shieldBash(w, e, def);
    return;
  }
  if (reaction === 'chip' || (reaction === 'bash' && neverBash)) {
    shieldChip(w, e, def, chips, w.anim.attackPower * powerMult);
    return;
  }
  e.blocks = 0;
  // The Horn's charge is Attack, not damage: it goes into the swing before
  // armour takes its cut, so "+4 Attack" means what it says and a target
  // immune to the blow is immune to the charge behind it. Counted before
  // this blow is added, so the first hit of a fight lands at plain strength.
  // Clamped to what you are *currently* holding, so a charge cannot be parked
  // by swapping the Horn off and restored by swapping it back on.
  const chargeMax = w.derived.traits.chargeMax;
  w.anim.chargeStacks = Math.min(w.anim.chargeStacks, chargeMax);
  const charged = w.anim.chargeStacks * w.derived.traits.charge;
  // Weave: a spell that landed in the last few seconds rides on this blow as
  // its element, and is spent by it. Only the blow itself — a cleave's spill
  // is the same swing and does not get a second helping.
  const weave = powerMult === 1 ? w.anim.weave : null;
  const striker = weave
    ? { ...w.derived, stats: { ...w.derived.stats, [weave.element]: (w.derived.stats[weave.element] ?? 0) + weave.amount } }
    : w.derived;
  const hit = playerHitsEnemy(w.rng, striker, w.anim.attackPower * powerMult, def, defensePower(e.power) * w.diff.enemyDefense, charged);
  if (weave) {
    w.anim.weave = null;
    w.emit({ type: 'float', x: e.x, y: e.y - 0.3, text: 'woven', color: '#c8b8ff' });
  }
  // And the other half: a blow that lands feeds the conduit.
  if (powerMult === 1 && w.derived.conduit) Spells.growConduit(w, w.derived.conduit.charges, w.derived.conduit.regrow, WEAVE_REGROW);
  // Everything you land while the parry opening lasts hits twice as hard.
  const exposed = !!e.vuln && e.vuln > 0;
  if (exposed) hit.damage = Math.round(hit.damage * PARRY_VULN_MULT);
  // Banked parries ride on the next blows and only the next blows.
  const fed = w.anim.parryStacks * w.derived.traits.parryFeed;
  if (fed > 0) hit.damage = Math.round(hit.damage * (1 + fed));
  // A Marrow Draught rides on the first blow that lands, and only that one.
  const marrow = w.anim.draught?.kind === 'marrow' ? draught(w.state.flask?.infusion)?.marrowMult ?? 1 : 1;
  if (marrow > 1) {
    hit.damage = Math.round(hit.damage * marrow);
    w.anim.draught = null;
    if (def.behavior !== 'boss') {
      e.ai = 'recover';
      e.timer = Math.max(e.timer, 0.8);
      e.attackCd = Math.max(e.attackCd, 1);
    }
    w.emit({ type: 'shake', amount: 0.4 });
  }
  // Riposte rides on the whole swing after a parry; Bulwark on the next blow that lands.
  if (w.anim.riposteSwing) hit.damage = Math.round(hit.damage * RIPOSTE_MULT);
  if (w.anim.bulwarkT > 0 && w.derived.traits.bulwark) {
    hit.damage = Math.round(hit.damage * BULWARK_MULT);
    w.anim.bulwarkT = 0;
  }
  e.hp -= hit.damage;
  // The charge builds on the blow that just landed, so the *next* one is the
  // one that carries it. Counted here rather than on the swing, because a
  // swing that hit nothing is not a charge.
  if (chargeMax > 0 && w.anim.chargeStacks < chargeMax) {
    w.anim.chargeStacks++;
    if (w.anim.chargeStacks === chargeMax) w.msg('The horn is up to speed.', '#f0e0ac');
  }
  if (w.derived.traits.kindling) EnemyAi.kindle(w, e);
  // A blow carrying fire or frost acts on the tile it lands on, like a bolt.
  if ((striker.stats.fire ?? 0) > 0) Hazards.elementReaches(w, e.x, e.y, 'fire');
  if ((striker.stats.frost ?? 0) > 0) Hazards.elementReaches(w, e.x, e.y, 'frost');
  const life = w.state.lifetime;
  if (hit.damage > (life.bestHit ?? 0)) life.bestHit = hit.damage;
  recordDamageDealt(w.state.bestiary, def.id, hit.damage);
  e.hurtT = 0.3;
  e.alert = 8;
  e.lastSeenX = w.player.x;
  e.lastSeenY = w.player.y;
  const color = exposed ? '#ffe8a0' : hit.crit ? '#ffe040' : hit.effective === 'weak' ? '#ff9a40' : hit.effective === 'resist' ? '#9a9aa8' : '#ffffff';
  w.emit({ type: 'float', x: e.x, y: e.y, text: hit.crit || exposed ? `${hit.damage}!` : `${hit.damage}`, color });
  w.sfx(hit.crit ? 'crit' : 'hit', e.x, e.y);
  if (hit.effective === 'resist' && w.flavorRng.chance(0.3)) w.msg(`The ${def.name} shrugs off your ${w.derived.damageType} blows.`, '#9a9aa8');
  if (hit.effective === 'weak' && w.flavorRng.chance(0.3)) w.msg(`The ${def.name} reels!`, '#ff9a40');
  if (w.derived.stats.leech > 0) {
    w.heal(Math.max(1, Math.round((hit.damage * w.derived.stats.leech) / 100)), 'leech');
  }
  // Lighter foes are staggered out of their wind-up.
  if (w.derived.swing.stagger) e.attackCd += w.derived.swing.stagger;
  if (!w.derived.swing.stagger && e.ai === 'windup' && def.hp < STAGGER_HP && def.behavior !== 'boss') {
    e.ai = 'recover';
    e.timer = 0.5;
  }
  if (e.hp <= 0) {
    EnemyAi.markRemains(w, e);
    killEnemy(w, e);
  } else Hazards.slip(w, e);
}

/**
 * Is an attack arriving from (x, y) inside the parry window? The guard has to
 * have gone up in the last PARRY_WINDOW seconds and be facing the attack —
 * the same facing rule blocking uses, since a parry is a sharper block.
 * An offhand conduit answers on a tighter window (CONDUIT_PARRY_WINDOW).
 */
export function parries(w: World, fromX: number, fromY: number): boolean {
  // A touch still deciding between block and walk counts from when it
  // landed: a tap timed to the wind-up parries like a key press would.
  w.confirmGuard();
  const a = w.anim;
  const base = PARRY_WINDOW * w.diff.parryWindow * (w.derived.conduitHand === 'offhand' ? CONDUIT_PARRY_WINDOW : 1);
  const window = a.ward ? base * 2 : base;
  if (!a.parryArmed || a.blockT > window) return false;
  return facingSource(w, fromX, fromY);
}

/** A projectile parry may spend the one follow-up granted by a prior reflection. */
export function parriesProjectile(w: World, fromX: number, fromY: number): boolean {
  return parries(w, fromX, fromY) || (w.anim.rangedParryT > 0 && facingSource(w, fromX, fromY));
}

/** Whether an attack from (x, y) comes at you from the tile you are facing. */
export function facingSource(w: World, fromX: number, fromY: number): boolean {
  const p = w.player;
  const front = w.frontTile();
  return (
    (fromX === front.x && fromY === front.y) ||
    (Math.sign(fromX - p.x) === DX[p.facing] && Math.sign(fromY - p.y) === DY[p.facing] && (fromX === p.x || fromY === p.y))
  );
}

/**
 * The gear your guard is raised with — the shield if you carry one, else
 * the weapon — when it is broken and guards nothing. At 15% stats a
 * cracked guard would barely turn a blow anyway, and a guard that
 * sometimes works teaches you to trust it right up until it doesn't.
 * Fists cannot break, so an unarmed guard always holds.
 */
export function brokenGuardGear(w: World): Item | null {
  const eq = w.state.equipment;
  const g = w.derived.hasShield ? eq.offhand : eq.weapon;
  return g && durability(g).broken ? g : null;
}

/** Shared feedback for any parry: it should feel like a moment. */
export function parryFlourish(w: World, x: number, y: number): void {
  if (w.derived.traits.riposte) w.anim.riposteT = RIPOSTE_WINDOW;
  if (w.derived.traits.countercharm) Spells.refundCharges(w, COUNTERCHARM_CHARGES);
  w.anim.blockT = Infinity;
  w.anim.parryArmed = false;
  w.sfx('parry', x, y);
  w.emit({ type: 'float', x, y, text: 'Parry!', color: '#ffe8a0' });
  w.emit({ type: 'shake', amount: 0.35 });
}

export function damagePlayer(
w: World,
  attack: number,
  type: DamageType,
  fromX: number,
  fromY: number,
  source: string,
  sourceId?: string,
  attacker?: EnemyState,
  unavoidable = false,
  /** Leave the player on at least 1 health, however hard this lands. */
  spare = false,
): void {
  const p = w.player;
  // A parry denies the hit outright and leaves the attacker open.
  if (!unavoidable && parries(w, fromX, fromY)) {
    parryFlourish(w, fromX, fromY);
    const traits = w.derived.traits;
    if (traits.parryFeedMax > 0 && w.anim.parryStacks < traits.parryFeedMax) {
      w.anim.parryStacks++;
      w.msg(`The blade drinks it in. ${w.anim.parryStacks} of ${traits.parryFeedMax}.`, '#ffe8a0');
    }
    if (attacker) {
      const def = enemyDef(attacker.def);
      w.anim.parryInvulnT = PARRY_GRACE * w.diff.parryGrace;
      attacker.ai = 'recover';
      // Never shorter than the recovery it would have had anyway.
      attacker.timer = Math.max(attacker.timer, PARRY_STUN);
      attacker.attackCd = Math.max(attacker.attackCd, PARRY_STUN + 0.2);
      attacker.vuln = PARRY_STUN;
      for (const other of w.floor.enemies) {
        if (other === attacker || other.ai === 'dead' || other.lurk) continue;
        if (manhattan(other.x, other.y, p.x, p.y) !== 1) continue;
        other.ai = 'recover';
        other.timer = Math.max(other.timer, MELEE_PARRY_SPLASH_STUN);
        other.attackCd = Math.max(other.attackCd, MELEE_PARRY_SPLASH_STUN);
      }
      w.msg(`You turn the ${def.name.replace(/^The /, '')}'s blow aside. It reels — strike now!`, '#ffe8a0');
      // A shield that answers: the blow it threw, thrown back.
      if (traits.parryReflect > 0) Projectiles.reflectOntoAttacker(w, attacker, Math.round(attack * traits.parryReflect), type);
    } else {
      w.msg('You turn the blow aside.', '#ffe8a0');
    }
    return;
  }
  if (!unavoidable && w.anim.parryInvulnT > 0) return;
  let dmg = enemyHitsPlayer(w.rng, attack, type, w.derived);
  // What actually arrived, before the shield takes its share. `dmg` is
  // reduced in place below, so anything that wants to know "were you hit"
  // rather than "how much got through" has to read w.
  const landed = dmg;
  const facesSource = facingSource(w, fromX, fromY);
  let blocked = false;
  // Mid-sip the guard is down by design: the blow lands unblocked, and the
  // heal still lands when the 0.5s commitment completes. Drinking in melee
  // range is supposed to get you hit.
  // Duelist: the guard is sworn away. A parry (above) still works.
  // An offhand conduit is parry-only: it absorbs nothing, so a mistimed
  // guard meets the blow whole instead of falling back to a block.
  if (!unavoidable && w.anim.sip === null && w.anim.blockRaise > 0.6 && facesSource && !runOath(w.run, 'duelist') && w.derived.conduitHand !== 'offhand') {
    const absorbed = dmg * w.derived.block;
    const cost = absorbed * 1.3 * w.diff.blockStamina;
    if (p.stamina >= cost) {
      p.stamina -= cost;
      dmg = Math.round(dmg - absorbed);
      blocked = true;
      // Bulwark: a heavy blow taken on the shield charges the next strike.
      if (w.derived.traits.bulwark && absorbed >= w.derived.maxHp * BULWARK_SOAK) {
        if (w.anim.bulwarkT <= 0) w.msg('The shield takes it. Your next blow is charged.', '#a8bccc');
        w.anim.bulwarkT = BULWARK_WINDOW;
      }
      // Blocking grinds the shield down (2 per block, was 1); a parry
      // costs it nothing, which is one more reason to meet the swing
      // instead of hiding behind it.
      if (w.derived.hasShield) w.wear('offhand', 2);
    } else {
      const frac = p.stamina / cost;
      p.stamina = 0;
      dmg = Math.round(dmg - absorbed * frac);
      w.anim.blockRaise = 0;
      w.msg('Your guard breaks!', '#ff9070');
    }
    w.anim.sinceStamina = 0;
    w.sfx('block');
  }
  if (w.anim.recall !== null) {
    w.anim.recall = null;
    w.msg('The recall is broken by the blow.', '#888');
  }
  if (w.anim.retrieving) {
    w.anim.retrieving = null;
    w.msg('The blow scatters your aim; they stop coming.', '#888');
  }
  if (w.anim.chew) {
    const chew = w.anim.chew;
    const morsel = (w.floor.morsels ?? []).find((m) => m.id === chew.id);
    if (morsel) morsel.remaining = Math.max(0, (chew.total - chew.delivered) / w.derived.maxHp);
    w.anim.chew = null;
    w.msg('The blow knocks the morsel from your hands.', '#c8a060');
  }
  // The Frost Vault: struck on its ice, you go down too.
  if (dmg > 0 && !blocked && surfaceKindAt(w.floor, p.x, p.y) === 'ice' && biomeForFloor(w.floor).law === 'treacherous') {
    w.anim.stunT = Math.max(w.anim.stunT, PLAYER_SLIP_SECONDS);
    w.msg('You go down on the ice!', '#c8e8ff');
  }
  if (dmg > 0 && !blocked) w.wearArmour();
  // An unblocked hit empties whatever the blade had banked. Blocking keeps it:
  // the point of the thing is that you have to keep meeting the swing.
  if (dmg > 0 && !blocked && w.anim.parryStacks > 0) {
    w.anim.parryStacks = 0;
    if (w.derived.traits.parryFeedMax > 0) w.msg('The blade goes cold.', '#9a9aa8');
  }
  // The Horn is harsher than the blade: a blow you *blocked* still stops the
  // charge. It is a charge, and you stopped. Read off the blow that arrived
  // rather than off `dmg`, which is already net of the shield — against a
  // 90% guard anything under five rounds to nothing, and the charge would
  // have survived hits the relic says break it.
  if (landed > 0 && w.anim.chargeStacks > 0) {
    w.anim.chargeStacks = 0;
    if (w.derived.traits.chargeMax > 0) w.msg('The charge breaks.', '#9a9aa8');
  }
  // An Iron Draught blunts the next blow that gets through, then is spent.
  if (dmg > 0 && w.anim.draught?.kind === 'iron') {
    const cap = Math.round(w.derived.maxHp * (draught(w.state.flask?.infusion)?.wardFrac ?? 0));
    const soaked = Math.min(dmg, cap);
    dmg -= soaked;
    w.anim.draught = null;
    if (soaked > 0) {
      w.emit({ type: 'float', x: p.x, y: p.y, text: `-${soaked}`, color: '#a8c0e0' });
      w.msg(dmg > 0 ? 'The iron takes the worst of it.' : 'The iron takes the blow.', '#a8c0e0');
    }
  }
  if (spare) dmg = Math.max(0, Math.min(dmg, Math.ceil(p.hp) - 1));
  p.hp -= dmg;
  // A thief's blow that gets through takes something with it.
  if (attacker && dmg > 0 && !blocked && p.hp > 0 && !attacker.stolen?.length && view(w, attacker).thief) {
    EnemyAi.pickPocket(w, attacker);
  }
  if (w.anim.cast) {
    w.anim.cast = null;
    w.msg('The sigil cast is broken by the blow.', '#888');
  }
  if (dmg > (w.state.lifetime.worstHit ?? 0)) w.state.lifetime.worstHit = dmg;
  if (sourceId) recordDamageTaken(w.state.bestiary, sourceId, dmg);
  w.emit({ type: 'hurt', amount: dmg, blocked });
  w.emit({ type: 'shake', amount: blocked ? 0.3 : Math.min(1, dmg / 20) });
  if (dmg > 0 && !blocked) w.sfx('hurt');
  if (p.hp <= 0) {
    p.hp = 0;
    w.run.killedBy = source;
    // Traps have no codex entry, so they file nothing.
    if (sourceId) recordBestiaryDeath(w.state.bestiary, sourceId);
    w.sfx('death');
    w.msg(`You were slain by ${source.startsWith('The ') ? source : 'a ' + source}.`, '#ff5050');
    w.finish('dead');
  }
}

export function killEnemy(w: World, e: EnemyState): void {
  // Deliberately the stat block and not the phase view: what dies here has to
  // be the creature itself, because its id is what the codex, the field notes
  // and the one guaranteed relic in the game are all keyed off.
  const def = enemyDef(e.def);
  e.hp = 0;
  e.ai = 'dead';
  e.deadT = 0;
  // It dies as itself: the remains are what the Gravecaller and the codex read.
  if (e.hexT !== undefined) {
    delete e.hexT;
    Spells.addSpellFx(w, 'poof', e.x, e.y);
  }
  w.sfx('enemyDie', e.x, e.y);
  // A Vengeful elite's fuse lights as it falls; `updateEnemies` sets it off.
  if (e.elite === 'vengeful') {
    e.burstT = VENGEFUL_FUSE;
    w.msg('The corpse swells with violet light. Get clear!', '#c070ff');
  }
  // Something the King stood back up pays out once, not twice. It already
  // gave you its hoard, its tally and its contract credit the first time it
  // fell; without this the throne room would be the best place in the game to
  // farm a Hollow Knight's moonsilver.
  if (e.risen) {
    w.msg(`${def.name} falls still again.`, '#c8c0b0');
    return;
  }
  if (e.lieutenant) Features.lieutenantFalls(w, e);
  if (e.def === SHADE_ID && w.state.grave) {
    const grave = w.state.grave;
    w.state.grave = null;
    w.dropLoot(e.x, e.y, grave.items, grave.gold);
    w.msg('Your Shade comes apart. What you lost is yours again.', '#9ab8ff');
  }
  const duelist = runOath(w.run, 'duelist');
  if (duelist && !e.risen) {
    duelist.kills = (duelist.kills ?? 0) + 1;
    if (duelist.kills === DUELIST_KILLS) w.msg(`${DUELIST_KILLS} kills with no guard but the parry. The Duelist's oath is met: now bring it home.`, OATHS.duelist.color);
  }
  const hunter = runOath(w.run, 'hunter');
  if (e.marked && hunter) {
    const oath = hunter;
    oath.marks = (oath.marks ?? 0) + 1;
    w.msg(oath.marks >= HUNTER_MARKS
      ? `The last marked quarry falls. The hunt is done: now bring it home.`
      : `Marked quarry slain: ${oath.marks} of ${HUNTER_MARKS}.`, OATHS.hunter.color);
  }
  Sigils.refundSigil(w, def, w.derived.traits.execution && (e.vuln ?? 0) > 0 ? EXECUTION_REFUND_MULT : 1);
  Spells.refundConduit(w, def);
  w.run.stats.kills++;
  recordKill(w.state.contracts, def.id);
  recordBestiaryKill(w.state.bestiary, def.id);
  const loot = e.mimicTier && e.mimicPropId
    ? w.containerLoot(createRng(hashString(`${w.floor.seed}:${e.mimicPropId}`)), e.mimicTier)
    : rollEnemyLoot(w.rng, def, w.run.depth, w.lootFind, w.identifyBelow, w.state.recipeRanks, w.state.bestiary, w.seenUniques, w.difficultyId, !!e.elite);
  const sigilDrop = def.behavior === 'boss'
    ? w.rollSigil(`boss:${e.id}`, 1)
    : e.mimicTier && e.mimicPropId
      ? w.rollSigil(`chest:${e.mimicPropId}`, e.mimicTier === 'vault' || e.mimicTier === 'secret' ? 0.22 : 0.03 * clamp((w.run.depth - 1) / 4, 0, 1))
      : null;
  if (sigilDrop) loot.items.push(sigilDrop);
  const tomeDrop = e.mimicTier && e.mimicPropId ? w.rollTome(`chest:${e.mimicPropId}`, tomeChance(e.mimicTier, w.run.depth)) : null;
  if (tomeDrop) loot.items.push(tomeDrop);
  if (def.behavior === 'boss') {
    // The portal opens where the king fell, so his hoard goes beside it —
    // dropped on the same tile it would be unreachable behind the portal.
    const spot = w.freeTileNear(e.x, e.y);
    w.dropLoot(spot.x, spot.y, loot.items, loot.gold);
    w.run.stats.bossKilled = true;
    if ((w.state.flask?.shards ?? 0) < 3) {
      const shard = w.floor.pickups.find((p) => p.x === spot.x && p.y === spot.y) ?? { id: 'shard_king', x: spot.x, y: spot.y, items: [], gold: 0 };
      shard.flaskShard = true;
      if (!w.floor.pickups.includes(shard)) w.floor.pickups.push(shard);
    }
    w.msg('The Ashen King crumbles to cinders. A portal tears open.', '#c080ff');
    Boss.unsealBossDoors(w);
    w.floor.props.push({ id: `portal${w.time}`, kind: 'portal', x: e.x, y: e.y, used: false, tier: 'none', blocking: false, mimic: false });
    Features.placeKingCarving(w, e.x, e.y);
  } else {
    if (def.morsel) {
      const foodRng = createRng(hashString(`morsel:${w.floor.seed}:${e.id}`));
      if (foodRng.chance(morselChance(w.run.depth))) {
        (w.floor.morsels ??= []).push({
          id: `morsel_${e.id}`, kind: def.morsel, x: e.x, y: e.y,
          remaining: MORSEL_HEAL[def.morsel], droppedAt: w.run.stats.time,
        });
      }
      // The Big Toe: a second cut, on its own roll and its own stream, so
      // carrying the toe cannot shift whether the *first* one dropped.
      const butcher = w.derived.traits.butcher;
      if (butcher > 0) {
        const toeRng = createRng(hashString(`butcher:${w.floor.seed}:${e.id}`));
        if (toeRng.chance(butcher)) {
          const spot = w.freeTileNear(e.x, e.y);
          (w.floor.morsels ??= []).push({
            id: `morsel_toe_${e.id}`, kind: def.morsel, x: spot.x, y: spot.y,
            remaining: MORSEL_HEAL[def.morsel], droppedAt: w.run.stats.time,
          });
          w.msg('The toe finds a second cut.', '#d8a88c');
        }
      }
    }
    w.dropLoot(e.x, e.y, loot.items, loot.gold);
    w.msg(`${view(w, e).name} slain.`, e.elite ? '#e8d8a0' : '#c8c0b0');
    if (e.stolen?.length) {
      w.dropLoot(e.x, e.y, e.stolen, 0);
      w.msg(`It drops your ${e.stolen.map(itemName).join(', ')}.`, '#e8c060');
      delete e.stolen;
      delete e.stolenT;
    }
  }
  w.trialKill(e.id);
}
