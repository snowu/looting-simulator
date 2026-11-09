/**
 * Shrines and what they answer (blessings, curses, the coffer, the trial
 * of strife), the town portal you tear open and walk back through, and
 * whether something is hunting you too closely to use them. interact on
 * World is the entry point.
 */
import { DIRS } from '../core/dir';
import { gold } from '../core/format';
import { manhattan } from '../core/math';
import { biomeForFloor } from '../data/biomes';
import { ENEMIES } from '../data/enemies';
import { OATHS, PILGRIM_IDOL_CURSE } from '../data/oaths';
import { blocksMove, createEnemy, enemyAt, inBounds, portalAt, Prop, propAt, shrineKind } from '../systems/dungeon';
import { flaskMax } from '../systems/healing';
import { runOath } from '../systems/oaths';
import * as Loot from './loot';
import type { World } from './world';
import { BLESSINGS, COFFER_MAX_OFFERINGS, CURSES } from './world';

export const COFFER_FIZZLE = 0.25;

/** Something alive and interested, close enough that you are still in a fight. */
export function threatNear(w: World): boolean {
  const p = w.player;
  for (const e of w.floor.enemies) {
    // A lurker is not in the fight until it drops: counting it would give it away.
    if (e.ai === 'dead' || e.lurk) continue;
    const dist = manhattan(e.x, e.y, p.x, p.y);
    if (dist <= 2) return true;
    if (dist <= 4 && e.alert > 0 && w.los(p.x, p.y, e.x, e.y)) return true;
  }
  return false;
}

/**
 * Tear open a town portal on a free tile next to you (or under you if there
 * is nowhere else). Only one is ever open: reading a second scroll moves it.
 */
export function openTownPortal(w: World): void {
  // In front of you where there is room, so you can see what you opened.
  const front = w.frontTile();
  const clear = (t: { x: number; y: number }) => !blocksMove(w.floor, t.x, t.y) && !propAt(w.floor, t.x, t.y);
  const spot = clear(front) ? front : Loot.freeTileNear(w, w.player.x, w.player.y);
  w.closeTownPortal();
  w.floor.props.push({
    id: `town_portal_${Math.round(w.time * 1000)}`,
    kind: 'town_portal',
    x: spot.x,
    y: spot.y,
    used: false,
    tier: 'none',
    blocking: false,
    mimic: false,
  });
  w.run.portal = { depth: w.run.depth, x: spot.x, y: spot.y };
  w.sfx('recall');
  w.msg('A portal tears open. It holds until you step back through.', '#9ac0ff');
  w.emit({ type: 'shake', amount: 0.25 });
}

/** The town portal, if you are standing on it or facing it. */
export function townPortalHere(w: World): Prop | undefined {
  return portalNear(w, 'town_portal');
}

/** The boss's exit portal, if you are standing on it or facing it. */
export function portalHere(w: World): Prop | undefined {
  return portalNear(w, 'portal');
}

export function portalNear(w: World, kind: 'portal' | 'town_portal'): Prop | undefined {
  const t = w.frontTile();
  return portalAt(w.floor, t.x, t.y, kind) ?? portalAt(w.floor, w.player.x, w.player.y, kind);
}

/**
 * What a shrine gives back. Not a full heal any more: a font that refills the
 * bar is a save point, and a save point on every other floor is the end of
 * attrition as a mechanic. It is a large, welcome, *partial* mend.
 */
export function restore(w: World, refillFlask = false): void {
  w.heal(Math.round(w.derived.maxHp * 0.6));
  w.player.stamina = w.derived.maxStamina;
  if (refillFlask) {
    const flask = w.run.flask;
    flask.charges = Math.min(flaskMax(w.state.flask?.shards ?? 0, w.diff.flaskBonus), flask.charges + 1);
  }
}

export function grantBlessing(w: World): boolean {
  if (w.run.blessing) return false;
  const id = w.rng.pick(Object.keys(BLESSINGS));
  const before = w.derived.maxHp;
  w.run.blessing = id;
  w.refreshDerived();
  // Vitality raises the ceiling: heal the gained amount on pickup, so the
  // blessing feels like a gift rather than a larger empty bar.
  if (id === 'vitality') w.player.hp = Math.min(w.derived.maxHp, w.player.hp + Math.max(0, w.derived.maxHp - before));
  w.msg(`Blessing of ${BLESSINGS[id].name}: ${BLESSINGS[id].text}`, '#a0c8ff');
  return true;
}

export function pray(w: World, p: Prop): void {
  w.sfx('magic');
  switch (shrineKind(p)) {
    // The safe one. A large mend and it washes off a curse — which is what
    // makes a font worth crossing a floor for once an idol has marked you.
    case 'font': {
      // Blood Price's Frailty is sworn, not suffered: the water leaves it.
      const sworn = !!runOath(w.run, 'blood_price') && w.run.curse === 'frailty';
      const lifted = sworn ? null : w.run.curse;
      if (!sworn) w.run.curse = null;
      if (sworn) w.msg('The water will not touch a sworn price. Frailty stays.', OATHS.blood_price.color);
      w.refreshDerived();
      restore(w, true);
      if (lifted) w.msg(`The water runs black and clears. ${CURSES[lifted].name} is washed away.`, '#a0c8ff');
      else w.msg('Cold clean water. Most of the hurt goes out of you.', '#a0c8ff');
      return;
    }

    // The gamble. Thirteen times in twenty it gives; the rest of the time
    // it takes, and what it takes lasts the rest of the run. Slightly
    // kinder than before (was 60/40) to compensate stronger curses.
    case 'idol': {
      // A Pilgrim's idol is crueller: it curses far more often than it gives.
      if (w.rng.chance(runOath(w.run, 'pilgrim') ? 1 - PILGRIM_IDOL_CURSE : 0.65)) {
        restore(w, true);
        if (!grantBlessing(w)) w.msg('The idol is satisfied. Much of the hurt leaves you.', '#a0c8ff');
        return;
      }
      const id = w.rng.pick(Object.keys(CURSES));
      w.run.curse = id;
      w.refreshDerived();
      w.msg(`The idol drinks something out of you. ${CURSES[id].name}: ${CURSES[id].text}`, '#c080ff');
      w.emit({ type: 'shake', amount: 0.4 });
      w.sfx('hurt');
      return;
    }

    // The thirsty one: up to three paid offerings, each 75% dearer than
    // the last, and one time in four the stone takes the coin and answers
    // with silence — no mend, no blessing. A fizzled offering still counts:
    // three payments is three payments.
    case 'coffer': {
      const made = p.offerings ?? 0;
      if (made >= COFFER_MAX_OFFERINGS) return;
      const cost = w.offeringCost(made);
      if (w.run.gold < cost) {
        // Not consumed — come back with the coin.
        p.used = false;
        w.msg(`The bowl is empty and stays empty. It wants ${cost} gold.`, '#c8a060');
        w.sfx('locked', p.x, p.y);
        return;
      }
      w.run.gold -= cost;
      p.offerings = made + 1;
      if (p.offerings >= COFFER_MAX_OFFERINGS) {
        // interact() already marked it used; staying used means quiet.
        w.msg('The stone drinks deep and goes dark. It will take no more.', '#c8a060');
      } else {
        // Keep it touchable for the next, dearer offering.
        p.used = false;
      }
      if (w.rng.chance(COFFER_FIZZLE)) {
        w.msg('The coin vanishes into the stone. Nothing answers.', '#8888a0');
        w.sfx('gold');
        return;
      }
      restore(w);
      if (!grantBlessing(w)) w.msg('The coin vanishes. Much of the hurt leaves you.', '#e8c060');
      w.sfx('gold');
      return;
    }

    // The red one. Half your current health, rounded down, for gold that
    // scales with depth and with what you paid. It cannot kill you: at 1 HP
    // it refuses. Single use — HP is a currency now, and the font
    // and the draughts are where you buy it back.
    case 'blood': {
      if (w.player.hp <= 1) {
        p.used = false;
        w.msg('You have nothing left to give.', '#c8a060');
        return;
      }
      const pay = Math.floor(w.player.hp / 2);
      const prize = 40 + 30 * w.run.depth + pay;
      w.player.hp -= pay;
      w.run.gold += prize;
      w.run.stats.goldFound += prize;
      w.emit({ type: 'float', x: p.x, y: p.y, text: `+${gold(prize)}`, color: '#ffd24a' });
      w.msg(`Your blood runs into the brass bowl. +${prize} gold.`, '#ff8090');
      w.sfx('hurt');
      return;
    }

    // The trial. Free to invoke, paid in nerve: depth-appropriate enemies
    // rise around the shrine, already looking at you. They drop their
    // ordinary loot, and the last trial-marked kill pays the prize.
    // One trial at a time — a second challenge waits its turn.
    case 'combat': {
      if (w.run.trial && w.run.trial.ids.length > 0) {
        p.used = false;
        w.msg('The yard is already bloodied. Finish the trial first.', '#c8a060');
        return;
      }
      const ids = raiseTrial(w, p);
      if (!ids.length) {
        p.used = false;
        w.msg('The embers stir, then settle. No room to bleed here.', '#8888a0');
        return;
      }
      w.run.trial = { propId: p.id, ids };
      w.msg(`The ember shrine catches. ${ids.length} rise for the trial!`, '#ff9a50');
      w.emit({ type: 'shake', amount: 0.5 });
      w.sfx('alert');
      return;
    }
  }
}

/**
 * Raise a strife trial around a shrine: 2 + ceil(depth/2) enemies from the
 * same pool the floor itself draws on (never the boss), on free tiles near
 * the stone, already alerted. Returns the marked ids (empty when the room
 * is too cramped to bleed in).
 */
export function raiseTrial(w: World, p: Prop): string[] {
  const f = w.floor;
  const biome = biomeForFloor(f);
  const depth = w.run.depth;
  const pool = ENEMIES.filter((e) =>
    e.weight > 0 && e.behavior !== 'boss' && e.minDepth <= depth && depth <= e.maxDepth &&
    !(biome.element && e.element && e.element !== biome.element));
  if (!pool.length) return [];
  const want = 2 + Math.ceil(depth / 2);
  const ids: string[] = [];
  let n = 0;
  outer: for (let r = 1; r <= 4 && ids.length < want; r++) {
    for (let dy = -r; dy <= r && ids.length < want; dy++) {
      for (let dx = -r; dx <= r && ids.length < want; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = p.x + dx, y = p.y + dy;
        if (!inBounds(f, x, y) || blocksMove(f, x, y)) continue;
        if (x === w.player.x && y === w.player.y) continue;
        if (enemyAt(f, x, y)) continue;
        if (f.props.some((q) => q.blocking && q.x === x && q.y === y)) continue;
        const def = w.rng.weighted(pool.map((e) => [e, e.weight] as const));
        const id = `trial_${p.id}_${n++}`;
        const e = createEnemy(def, x, y, w.rng.pick(DIRS), id, depth, w.difficultyId);
        e.alert = 8;
        e.lastSeenX = w.player.x;
        e.lastSeenY = w.player.y;
        f.enemies.push(e);
        ids.push(id);
      }
    }
  }
  return ids;
}

/** A trial-marked kill: strike it from the roll, and pay the prize when the roll is empty. */
export function trialKill(w: World, id: string): void {
  const trial = w.run.trial;
  if (!trial) return;
  trial.ids = trial.ids.filter((t) => t !== id);
  if (trial.ids.length > 0) return;
  w.run.trial = null;
  const prize = 60 + 40 * w.run.depth;
  Loot.dropLoot(w, w.player.x, w.player.y, [], prize);
  w.emit({ type: 'float', x: w.player.x, y: w.player.y, text: `+${gold(prize)}`, color: '#ffd24a' });
  w.msg('The trial is survived. The shrine pays its prize.', '#ffb050');
  w.sfx('gold');
}
