/**
 * Elemental hazards on the floor and on the creatures standing in it:
 * oil, water, ice, spores, fire vents and barrels, and the burn, chill and
 * slip they leave behind. World.update calls updateAfflictions and
 * updateSurfaces once a tick.
 */
import { DIRS, DX, DY } from '../core/dir';
import { manhattan } from '../core/math';
import { biomeForFloor } from '../data/biomes';
import { BURN_SECONDS } from '../data/conduit-spells';
import { enemyDef } from '../data/enemies';
import { LAWS } from '../data/laws';
import { BURST_TICKS, FIRE_MONSTER_BASE, FIRE_MONSTER_PER_DEPTH, FIRE_PLAYER_BASE, FIRE_PLAYER_PER_DEPTH, FIRE_TICK, FLOOD_REACH, FREEZE_SECONDS, PLAYER_FREEZE_SECONDS, SLIP_SECONDS, SPORE_BLIND, SPORE_BURST_TICKS, Surface, VENT_FLAMES, VENT_PERIOD_MAX, VENT_PERIOD_MIN, VENT_TICKS } from '../data/surfaces';
import { recordDamageDealt } from '../systems/bestiary';
import { enemyAt, EnemyState, Prop } from '../systems/dungeon';
import { burningAt, chill, freezeFlood, ignite, oilBarrelAt, spillOil, surfaceAt, surfaceKindAt, tickSurfaces } from '../systems/surfaces';
import { DamageType } from '../types';
import type { World } from './world';
import * as Boss from './boss';

/** Burns tick down and chills wear off. Run every frame over the floor. */
export function updateAfflictions(w: World, dt: number): void {
  for (const e of w.floor.enemies) {
    if (e.ai === 'dead') {
      if (e.burn) delete e.burn;
      if (e.chillT !== undefined) delete e.chillT;
      if (e.hexT !== undefined) delete e.hexT;
      if (e.frozenT !== undefined) delete e.frozenT;
      continue;
    }
    // The hex runs on the world's clock, not the penguin's: it counts down
    // through every step it waddles, which the AI tick skips.
    if (e.hexT !== undefined) {
      e.hexT -= dt;
      if (e.hexT <= 0) w.unhex(e);
    }
    if (e.frozenT !== undefined) {
      e.frozenT -= dt;
      if (e.frozenT <= 0) delete e.frozenT;
    }
    if (e.chillT !== undefined) {
      e.chillT -= dt;
      // A wind-up begun chilled runs to its end chilled, or its tell would
      // jump forward the instant the frost wore off.
      if (e.chillT <= 0) {
        if (e.ai === 'windup') e.chillT = 0.01;
        else delete e.chillT;
      }
    }
    const burn = e.burn;
    if (!burn) continue;
    const step = Math.min(burn.left, (burn.left / Math.max(dt, burn.t)) * dt);
    burn.t -= dt;
    burn.left -= step;
    burn.acc += step;
    const whole = Math.floor(burn.acc);
    if (whole >= 1 && !Boss.protectedByFog(w, e)) {
      burn.acc -= whole;
      w.hurt(e, whole, `${whole}`, '#ff9a50');
      recordDamageDealt(w.state.bestiary, enemyDef(e.def).id, whole);
    }
    if (burn.t <= 0 || burn.left <= 0) delete e.burn;
    if (e.hp <= 0) w.killEnemy(e);
  }
}

/**
 * The floor's surfaces on the world clock (`tickSurfaces`), and fire biting
 * whatever stands in it every `FIRE_TICK`: you through your armour, like a
 * trap, and a monster raw, × its fire resistance.
 */
export function updateSurfaces(w: World, dt: number): void {
  const f = w.floor;
  w.surfaceMsgCd = Math.max(0, w.surfaceMsgCd - dt);
  if (!f.surfaces?.length) return;
  const tick = tickSurfaces(f, dt);
  if (tick.caught.length) w.sfx('lava_burst', tick.caught[0].x, tick.caught[0].y);
  for (const s of tick.burst) sporesBurst(w, s.x, s.y);
  for (const v of tick.vents) ventBurst(w, v);
  if (w.run.outcome !== 'active') return;
  w.fireTick += dt;
  if (w.fireTick < FIRE_TICK) return;
  w.fireTick -= FIRE_TICK;
  const fires = f.surfaces.filter((s) => s.kind === 'fire');
  if (!fires.length) return;
  const p = w.player;
  if (burningAt(f, p.x, p.y) && w.surfaceMsgCd <= 0) {
    w.msg('You are standing in fire!', '#ff8040');
    w.surfaceMsgCd = 2;
  }
  for (const s of fires) {
    scorch(w, s.x, s.y, 1, 'burning oil');
    if (w.run.outcome !== 'active') return;
  }
}

/**
 * Fire's bite on one tile, `ticks` times over: you through your armour,
 * unavoidable like a trap; a monster raw, × its fire resistance, and set
 * burning so it carries the fire out with it (into more oil, or into water,
 * which puts it out).
 */
export function scorch(w: World, x: number, y: number, ticks: number, source: string): void {
  const f = w.floor;
  const p = w.player;
  const depth = w.run.depth;
  if (p.x === x && p.y === y) {
    const bite = Math.max(1, Math.round((FIRE_PLAYER_BASE + FIRE_PLAYER_PER_DEPTH * depth) * ticks * w.diff.trapDamage));
    w.damagePlayer(bite, 'fire', x, y, source, undefined, undefined, true);
    if (w.run.outcome !== 'active') return;
  }
  for (const e of f.enemies) {
    if (e.ai === 'dead' || e.lurk || e.x !== x || e.y !== y || Boss.protectedByFog(w, e)) continue;
    const def = enemyDef(e.def);
    const dealt = Math.max(1, Math.round((FIRE_MONSTER_BASE + FIRE_MONSTER_PER_DEPTH * depth) * ticks * (def.resist.fire ?? 1)));
    if (dealt <= 0) continue;
    w.hurt(e, dealt, `${dealt}`, '#ff8040');
    recordDamageDealt(w.state.bestiary, def.id, dealt);
    e.burn = { t: BURN_SECONDS, left: Math.max(e.burn?.left ?? 0, Math.round(dealt * 2 / ticks)), acc: e.burn?.acc ?? 0 };
    if (e.hp <= 0) {
      w.msg(`The ${def.name} burns.`, '#ff8040');
      w.killEnemy(e);
    }
  }
}

/** A burst of fire over a tile and the four beside it: a barrel, or spores catching. */
export function blast(w: World, x: number, y: number, ticks: number, source: string): void {
  w.addSpellFx('blast', x, y);
  w.sfx('lava_burst', x, y);
  w.emit({ type: 'shake', amount: 0.3 });
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    // The blast lights what it touches, then burns what stands there.
    elementReaches(w, x + dx, y + dy, 'fire');
    scorch(w, x + dx, y + dy, ticks, source);
    if (w.run.outcome !== 'active') return;
  }
}

/** Spores catching fire: they go up all at once. */
export function sporesBurst(w: World, x: number, y: number): void {
  if (w.surfaceMsgCd <= 0) {
    w.msg('The spores go up in a gout of flame!', LAWS.spores.color);
    w.surfaceMsgCd = 2;
  }
  blast(w, x, y, SPORE_BURST_TICKS, 'burning spores');
}

/**
 * An Emberworks vent breathes out: whatever stands on it is scorched, the
 * oil beside it catches, and it waits a while before the next. Its glow
 * in the last `VENT_TELL` seconds is the warning.
 */
export function ventBurst(w: World, v: Surface): void {
  v.t = VENT_PERIOD_MIN + w.rng.float(0, VENT_PERIOD_MAX - VENT_PERIOD_MIN);
  v.burst = VENT_FLAMES;
  w.sfx('lava_burst', v.x, v.y);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) elementReaches(w, v.x + dx, v.y + dy, 'fire');
  scorch(w, v.x, v.y, VENT_TICKS, 'a fire vent');
}

/**
 * Fire or frost arriving on a tile, from anything: a bolt crossing it, a
 * blow landing on it, a burning creature's feet. Any other element passes.
 * Water freezing around a monster holds it fast; around you, briefly. Fire
 * reaching an oil barrel bursts it.
 */
export function elementReaches(w: World, x: number, y: number, element: DamageType): void {
  const f = w.floor;
  if (element === 'fire') {
    const barrel = oilBarrelAt(f, x, y);
    if (barrel) {
      burstBarrel(w, barrel);
      return;
    }
    const change = ignite(f, x, y);
    if (change === 'lit') {
      w.sfx('lava_burst', x, y);
      if (w.surfaceMsgCd <= 0) {
        w.msg('The oil catches!', '#ff9a50');
        w.surfaceMsgCd = 2;
      }
    } else if (change === 'burst') sporesBurst(w, x, y);
    else if (change === 'melted') w.sfx('splash', x, y);
    return;
  }
  if (element !== 'frost' || chill(f, x, y) !== 'froze') return;
  w.sfx('block', x, y);
  frozeAt(w, x, y);
}

/** Water just froze on this tile: whoever stands in it is caught, except you by your own frost. */
export function frozeAt(w: World, x: number, y: number, mine = false): void {
  const e = enemyAt(w.floor, x, y);
  if (e) freeze(w, e);
  const p = w.player;
  if (!mine && p.x === x && p.y === y) {
    w.anim.stunT = Math.max(w.anim.stunT, PLAYER_FREEZE_SECONDS);
    w.msg('The water freezes around your feet!', '#9ad0ff');
  }
}

/**
 * Frost has landed somewhere: where a bolt struck or ran out. In the
 * Catacombs that is on the flood, which freezes around it. A frost blade's
 * blows do not count — they land on the creature, not the water, and a
 * moonsilver axe would otherwise freeze everything it touched. Your own
 * bolt never holds you; theirs does.
 */
export function frostLands(w: World, x: number, y: number, mine: boolean): void {
  if (biomeForFloor(w.floor).law !== 'flood') return;
  const froze = freezeFlood(w.floor, x, y, FLOOD_REACH);
  if (!froze.length) return;
  w.sfx('block', x, y);
  for (const s of froze) frozeAt(w, s.x, s.y, mine);
}

/** An oil barrel broken open: the oil goes everywhere, and nothing else is in it. */
export function spillBarrel(w: World, p: Prop): Surface[] {
  p.used = true;
  w.sfx('break', p.x, p.y);
  w.sfx('splash', p.x, p.y);
  const oil = spillOil(w.floor, p.x, p.y, w.rng);
  if (w.surfaceMsgCd <= 0) {
    w.msg('Lamp oil spreads across the floor.', '#c8b8a0');
    w.surfaceMsgCd = 2;
  }
  return oil;
}

/** Fire reaches an oil barrel: it bursts, its spill goes up at once, and what stands beside it is caught. */
export function burstBarrel(w: World, p: Prop): void {
  spillBarrel(w, p);
  w.msg('The oil barrel bursts into flame!', '#ff9a50');
  w.surfaceMsgCd = 2;
  blast(w, p.x, p.y, BURST_TICKS, 'a burning oil barrel');
}

/**
 * Something treads on a spore patch: it puffs, and every monster within a
 * tile is blinded for `SPORE_BLIND` (bosses only wave it away). If you are
 * in it too, your lamp dims for as long.
 */
export function sporePuff(w: World, x: number, y: number): void {
  const f = w.floor;
  const s = surfaceAt(f, x, y);
  if (!s || s.kind !== 'spores') return;
  f.surfaces = f.surfaces!.filter((o) => o !== s);
  w.addSpellFx('spores', x, y);
  w.sfx('snuff', x, y);
  let blinded = 0;
  for (const e of f.enemies) {
    if (e.ai === 'dead' || e.lurk || manhattan(e.x, e.y, x, y) > 1) continue;
    if (enemyDef(e.def).behavior === 'boss') continue;
    e.blind = Math.max(e.blind ?? 0, SPORE_BLIND);
    if (e.ai === 'windup') e.ai = 'recover';
    blinded++;
  }
  const p = w.player;
  const you = manhattan(p.x, p.y, x, y) <= 1;
  if (you) w.anim.snuffT = Math.max(w.anim.snuffT, SPORE_BLIND);
  if (w.surfaceMsgCd <= 0) {
    w.msg(blinded ? `A cloud of spores bursts up. ${blinded === 1 ? 'Something' : 'They'} cannot see!` : you ? 'A cloud of spores bursts up around you.' : 'A puffball bursts.', LAWS.spores.color);
    w.surfaceMsgCd = 2;
  }
}

/** Held fast in ice: it stops whatever it was doing. The King breaks free at once. */
export function freeze(w: World, e: EnemyState, seconds = FREEZE_SECONDS, quiet = false): void {
  const def = enemyDef(e.def);
  if (def.behavior === 'boss' || e.ai === 'dead') return;
  e.frozenT = Math.max(e.frozenT ?? 0, seconds);
  e.ai = 'recover';
  e.timer = Math.max(e.timer, seconds);
  e.attackCd = Math.max(e.attackCd, seconds + 0.2);
  delete e.move;
  delete e.feintT;
  delete e.feinted;
  delete e.comboLeft;
  delete e.comboT;
  delete e.channel;
  w.emit({ type: 'float', x: e.x, y: e.y, text: 'frozen', color: '#9ad0ff' });
  if (!quiet) w.msg(`The water freezes around the ${def.name}!`, '#9ad0ff');
}

/** Struck on ice: it goes down, and whatever it was winding up is lost. */
export function slip(w: World, e: EnemyState): void {
  if (e.ai === 'dead' || (e.frozenT ?? 0) > 0 || surfaceKindAt(w.floor, e.x, e.y) !== 'ice') return;
  const def = enemyDef(e.def);
  if (def.behavior === 'boss') return;
  e.ai = 'recover';
  e.timer = Math.max(e.timer, SLIP_SECONDS);
  e.attackCd = Math.max(e.attackCd, SLIP_SECONDS + 0.2);
  // The Frost Vault: it goes down hard, open like a parried thing.
  if (biomeForFloor(w.floor).law === 'treacherous') e.vuln = Math.max(e.vuln ?? 0, SLIP_SECONDS);
  delete e.move;
  delete e.comboLeft;
  delete e.comboT;
  w.emit({ type: 'float', x: e.x, y: e.y - 0.3, text: 'slips', color: '#c8e8ff' });
  if (w.surfaceMsgCd <= 0) {
    w.msg(`The ${def.name} slips on the ice!`, '#c8e8ff');
    w.surfaceMsgCd = 2;
  }
}

/** One step out of the fire, to any tile that is not burning. False when there is none. */
export function escapeFire(w: World, e: EnemyState): boolean {
  const steps = DIRS.map((d) => [e.x + DX[d], e.y + DY[d]] as [number, number]).filter(([x, y]) => w.canStep(e, x, y));
  if (!steps.length) return false;
  const p = w.player;
  // Out towards you if it was coming for you, else anywhere.
  steps.sort((a, b) => manhattan(a[0], a[1], p.x, p.y) - manhattan(b[0], b[1], p.x, p.y));
  w.stepEnemy(e, steps[0][0], steps[0][1]);
  return true;
}
