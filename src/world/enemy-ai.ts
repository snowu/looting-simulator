/**
 * Monster behaviour, once a tick each: sight and alert, wandering, chasing
 * and pathing, the wind-up / strike / recovery cycle with feints and combos,
 * and the special cases: lurkers and divers, raisers, thieves, the Hoarder,
 * Vengeful bursts, and what noise and the Ossuary's restlessness wake.
 * World.update calls updateEnemies.
 */
import { dirOf, DIRS, DX, DY, turnAround } from '../core/dir';
import { gold } from '../core/format';
import { manhattan } from '../core/math';
import { createRng, hashString } from '../core/rng';
import { AMBUSH_BEAT, AMBUSH_TRIGGER, BURROW_MAX, BURROW_MIN, DIVE_AT, DROP_SECONDS, KNOCKOUT_STUN, MOUND_STEP, SURFACE_SECONDS } from '../data/ambush';
import { AttackMove, chooseMove, COMBO_BEAT, FEINT_AT, FEINT_HOLD, meleeReach, moveById } from '../data/attacks';
import { biomeForFloor } from '../data/biomes';
import { THIEF_BOLT, THIEF_CREEP, THIEF_ESCAPE, THIEF_FUMBLE, THIEF_FUMBLE_CHANCE, THIEF_TRAIL_EVERY, THIEF_TRAIL_MAX, VENGEFUL_DAMAGE_MULT } from '../data/elites';
import { enemyDef } from '../data/enemies';
import { itemBase } from '../data/items';
import { BURROWS_NOISE_MULT, COLLAPSE_BASE, COLLAPSE_PER_DEPTH, COLLAPSE_STUN, LAWS, OSSUARY_RISE_HP, OSSUARY_STIR, OSSUARY_STIR_AFTER } from '../data/laws';
import { HOARDER_REACH, HOARDER_SHY, isGoblin, LIEUTENANTS, RALLY_DAMAGE } from '../data/lieutenants';
import { RAISE_BEAT, RAISE_CHANNEL, RAISE_COOLDOWN, RAISE_HP, RAISE_LIMIT, RAISE_REACH, SHATTER_OVERKILL } from '../data/necromancy';
import { OATHS, SILENCE_NOISE } from '../data/oaths';
import { KINDLING_AT, KINDLING_SPREAD } from '../data/properties';
import { CACHE_MIN_GOLD, Crack, CRACK_BLOWS, CRACK_NOISE, CRACK_WEAR, SEAM_ORE } from '../data/walls';
import { takeQty } from '../state/inventory';
import { attackPower, blocksMove, blocksSight, enemyAt, EnemyState, FLOOR, stairsAt, trapAt } from '../systems/dungeon';
import { durability, itemName, makeMaterial, materialForDepth } from '../systems/items';
import { runOath } from '../systems/oaths';
import { burningAt, surfaceKindAt } from '../systems/surfaces';
import { EnemyDef } from '../types';
import { SHADOW_STEP_EVERY } from './boss';
import * as Hazards from './hazards';
import * as Boss from './boss';
import * as Spells from './spells';
import * as Combat from './combat';
import type { World } from './world';
import { GUARD_DOWN } from './world';
import * as Loot from './loot';

/**
 * How long a monster held back by Normal's attacker cap waits before it asks
 * again. On the monsters' clock, so Normal's slower tempo stretches it too.
 */
export const CROWD_WAIT = 0.35;

export const GUARD_RANGE = 4;

/**
 * Anything lighter than this is knocked out of its wind-up when you land a
 * blow, which is what makes trading with a rat different from trading with a
 * ghoul. It is a raw health number and so it has to move whenever the health
 * scale does: it was 40 against a roster topping out at 30 for a shieldguard,
 * and 55 keeps exactly the same creatures on the light side of the line now
 * that every stat block is larger.
 */
/** A badly hurt skittish monster's chance to bolt, per 60 fps tick it stands deciding. */
export const SKITTISH_FLEE_PER_TICK = 0.02;

export function updateEnemies(w: World, dt: number): void {
  const f = w.floor;
  const p = w.player;
  const restless = biomeForFloor(f).law === 'restless';
  // The monsters' own clock. Normal runs it slower, so every tell lasts
  // longer without changing shape; on Hard it is exactly `dt`.
  const tempo = w.diff.enemyTempo;
  const edt = dt / tempo;
  // Who is already swinging at you, for the cap on how many may at once.
  w.committed = w.diff.maxAttackers === Infinity ? 0 : f.enemies.filter((e) => e.ai === 'windup' || (e.comboLeft ?? 0) > 0).length;
  for (const e of f.enemies) {
    if (e.ai === 'dead') {
      const before = e.deadT;
      e.deadT += dt;
      if (restless) ossuaryStir(w, e, before, dt);
      if (e.burstT !== undefined) {
        e.burstT -= dt;
        if (e.burstT <= 0) {
          delete e.burstT;
          vengefulBurst(w, e);
        }
      }
      continue;
    }
    if (Boss.protectedByFog(w, e)) continue;
    if (e.lurk === 'shadow') {
      Boss.updateShadowStep(w, e, dt / tempo);
      continue;
    }
    if (e.lurk) {
      updateLurker(w, e, dt);
      continue;
    }
    const def = Combat.view(w, e);
    if (def.behavior === 'boss') Boss.checkBossPhase(w, e);
    e.hurtT = Math.max(0, e.hurtT - dt);
    if (!e.scavenged && /^(rat|bat)(_|$)/.test(e.def) && (e.ai === 'idle' || e.ai === 'wander')) {
      const morsel = (f.morsels ?? []).find((m) => m.x === e.x && m.y === e.y);
      if (morsel) {
        e.eating = (e.eating ?? 1) - dt;
        if (e.eating <= 0) {
          f.morsels = (f.morsels ?? []).filter((m) => m !== morsel);
          e.scavenged = true; e.eating = 0;
          e.maxHp = Math.round(e.maxHp * 1.25); e.hp = e.maxHp; e.scavengerAttack = 1.15;
        }
        continue;
      }
    }
    e.attackCd -= edt;
    if (def.behavior === 'boss') {
      const cd = w.kingCd.get(e.id);
      if (cd) {
        cd.step = Math.max(-SHADOW_STEP_EVERY, cd.step - edt);
        cd.pitch -= edt;
      }
    }
    if (e.strikeT !== undefined) e.strikeT += dt;
    if (e.vuln) e.vuln = Math.max(0, e.vuln - dt);
    if ((e.grabT ?? 0) > 0) {
      e.grabT = e.grabT! - dt;
      if (e.grabT <= 0) {
        delete e.grabT;
        Loot.mimicBite(w, e);
      }
      continue;
    }
    if ((e.blockT ?? 0) > 0) {
      e.blockT = Math.max(0, (e.blockT ?? 0) - dt);
      if (e.blockT === 0) e.blocks = 0;
    }
    if (e.moveT < 1) {
      e.moveT = Math.min(1, e.moveT + dt / (def.step * tempo));
      if (e.moveT < 1) continue;
    }
    const dist = manhattan(e.x, e.y, p.x, p.y);
    // Standing in fire, anything not mid-swing gets out of it first.
    if (burningAt(f, e.x, e.y) && e.ai !== 'windup' && e.ai !== 'recover' && Hazards.escapeFire(w, e)) continue;
    if ((e.hexT ?? 0) > 0) {
      Spells.updateHexed(w, e, dt);
      continue;
    }
    if ((e.blind ?? 0) > 0) {
      e.blind = Math.max(0, (e.blind ?? 0) - dt);
      e.guard = 'down';
      if (w.rng.chance(dt / 0.6)) {
        // A blind thing stumbles, never hunts: it may blunder sideways but
        // never steps closer to you on purpose. Walled in with no sideways
        // step, it stays put.
        const steps = DIRS.map((d) => [e.x + DX[d], e.y + DY[d]] as [number, number])
          .filter(([x, y]) => canStep(w, e, x, y))
          .filter(([x, y]) => manhattan(x, y, p.x, p.y) >= dist);
        if (steps.length) { const [x, y] = w.rng.pick(steps); stepEnemy(w, e, x, y); }
      }
      if (e.blind <= 0) {
        if (dist > 2) { e.alert = 0; e.ai = 'idle'; }
        else e.ai = 'chase';
      }
      continue;
    }
    const sees = (w.anim.unseenT > 0 && dist <= 2) || (dist <= def.sight + w.sightPenalty && w.los(e.x, e.y, p.x, p.y));
    if (sees) {
      if (e.alert <= 0 && (e.ai === 'idle' || e.ai === 'wander')) {
        w.sfx('alert', e.x, e.y);
        e.attackCd = Math.max(e.attackCd, 0.3);
      }
      e.alert = 6;
      // A wind-up commits to the tile it aimed at — that's what makes it dodgeable.
      if (e.ai !== 'windup') {
        e.lastSeenX = p.x;
        e.lastSeenY = p.y;
      }
    } else {
      e.alert -= dt;
    }

    // The guard rhythm ticks while the bearer is free to hold it.
    Combat.updateGuard(w, e, def, dt, e.alert > 0 && dist <= GUARD_RANGE);

    // A Gravecaller chanting over a corpse stands still until it finishes or is broken.
    if (def.raises && updateRaiser(w, e, def, edt)) continue;

    // A thief with your things in its hands does nothing but run.
    if (e.stolen?.length && e.ai !== 'windup' && e.ai !== 'recover') {
      if (runWithLoot(w, e, def, dist, sees, dt)) continue;
    }

    // The rest of a flurry lands while the creature is already recovering.
    updateCombo(w, e, def, edt);

    switch (e.ai) {
      case 'windup':
        // A feint holds the lean once, then runs the rest of the wind-up.
        if (!updateFeint(w, e, def, edt)) e.timer -= edt;
        if (e.timer <= 0) enemyStrike(w, e, def);
        continue;
      case 'recover':
        e.timer -= edt;
        if (e.timer <= 0) e.ai = e.alert > 0 ? 'chase' : 'idle';
        continue;
      case 'flee': {
        if (dist > 7 || !sees) {
          e.ai = 'idle';
          continue;
        }
        const away = DIRS.map((d) => [e.x + DX[d], e.y + DY[d]] as [number, number])
          .filter(([x, y]) => canStep(w, e, x, y))
          .sort((a, b) => manhattan(b[0], b[1], p.x, p.y) - manhattan(a[0], a[1], p.x, p.y))[0];
        if (away) stepEnemy(w, e, away[0], away[1]);
        continue;
      }
    }

    if (def.burrows && !e.dived && e.hp < e.maxHp * DIVE_AT) {
      dive(w, e, def);
      continue;
    }
    if (e.lieutenant === 'hoarder' && updateHoarder(w, e, def, dist, sees)) continue;
    // A monster standing still decides every tick, so the chance is per
    // second, not per tick: 2% a tick at 60 fps, the rate it was tuned at,
    // whatever the display runs at.
    if (def.behavior === 'skittish' && e.hp < e.maxHp * 0.35 && sees && rally(w, e) === 1 && w.rng.chance(1 - Math.pow(1 - SKITTISH_FLEE_PER_TICK, dt * 60))) {
      e.ai = 'flee';
      w.msg(`The ${def.name} tries to flee!`, '#c8c0b0');
      continue;
    }

    if (e.alert > 0) {
      e.ai = 'chase';
      if (def.behavior === 'boss' && Boss.kingTurn(w, e, dist)) continue;
      const aligned = (e.x === p.x || e.y === p.y) && sees;
      const ranged = !!def.projectile && (def.behavior === 'ranged' || def.behavior === 'boss');
      // Normal's crowd rule: past the cap, a monster that could swing holds
      // its place and waits a beat instead. The King never waits.
      if (e.attackCd <= 0 && w.committed >= w.diff.maxAttackers && def.behavior !== 'boss' && dist <= (def.range ?? 4) + 2) {
        e.attackCd = CROWD_WAIT;
        if (dist <= 2) continue;
      }
      if (dist === 1 && e.attackCd <= 0 && (def.behavior !== 'ranged')) {
        beginWindup(w, e, def, p.x, p.y);
        continue;
      }
      // A creature with reach commits from a tile further out, down the line
      // it is facing — but only with a move that actually reaches, so the
      // threat it shows is the threat it throws.
      if (dist === 2 && aligned && e.attackCd <= 0 && def.behavior !== 'ranged' && meleeReach(def) >= 2) {
        beginWindup(w, e, def, p.x, p.y, 2);
        continue;
      }
      if (ranged && aligned && dist >= 2 && dist <= (def.range ?? 4) + 2 && e.attackCd <= 0) {
        beginWindup(w, e, def, p.x, p.y);
        continue;
      }
      if (def.behavior === 'ranged' && dist <= 1) {
        // Back off to shooting range.
        const back = DIRS.map((d) => [e.x + DX[d], e.y + DY[d]] as [number, number]).find(
          ([x, y]) => canStep(w, e, x, y) && manhattan(x, y, p.x, p.y) > dist,
        );
        if (back) stepEnemy(w, e, back[0], back[1]);
        else if (e.attackCd <= 0) beginWindup(w, e, def, p.x, p.y);
        continue;
      }
      if (def.behavior === 'ranged' && sees && dist <= (def.range ?? 4)) {
        // Sidestep to line up a shot.
        const line = DIRS.map((d) => [e.x + DX[d], e.y + DY[d]] as [number, number]).find(
          ([x, y]) => canStep(w, e, x, y) && (x === p.x || y === p.y) && w.los(x, y, p.x, p.y),
        );
        if (line) stepEnemy(w, e, line[0], line[1]);
        continue;
      }
      const tx = sees ? p.x : e.lastSeenX;
      const ty = sees ? p.y : e.lastSeenY;
      const next = pathStep(w, e, tx, ty);
      if (next) stepEnemy(w, e, next[0], next[1]);
      else if (!sees && e.x === e.lastSeenX && e.y === e.lastSeenY) e.alert = 0;
      continue;
    }

    // Idle wandering near home.
    e.ai = 'wander';
    e.timer -= dt;
    if (e.timer <= 0) {
      e.timer = w.rng.float(1.2, 3.2);
      const opts = DIRS.map((d) => [e.x + DX[d], e.y + DY[d]] as [number, number]).filter(
        ([x, y]) => canStep(w, e, x, y) && manhattan(x, y, e.homeX, e.homeY) <= 3,
      );
      if (opts.length && w.rng.chance(0.6)) {
        const [x, y] = w.rng.pick(opts);
        stepEnemy(w, e, x, y);
      }
    }
  }
}

export function beginWindup(w: World, e: EnemyState, def: EnemyDef, tx: number, ty: number, minReach = 1): void {
  w.committed++;
  const d = dirOf(Math.sign(tx - e.x), Math.sign(ty - e.y));
  if (d !== null) e.facing = d;
  // Swinging means the shield is elsewhere: the guard drops tired.
  if (def.shield) {
    e.guard = 'down';
    e.guardT = Math.max(e.guardT ?? 0, GUARD_DOWN);
    e.blocks = 0;
  }
  // What it commits to is rolled here, not at spawn: a creature knocked out
  // of a slam and coming back may well answer with something quicker.
  let pool = minReach > 1 ? def.moves?.filter((m) => moveById(m.id).reach >= minReach) : def.moves;
  // Normal: no feints. A set that was nothing but feints falls back to the basic blow.
  if (w.diff.gentleMoves && pool) pool = pool.filter((m) => !moveById(m.id).feint);
  const move = chooseMove(pool, (total) => w.rng.float(0, total));
  e.move = move.id === 'basic' ? undefined : move.id;
  delete e.feintT;
  delete e.feinted;
  delete e.comboLeft;
  delete e.comboT;
  e.ai = 'windup';
  e.timer = def.windup * move.windup;
  e.lastSeenX = tx;
  e.lastSeenY = ty;
}

/**
 * A feint's stall. Held once per wind-up, at the point an ordinary blow of
 * the same creature would have landed — which is exactly what makes biting
 * on it feel like being read rather than being cheated.
 *
 * Returns true while the lean is frozen, so the wind-up timer does not run.
 */
export function updateFeint(w: World, e: EnemyState, def: EnemyDef, dt: number): boolean {
  const move = moveById(e.move);
  if (!move.feint) return false;
  if ((e.feintT ?? 0) > 0) {
    e.feintT = Math.max(0, e.feintT! - dt);
    return e.feintT > 0;
  }
  if (e.feinted) return false;
  const full = def.windup * move.windup;
  if (e.timer <= full * (1 - FEINT_AT)) {
    e.feinted = true;
    e.feintT = full * FEINT_HOLD;
    w.sfx('miss', e.x, e.y);
    return true;
  }
  return false;
}

/**
 * The follow-ups of a combo, landing on {@link COMBO_BEAT} while the
 * creature is already in recovery.
 *
 * They re-aim at where you are now, but the creature does not turn between
 * them, so stepping out of the arc it committed to breaks the rest of the
 * flurry while backing straight off does not. The first blow is the one you
 * cannot dodge.
 */
export function updateCombo(w: World, e: EnemyState, def: EnemyDef, dt: number): void {
  if (!e.comboLeft) return;
  // Parried, knocked out or otherwise opened up: the rest of the flurry is
  // the price. This is what makes meeting the *first* blow worth doing.
  if ((e.vuln ?? 0) > 0) {
    delete e.comboLeft;
    delete e.comboT;
    return;
  }
  e.comboT = (e.comboT ?? 0) - dt;
  if (e.comboT! > 0) return;
  e.comboLeft--;
  if (e.comboLeft <= 0) {
    delete e.comboLeft;
    delete e.comboT;
  } else {
    e.comboT = COMBO_BEAT;
  }
  const p = w.player;
  e.lastSeenX = p.x;
  e.lastSeenY = p.y;
  landBlow(w, e, def, moveById(e.move));
}

export function enemyStrike(w: World, e: EnemyState, def: EnemyDef): void {
  const move = moveById(e.move);
  e.ai = 'recover';
  e.timer = def.recovery * move.recovery;
  e.attackCd = def.recovery * move.recovery + 0.2;
  if (move.combo) {
    e.comboLeft = w.diff.gentleMoves ? Math.min(1, move.combo) : move.combo;
    e.comboT = COMBO_BEAT;
  }
  // Stamped by the blow itself, so the follow-through is drawn only when
  // there was one. See `enemyPose`.
  e.strikeT = 0;
  const p = w.player;
  const dist = manhattan(e.x, e.y, p.x, p.y);
  const useRanged = !!def.projectile && (def.behavior === 'ranged' || (def.behavior === 'boss' && dist >= 2));
  if (useRanged) {
    const dx = Math.sign(e.lastSeenX - e.x), dy = Math.sign(e.lastSeenY - e.y);
    if (dx !== 0 && dy !== 0) return;
    const pr = def.projectile!;
    const shots = def.volley ?? [0];
    for (const off of shots) {
      const ox = dy !== 0 ? off : 0, oy = dx !== 0 ? off : 0;
      if (off !== 0 && blocksSight(w.floor, e.x + ox, e.y + oy)) continue;
      w.projectiles.push({
        id: w.projN++, x: e.x + ox + 0.5, y: e.y + oy + 0.5, dx, dy, speed: pr.speed,
        damage: Math.round(def.attack * move.power * attackPower(e.power) * (e.scavengerAttack ?? 1) * rally(w, e) * w.diff.enemyDamage), type: pr.damageType, sprite: pr.sprite, light: pr.light,
        tileX: e.x + ox, tileY: e.y + oy, source: def.name, sourceId: def.id,
      });
    }
    w.sfx(pr.sprite.startsWith('proj_arrow') ? 'shoot' : 'magic', e.x, e.y);
    return;
  }
  landBlow(w, e, def, move);
}

/**
 * One melee blow of a move: where it lands, how wide, and how hard.
 *
 * A plain blow is the old rule exactly — the tile it aimed at, and only if
 * you are still standing in it. `reach` extends the line it will accept,
 * which is what stops a step backwards from being the universal answer, and
 * `sweep` accepts the two tiles either side of that line, which is what
 * stops circling from being the other one.
 */
export function landBlow(w: World, e: EnemyState, def: EnemyDef, move: AttackMove): void {
  const p = w.player;
  w.sfx('swing', e.x, e.y);
  const dx = DX[e.facing], dy = DY[e.facing];
  let hit = false;
  // Where the blow comes at you *from*, which is what the guard and the parry
  // are answered against. Usually the creature itself; for a flank caught by
  // a sweep it is the tile the swing is travelling through, because a guard
  // can only ever be raised at an orthogonal neighbour and a blow nobody can
  // answer is not a wide swing, it is an unfair one.
  let srcX = e.x, srcY = e.y;
  for (let d = 1; d <= move.reach && !hit; d++) {
    const x = e.x + dx * d, y = e.y + dy * d;
    // Reach is a longer arm, not a spear through stone: anything solid on the
    // way — a wall, a door, a pillar — stops the blow short of you.
    if (d > 1 && blocksMove(w.floor, e.x + dx * (d - 1), e.y + dy * (d - 1))) break;
    if (p.x === x && p.y === y) hit = true;
    else if (move.sweep) {
      // The flanks of the tile it is swinging through — a sidestep's landing.
      const sx = dy, sy = dx;
      if ((p.x === x + sx && p.y === y + sy) || (p.x === x - sx && p.y === y - sy)) {
        hit = true;
        srcX = x;
        srcY = y;
      }
    }
  }
  // A plain blow keeps its old contract: the tile it *aimed* at, so a
  // creature that turned after committing still misses.
  if (move.reach === 1 && !move.sweep && !(p.x === e.lastSeenX && p.y === e.lastSeenY)) hit = false;
  if (!hit) {
    w.sfx('miss', e.x, e.y);
    return;
  }
  const raw = def.attack * move.power * attackPower(e.power) * (e.scavengerAttack ?? 1) * rally(w, e) * w.diff.enemyDamage;
  Combat.damagePlayer(w, Math.max(1, Math.round(raw)), def.damageType, srcX, srcY, def.name, def.id, e);
}

export function occupied(w: World, x: number, y: number, self: EnemyState): boolean {
  if (x === w.player.x && y === w.player.y) return true;
  return w.floor.enemies.some((o) => o !== self && o.ai !== 'dead' && !o.lurk && o.x === x && o.y === y);
}

/** Monsters do not walk into fire on purpose: burning oil is a wall to them until it burns out. */
export function canStep(w: World, e: EnemyState, x: number, y: number): boolean {
  return !blocksMove(w.floor, x, y) && !occupied(w, x, y, e) && !stairsAt(w.floor, x, y) && !burningAt(w.floor, x, y);
}

export function stepEnemy(w: World, e: EnemyState, x: number, y: number): void {
  const d = dirOf(x - e.x, y - e.y);
  if (d !== null) e.facing = d;
  e.fromX = e.x;
  e.fromY = e.y;
  e.x = x;
  e.y = y;
  e.moveT = 0;
  // Monsters blunder into traps too, which is what makes retreating over one
  // you already found worth doing.
  const trap = trapAt(w.floor, x, y);
  if (trap && trap.armed) w.springTrap(trap, e);
  stepOnto(w, e);
}

/**
 * What a monster's feet do to the floor: a burning one, or one made of
 * fire, lights oil and melts ice where it steps, and water puts a burning
 * one out.
 */
export function stepOnto(w: World, e: EnemyState): void {
  const kind = surfaceKindAt(w.floor, e.x, e.y);
  if (!kind) return;
  const fiery = !!e.burn || enemyDef(e.def).element === 'fire';
  if (fiery && (kind === 'oil' || kind === 'ice' || kind === 'spores')) Hazards.elementReaches(w, e.x, e.y, 'fire');
  else if (kind === 'spores') Hazards.sporePuff(w, e.x, e.y);
  else if (kind === 'water' && e.burn) {
    delete e.burn;
    w.sfx('snuff', e.x, e.y);
  }
}

/** BFS toward a target; returns the first step, cached briefly. */
export function pathStep(w: World, e: EnemyState, tx: number, ty: number): [number, number] | null {
  const key = e.id;
  const hit = w.pathCache.get(key);
  if (hit && w.time - hit.t < 0.35 && hit.next && canStep(w, e, hit.next[0], hit.next[1])) return hit.next;
  const f = w.floor;
  const W = f.width;
  const prev = new Map<number, number>();
  const start = e.y * W + e.x;
  const goal = ty * W + tx;
  // What `occupied` answers, gathered once: nobody moves during a search.
  const busy = new Set<number>([w.player.y * W + w.player.x]);
  for (const o of f.enemies) if (o !== e && o.ai !== 'dead' && !o.lurk) busy.add(o.y * W + o.x);
  const q = [start];
  prev.set(start, -1);
  let found = false;
  for (let h = 0; h < q.length && q.length < 1500; h++) {
    const i = q[h];
    if (i === goal) {
      found = true;
      break;
    }
    const x = i % W, y = (i / W) | 0;
    for (const d of DIRS) {
      const nx = x + DX[d], ny = y + DY[d];
      const n = ny * W + nx;
      if (prev.has(n)) continue;
      if (n !== goal && (blocksMove(f, nx, ny) || busy.has(n) || burningAt(f, nx, ny))) continue;
      if (manhattan(nx, ny, e.x, e.y) > 18) continue;
      prev.set(n, i);
      q.push(n);
    }
  }
  let next: [number, number] | null = null;
  if (found) {
    let i = goal;
    while (prev.get(i) !== start && prev.get(i) !== -1 && prev.get(i) !== undefined) i = prev.get(i)!;
    if (i !== goal || prev.get(goal) === start) next = [i % W, (i / W) | 0];
    if (next && next[0] === tx && next[1] === ty) next = null;
  }
  w.pathCache.set(key, { t: w.time, next });
  return next;
}

/**
 * A parried melee blow dealt back to whoever threw it. Its own damage and its
 * own damage type, so a creature that shrugs off fire still shrugs it off
 * coming back — the shield returns the blow, it does not translate it.
 */
/**
 * One tick of a hidden monster. A ceiling dropper waits until you come
 * within `AMBUSH_TRIGGER`, sifts dust for `DROP_SECONDS`, then lands. A
 * buried one does the same with a rumble. A tunnelling burrower travels
 * towards your back first. None of them strike on arrival (see `emerge`).
 */
export function updateLurker(w: World, e: EnemyState, dt: number): void {
  const p = w.player;
  const dist = manhattan(e.x, e.y, p.x, p.y);
  if (e.tunnelling) {
    e.lurkT = (e.lurkT ?? 0) - dt;
    if (e.moveT < 1) {
      e.moveT = Math.min(1, e.moveT + dt / MOUND_STEP);
      return;
    }
    if (e.lurkT <= 0 || dist <= 1) {
      emerge(w, e, true);
      return;
    }
    // Head for the tile at your back. The floor is no obstacle to it, but
    // walls and doors are; it goes greedily, which you can read and turn to.
    const back = { x: p.x - DX[p.facing], y: p.y - DY[p.facing] };
    const step = DIRS.map((d) => ({ x: e.x + DX[d], y: e.y + DY[d] }))
      .filter((t) => !blocksMove(w.floor, t.x, t.y) && !(t.x === p.x && t.y === p.y))
      .sort((a, b) => manhattan(a.x, a.y, back.x, back.y) - manhattan(b.x, b.y, back.x, back.y))[0];
    if (step) {
      e.fromX = e.x; e.fromY = e.y;
      e.x = step.x; e.y = step.y;
      e.moveT = 0;
    }
    return;
  }
  if (e.lurkT === undefined) {
    if (dist > AMBUSH_TRIGGER) return;
    if (e.lurk === 'ceiling') {
      e.lurkT = DROP_SECONDS;
      w.sfx('drip', e.x, e.y);
      w.msg(e.spotted ? 'It lets go of the ceiling!' : 'Dust sifts down from above — something skitters!', '#d0b080');
    } else {
      e.lurkT = SURFACE_SECONDS;
      w.sfx('break', e.x, e.y);
      w.msg('The ground heaves!', '#c8a070');
    }
    return;
  }
  e.lurkT -= dt;
  if (e.lurkT <= 0) emerge(w, e, false);
}

/**
 * A lurker comes out onto the floor. Its own tile if that is free, otherwise
 * a free tile beside you — behind you, for a burrower that went looking for
 * your back. **It never strikes on arrival**: it lands in recovery, with a
 * beat before it may start a wind-up, so an ambush costs position and never
 * a free hit.
 */
export function emerge(w: World, e: EnemyState, preferBack: boolean): void {
  const p = w.player;
  const def = enemyDef(e.def);
  const open = (x: number, y: number) =>
    !blocksMove(w.floor, x, y) && !(x === p.x && y === p.y) && !enemyAt(w.floor, x, y);
  let spot = open(e.x, e.y) && !preferBack ? { x: e.x, y: e.y } : null;
  if (!spot) {
    const around = DIRS.map((d) => ({ x: p.x + DX[d], y: p.y + DY[d], d }))
      .filter((t) => open(t.x, t.y))
      .sort((a, b) => (preferBack ? (a.d === turnAround(p.facing) ? -1 : 0) - (b.d === turnAround(p.facing) ? -1 : 0) : 0));
    spot = around[0] ?? (open(e.x, e.y) ? { x: e.x, y: e.y } : null);
  }
  if (!spot) {
    // Nowhere to come out: it waits a little longer.
    e.lurkT = 0.3;
    return;
  }
  const was = e.lurk;
  delete e.lurk;
  delete e.lurkT;
  delete e.tunnelling;
  e.x = e.fromX = spot.x;
  e.y = e.fromY = spot.y;
  e.moveT = 1;
  const d = dirOf(Math.sign(p.x - e.x), Math.sign(p.y - e.y));
  if (d !== null) e.facing = d;
  e.ai = 'recover';
  e.timer = AMBUSH_BEAT;
  e.attackCd = Math.max(e.attackCd, AMBUSH_BEAT + 0.2);
  e.alert = 8;
  e.lastSeenX = p.x;
  e.lastSeenY = p.y;
  if (was === 'shadow') {
    Spells.addSpellFx(w, 'poof', e.x, e.y);
    w.sfx('kingturn', e.x, e.y);
    w.msg('The King steps out of the dark!', '#c080ff');
    return;
  }
  w.sfx(was === 'ceiling' ? 'plop' : 'break', e.x, e.y);
  w.emit({ type: 'shake', amount: 0.2 });
  const behind = e.x === p.x - DX[p.facing] && e.y === p.y - DY[p.facing];
  w.msg(was === 'ceiling'
    ? `A ${def.name} drops down${behind ? ' behind you' : ''}!`
    : `A ${def.name} bursts from the earth${behind ? ' behind you' : ''}!`, '#e0a070');
}

/**
 * A blow on a cracked wall. It wears the weapon like a landed hit and it is
 * loud: everything within `CRACK_NOISE` tiles comes to look, through walls.
 * At `CRACK_BLOWS` the wall goes, for good, and a seam or cache spills.
 */
export function strikeCrack(w: World, c: Crack): void {
  const f = w.floor;
  // A small secret, not a rule: the Mining Pick knows where stone gives, and
  // brings any cracked wall down in one. Every other weapon takes CRACK_BLOWS.
  const weapon = w.state.equipment.weapon;
  const pick = !!weapon && itemBase(weapon.ref).weaponClass === 'pick' && !durability(weapon).broken;
  c.hits = pick ? CRACK_BLOWS - 1 : c.hits;
  c.hits++;
  w.wear('weapon', CRACK_WEAR);
  w.sfx('break', c.x, c.y);
  w.emit({ type: 'shake', amount: 0.2 });
  w.emit({ type: 'crack', id: c.id, hits: c.hits });
  for (const e of f.enemies) {
    if (e.ai === 'dead' || e.lurk || Boss.protectedByFog(w, e)) continue;
    if (manhattan(e.x, e.y, c.x, c.y) > noise(w, CRACK_NOISE)) continue;
    e.alert = Math.max(e.alert, 6);
    e.lastSeenX = w.player.x;
    e.lastSeenY = w.player.y;
  }
  if (c.hits < CRACK_BLOWS) {
    w.msg(c.hits === 1 ? 'The cracked stone shifts. The sound carries.' : 'Dust pours from the crack.', '#c8b090');
    return;
  }
  c.broken = true;
  f.tiles[c.y * f.width + c.x] = FLOOR;
  if (pick) w.msg('The pick finds the fault line. The wall comes down in one.', '#e8d8a0');
  if (biomeForFloor(f).law === 'collapse') collapse(w, c.x, c.y);
  w.reveal();
  const rng = createRng(hashString(`crack:${f.seed}:${c.id}`));
  if (c.kind === 'seam') {
    const ore = materialForDepth(rng, w.run.depth, ['metal']);
    Loot.dropLoot(w, c.x, c.y, [makeMaterial(ore.id, rng.int(SEAM_ORE[0], SEAM_ORE[1]))], 0);
    w.msg(`The wall gives way. Ore spills from the seam: ${ore.name}.`, '#e8d8a0');
  } else if (c.kind === 'cache') {
    // Three loud blows and the wear on your blade: it pays like a chest,
    // and never nothing.
    const loot = Loot.containerLoot(w, rng, 'chest');
    Loot.dropLoot(w, c.x, c.y, loot.items, Math.max(loot.gold, CACHE_MIN_GOLD(w.run.depth)));
    w.msg('The wall gives way onto a sealed niche. Someone hid something here.', '#e8d8a0');
  } else {
    w.msg('The wall gives way. A way through!', '#e8d8a0');
  }
}

/**
 * One tick of a Gravecaller's necromancy. Returns true while it is chanting,
 * which is all it does then. Any blow breaks the chant (`hurtT` is set by
 * every hit), as does the corpse being shattered, sanctified or already up.
 */
export function updateRaiser(w: World, e: EnemyState, def: EnemyDef, dt: number): boolean {
  const f = w.floor;
  e.raiseCd = Math.max(0, (e.raiseCd ?? 0) - dt);
  if (e.channel) {
    const target = f.enemies.find((g) => g.id === e.channel!.target);
    if (e.hurtT > 0 || e.ai === 'recover') {
      delete e.channel;
      e.raiseCd = 1.5;
      w.msg('The chant breaks!', '#ffe8a0');
      return false;
    }
    if (!target || target.ai !== 'dead' || target.remains) {
      delete e.channel;
      return false;
    }
    e.channel.t -= dt;
    if (e.channel.t <= 0) {
      delete e.channel;
      e.raiseCd = RAISE_COOLDOWN;
      e.raised = (e.raised ?? 0) + 1;
      raiseCorpse(w, target);
    }
    return true;
  }
  if (e.alert <= 0 || e.raiseCd > 0 || (e.raised ?? 0) >= RAISE_LIMIT || e.ai === 'windup' || e.ai === 'recover') return false;
  const taken = new Set(f.enemies.map((g) => g.channel?.target).filter(Boolean));
  const corpse = f.enemies
    .filter((g) => g.ai === 'dead' && g !== e && !g.remains && g.burstT === undefined && !taken.has(g.id)
      && enemyDef(g.def).undead && enemyDef(g.def).behavior !== 'boss'
      && manhattan(g.x, g.y, e.x, e.y) <= RAISE_REACH && w.los(e.x, e.y, g.x, g.y))
    .sort((a, b) => manhattan(a.x, a.y, e.x, e.y) - manhattan(b.x, b.y, e.x, e.y))[0];
  if (!corpse) return false;
  e.channel = { target: corpse.id, t: RAISE_CHANNEL };
  const d = dirOf(Math.sign(corpse.x - e.x), Math.sign(corpse.y - e.y));
  if (d !== null) e.facing = d;
  w.sfx('magic', e.x, e.y);
  w.msg(`The ${def.name} begins to chant over the fallen ${enemyDef(corpse.def).name}.`, '#a0e0a0');
  return true;
}

/** A corpse stands back up: risen, so it pays nothing twice, and not swinging yet. */
export function raiseCorpse(w: World, g: EnemyState): void {
  const spot = freeTileForRise(w, g.x, g.y);
  g.hp = Math.max(1, Math.round(g.maxHp * RAISE_HP));
  g.risen = true;
  g.ai = 'recover';
  g.timer = RAISE_BEAT;
  g.attackCd = RAISE_BEAT + 0.2;
  g.deadT = 0;
  g.hurtT = 0;
  g.alert = 8;
  g.vuln = 0;
  g.guard = 'down';
  g.blocks = 0;
  g.x = g.fromX = spot.x;
  g.y = g.fromY = spot.y;
  g.moveT = 1;
  g.lastSeenX = w.player.x;
  g.lastSeenY = w.player.y;
  w.sfx('alert', g.x, g.y);
  w.emit({ type: 'shake', amount: 0.2 });
  w.msg(`The ${enemyDef(g.def).name} stands back up!`, '#a0e0a0');
}

/**
 * Where a corpse can stand up. Its own tile if nothing is on it — a knight
 * that rises underneath you can never reach you, because a melee strike wants
 * a distance of exactly one and it would sit at zero swinging forever.
 */
export function freeTileForRise(w: World, x: number, y: number): { x: number; y: number } {
  const clear = (tx: number, ty: number) =>
    !blocksMove(w.floor, tx, ty) &&
    !(tx === w.player.x && ty === w.player.y) &&
    !enemyAt(w.floor, tx, ty);
  if (clear(x, y)) return { x, y };
  for (const d of DIRS) {
    const tx = x + DX[d], ty = y + DY[d];
    if (clear(tx, ty)) return { x: tx, y: ty };
  }
  return { x, y };
}

/** Struck where it hides: dragged out early, reeling, open to double damage. */
export function knockOut(w: World, e: EnemyState): void {
  const def = enemyDef(e.def);
  const was = e.lurk;
  delete e.lurk;
  delete e.lurkT;
  delete e.tunnelling;
  e.moveT = 1;
  e.fromX = e.x; e.fromY = e.y;
  e.ai = 'recover';
  e.timer = KNOCKOUT_STUN;
  e.vuln = KNOCKOUT_STUN;
  e.attackCd = Math.max(e.attackCd, KNOCKOUT_STUN + 0.2);
  e.alert = 8;
  e.hurtT = 0.3;
  e.lastSeenX = w.player.x;
  e.lastSeenY = w.player.y;
  w.sfx('hit', e.x, e.y);
  w.emit({ type: 'shake', amount: 0.25 });
  w.msg(was === 'ceiling' ? `You knock the ${def.name} off the ceiling!` : `You drag the ${def.name} out of the earth!`, '#ffe8a0');
}

/** A burrower, badly hurt, goes under: a mound heading for your back. */
export function dive(w: World, e: EnemyState, def: EnemyDef): void {
  e.dived = true;
  e.lurk = 'buried';
  e.tunnelling = true;
  e.lurkT = w.rng.float(BURROW_MIN, BURROW_MAX);
  e.moveT = 1;
  e.ai = 'idle';
  e.guard = 'down';
  w.sfx('break', e.x, e.y);
  w.msg(`The ${def.name} dives into the earth!`, '#c8a070');
}

/**
 * A thief lifts one thing from your pack: a piece of gear whole, or half a
 * stack. Equipped gear is never at risk — only what you are carrying home,
 * which is the thing this whole game is about.
 */
export function pickPocket(w: World, e: EnemyState): void {
  const pack = w.run.backpack.items.filter((it) => it.kind !== 'lore');
  if (!pack.length) return;
  const target = w.rng.pick(pack);
  const taken = takeQty(w.run.backpack, target.uid, target.qty > 1 ? Math.ceil(target.qty / 2) : 1);
  if (!taken) return;
  e.stolen = [taken];
  e.stolenT = 0;
  e.trailN = 0;
  e.trailDrops = 0;
  e.ai = 'flee';
  e.alert = Math.max(e.alert, 6);
  w.emit({ type: 'float', x: w.player.x, y: w.player.y, text: 'Stolen!', color: '#e8c060' });
  w.sfx('gold', e.x, e.y);
  w.msg(`The ${Combat.view(w, e).name} snatches your ${itemName(taken)} and runs!`, '#e8c060');
}

/**
 * One tick of a thief running with your things. Returns true when it has
 * acted. It is meant to be a chase you can win, not a vanishing act:
 *
 * - **Clumsy**: after a step in your sight it sometimes stops to clutch the
 *   loot (`THIEF_FUMBLE_CHANCE` for `THIEF_FUMBLE` seconds).
 * - **Laden** only in principle: `THIEF_LADEN` is 1 now, since you already
 *   outpace a goblin.
 * - **Panicked, not clever**: it takes any step that is not closer to you,
 *   preferring to keep running straight, so it bolts down dead ends.
 * - **Goes to ground**: out of sight it keeps sprinting for `THIEF_BOLT`
 *   seconds, then creeps a tile only every `THIEF_CREEP` seconds, still
 *   glowing where it hides.
 * - **Leaves a trail**: every few steps a coin or two spills from its purse.
 *
 * It gets clean away after `THIEF_ESCAPE` seconds out of your sight, taking
 * what it stole. Cornered and in reach, it fights.
 */
export function runWithLoot(w: World, e: EnemyState, def: EnemyDef, dist: number, sees: boolean, dt: number): boolean {
  const p = w.player;
  e.stolenT = sees ? 0 : (e.stolenT ?? 0) + dt;
  if (e.stolenT >= THIEF_ESCAPE) {
    const lost = e.stolen!.map(itemName).join(', ');
    e.ai = 'dead';
    e.hp = 0;
    e.deadT = 99;
    delete e.stolen;
    delete e.stolenT;
    w.msg(`Somewhere in the dark, the ${def.name} gets away with your ${lost}.`, '#c89060');
    return true;
  }
  e.ai = 'flee';
  if ((e.pauseT ?? 0) > 0) {
    e.pauseT = e.pauseT! - dt;
    return true;
  }
  if (sees) { e.lastSeenX = p.x; e.lastSeenY = p.y; }
  // Out of sight it bolts for a moment, then goes to ground and creeps.
  if (!sees && e.stolenT >= THIEF_BOLT) e.pauseT = THIEF_CREEP;
  const fromX = sees ? p.x : e.lastSeenX, fromY = sees ? p.y : e.lastSeenY;
  const here = manhattan(e.x, e.y, fromX, fromY);
  const options = DIRS.map((d) => ({ d, x: e.x + DX[d], y: e.y + DY[d] }))
    .filter((t) => canStep(w, e, t.x, t.y) && manhattan(t.x, t.y, fromX, fromY) >= here);
  if (options.length) {
    // Keep running the way it was going, if it can; otherwise any way that
    // is not towards you. No lookahead: a dead end is as good as a door.
    const pick = options.find((t) => t.d === e.facing && w.rng.chance(0.75)) ?? w.rng.pick(options);
    const fromTileX = e.x, fromTileY = e.y;
    stepEnemy(w, e, pick.x, pick.y);
    e.trailN = (e.trailN ?? 0) + 1;
    if (e.trailN % THIEF_TRAIL_EVERY === 0 && (e.trailDrops ?? 0) < THIEF_TRAIL_MAX) {
      e.trailDrops = (e.trailDrops ?? 0) + 1;
      Loot.dropLoot(w, fromTileX, fromTileY, [], w.rng.int(1, 3));
      if (e.trailDrops === 1 && sees) w.msg(`Coins spill from the ${def.name}'s purse as it runs.`, '#e8c060');
    }
    if (sees && w.rng.chance(THIEF_FUMBLE_CHANCE)) {
      e.pauseT = THIEF_FUMBLE;
      w.msg(`The ${def.name} fumbles its prize!`, '#e8c060');
    }
    return true;
  }
  if (dist === 1 && e.attackCd <= 0) {
    beginWindup(w, e, def, p.x, p.y);
    return true;
  }
  return true;
}

/**
 * A Vengeful corpse goes off: its own tile and the four beside it. It is a
 * blow like any other from that tile — facing it, you can block or parry it;
 * standing on the body, you cannot. Monsters caught in it take it raw, the
 * way they take a trap, which makes killing one beside its friends a tactic.
 */
export function vengefulBurst(w: World, e: EnemyState): void {
  const def = enemyDef(e.def);
  const attack = Math.max(1, Math.round(def.attack * attackPower(e.power) * VENGEFUL_DAMAGE_MULT * w.diff.enemyDamage));
  const inBlast = (x: number, y: number) => manhattan(x, y, e.x, e.y) <= 1;
  w.sfx('lava_burst', e.x, e.y);
  w.emit({ type: 'float', x: e.x, y: e.y, text: 'Burst!', color: '#c070ff' });
  for (const other of w.floor.enemies) {
    if (other === e || other.ai === 'dead' || other.lurk || !inBlast(other.x, other.y)) continue;
    const odef = enemyDef(other.def);
    const dealt = Math.max(1, Math.round(def.attack * attackPower(e.power) * VENGEFUL_DAMAGE_MULT * (odef.resist[def.damageType] ?? 1)));
    w.hurt(other, dealt, `${dealt}`, '#c070ff');
    if (other.hp <= 0) Combat.killEnemy(w, other);
  }
  if (inBlast(w.player.x, w.player.y)) {
    w.msg(`The Vengeful ${def.name}'s corpse bursts!`, '#c070ff');
    w.emit({ type: 'shake', amount: 0.5 });
    Combat.damagePlayer(w, attack, def.damageType, e.x, e.y, `Vengeful ${def.name}`, def.id);
  } else {
    w.msg('The corpse bursts harmlessly behind you.', '#9a80b0');
  }
}

/** Goblins under a living Quartermaster hit harder (and never flee): the damage multiplier. */
export function rally(w: World, e: EnemyState): number {
  if (!isGoblin(e.def)) return 1;
  return w.floor.enemies.some((q) => q.lieutenant === 'quartermaster' && q.ai !== 'dead') ? RALLY_DAMAGE : 1;
}

/**
 * The Hoarder's tick. Returns true when it has acted. It goes for the nearest
 * loot pile on its floor (never a key or a flask shard), stuffs it into its
 * sack, and keeps away from you; only cornered and in reach does it fight.
 */
export function updateHoarder(w: World, e: EnemyState, def: EnemyDef, dist: number, sees: boolean): boolean {
  const f = w.floor;
  const p = w.player;
  const here = f.pickups.find((k) => k.x === e.x && k.y === e.y && !k.keyId && !k.flaskShard && (k.items.length || k.gold > 0));
  if (here) {
    (e.hoard ??= []).push(...here.items);
    e.hoardGold = (e.hoardGold ?? 0) + here.gold;
    f.pickups = f.pickups.filter((k) => k !== here);
    if (sees) w.msg('The Hoarder stuffs the pile into its sack.', LIEUTENANTS.hoarder.color);
    return true;
  }
  if (sees && dist <= HOARDER_SHY) {
    const away = DIRS.map((d) => [e.x + DX[d], e.y + DY[d]] as [number, number])
      .filter(([x, y]) => canStep(w, e, x, y) && manhattan(x, y, p.x, p.y) > dist)[0];
    if (away) {
      stepEnemy(w, e, away[0], away[1]);
      return true;
    }
    // Cornered: in reach, it fights like anything else.
    return dist > 1;
  }
  const target = f.pickups
    .filter((k) => !k.keyId && !k.flaskShard && (k.items.length || k.gold > 0) && manhattan(k.x, k.y, e.x, e.y) <= HOARDER_REACH)
    .sort((a, b) => manhattan(a.x, a.y, e.x, e.y) - manhattan(b.x, b.y, e.x, e.y))[0];
  if (target) {
    // pathStep stops short of its goal (it was written for closing on you),
    // so the last step onto the pile is taken here.
    const adjacent = manhattan(target.x, target.y, e.x, e.y) === 1;
    const next = adjacent ? (canStep(w, e, target.x, target.y) ? [target.x, target.y] as [number, number] : null) : pathStep(w, e, target.x, target.y);
    if (next) stepEnemy(w, e, next[0], next[1]);
    return true;
  }
  // Nothing to take: it keeps its distance rather than hunting you.
  return dist > 1;
}

/** Burrows: how far a noise of radius `r` actually carries on this floor. */
export function noise(w: World, r: number): number {
  const burrows = biomeForFloor(w.floor).law === 'noise' ? BURROWS_NOISE_MULT : 1;
  const silence = runOath(w.run, 'silence') ? SILENCE_NOISE : 1;
  return Math.round(r * burrows * silence);
}

/** Silence is broken by the loud things: an alarm ward you spring, or Wardcry. */
export function breakSilence(w: World, what: string): void {
  const oath = runOath(w.run, 'silence');
  if (!oath || oath.status === 'broken') return;
  oath.status = 'broken';
  w.msg(`${what}. The oath of Silence is broken.`, OATHS.silence.color);
}

/**
 * Ossuary: undead remains that were neither shattered nor sanctified stir
 * `OSSUARY_STIR_AFTER` seconds after death, then stand `OSSUARY_STIR` later
 * at `OSSUARY_RISE_HP`, risen, so they pay nothing twice and never rise
 * again. Only on the crossing, so corpses left behind on a floor you walk
 * back onto do not all stand at once.
 */
export function ossuaryStir(w: World, e: EnemyState, before: number, dt: number): void {
  if (e.stirT !== undefined) {
    e.stirT -= dt;
    if (e.stirT > 0) return;
    delete e.stirT;
    if (e.remains) return;
    raiseCorpse(w, e);
    e.hp = Math.max(1, Math.round(e.maxHp * OSSUARY_RISE_HP));
    return;
  }
  if (before >= OSSUARY_STIR_AFTER || e.deadT < OSSUARY_STIR_AFTER) return;
  const def = enemyDef(e.def);
  if (!def.undead || def.behavior === 'boss' || e.risen || e.remains || e.burstT !== undefined || e.mimicTier) return;
  e.stirT = OSSUARY_STIR;
  if (manhattan(e.x, e.y, w.player.x, w.player.y) <= 10) w.msg(`The ${def.name}'s bones stir.`, LAWS.restless.color);
}

/**
 * Mines: a cracked wall brought down drops its rotten timbering on every
 * monster beside it, for a crushing blow and a stagger. You are the one
 * striking it, from beside it, so the roof never falls on you.
 */
export function collapse(w: World, x: number, y: number): void {
  const dealtTo: string[] = [];
  for (const e of w.floor.enemies) {
    if (e.ai === 'dead' || e.lurk || manhattan(e.x, e.y, x, y) !== 1) continue;
    const def = enemyDef(e.def);
    const dealt = Math.max(1, Math.round((COLLAPSE_BASE + COLLAPSE_PER_DEPTH * w.run.depth) * (def.resist.blunt ?? 1)));
    w.hurt(e, dealt, `${dealt}!`, LAWS.collapse.color);
    e.alert = Math.max(e.alert, 8);
    if (def.behavior !== 'boss') {
      e.ai = 'recover';
      e.timer = Math.max(e.timer, COLLAPSE_STUN);
      e.attackCd = Math.max(e.attackCd, COLLAPSE_STUN + 0.2);
    }
    dealtTo.push(def.name);
    if (e.hp <= 0) Combat.killEnemy(w, e);
  }
  w.emit({ type: 'shake', amount: 0.5 });
  w.msg(dealtTo.length ? `The timbers give and the roof comes down on the ${dealtTo.join(' and the ')}!` : 'The timbers give. Rock rains down where the wall stood.', LAWS.collapse.color);
}

/**
 * Kindling: a blow with fire in it, landing on a monster below `KINDLING_AT`
 * of its health, also burns one monster beside it for the fire share.
 */
export function kindle(w: World, e: EnemyState): void {
  const fire = w.derived.stats.fire ?? 0;
  if (fire <= 0 || e.hp >= e.maxHp * KINDLING_AT) return;
  const near = w.floor.enemies.filter((o) => o !== e && o.ai !== 'dead' && !o.lurk && manhattan(o.x, o.y, e.x, e.y) === 1);
  if (!near.length) return;
  const o = w.rng.pick(near);
  const mult = enemyDef(o.def).resist.fire ?? 1;
  const dealt = Math.round(fire * KINDLING_SPREAD * w.anim.attackPower * mult);
  if (dealt <= 0) return;
  w.hurt(o, dealt, `${dealt}`, '#ff9a50');
  o.alert = Math.max(o.alert, 8);
  if (o.hp <= 0) Combat.killEnemy(w, o);
}

/**
 * How an undead monster fell, for any Gravecaller nearby: a blunt killing
 * blow, or one that overkills by `SHATTER_OVERKILL`, shatters the bones; a
 * killing blow carrying holy damage, or struck from consecrated ground,
 * sanctifies them. Either way nothing raises it.
 */
export function markRemains(w: World, e: EnemyState, how?: 'sanctified'): void {
  if (!enemyDef(e.def).undead) return;
  const overkill = -e.hp >= e.maxHp * SHATTER_OVERKILL;
  const ward = w.anim.ward;
  const consecrated = !!ward && ward.x === w.player.x && ward.y === w.player.y;
  if (how) e.remains = how;
  else if (w.derived.damageType === 'blunt' || overkill) e.remains = 'shattered';
  else if ((w.derived.stats.holy ?? 0) > 0 || consecrated) e.remains = 'sanctified';
  else return;
  const caller = w.floor.enemies.some((g) => g.ai !== 'dead' && enemyDef(g.def).raises && manhattan(g.x, g.y, e.x, e.y) <= 10);
  if (caller) w.msg(e.remains === 'shattered' ? 'The bones shatter. Nothing will call these back.' : 'The remains are sanctified. They will stay down.', '#e8e0c0');
}
