/**
 * Your health and your gear's: healing from every source (with Last Flask,
 * dregs and the difficulty's healing), Normal's rest mending, draughts
 * taking effect, and wear on weapons and armour.
 */
import { OATHS, UNBROKEN_WEAR } from '../data/oaths';
import { LAST_FLASK_MULT } from '../data/properties';
import { DREGS_FRACTION, flaskMax } from '../systems/healing';
import { Draught, KINDLE_SECONDS, MARROW_SECONDS, WARD_SECONDS } from '../systems/infusion';
import { durability, itemName, wearItem } from '../systems/items';
import { runOath } from '../systems/oaths';
import { EquipSlot } from '../types';
import type { World } from './world';

/** Normal's mending: seconds unhurt before it starts, and share of max health per second. */
export const REST_DELAY = 5;

export const REST_RATE = 0.02;

/**
 * Every drop of healing in the game goes through here, which is what lets one
 * suit of armour halve all of it at once. Returns what was actually restored.
 * Difficulty mends faster on Normal; Hard multiplies by exactly 1.
 */
export function heal(w: World, amount: number, source?: 'food' | 'leech'): number {
  // Last Flask: with the flask dry, food and leech carry you.
  const lastFlask = source && w.derived.traits.lastFlask && (w.run.flask?.charges ?? 1) <= 0 ? LAST_FLASK_MULT : 1;
  const scaled = Math.round(amount * lastFlask * w.derived.traits.healing * w.diff.playerHealing);
  const healed = Math.min(Math.max(0, scaled), w.derived.maxHp - w.player.hp);
  w.player.hp += healed;
  const overflow = Math.max(0, scaled - healed);
  if (overflow > 0) {
    const flask = (w.run.flask ??= { charges: flaskMax(w.state.flask?.shards ?? 0, w.diff.flaskBonus), dregs: 0 });
    const max = flaskMax(w.state.flask?.shards ?? 0, w.diff.flaskBonus);
    const threshold = Math.max(1, w.derived.maxHp * DREGS_FRACTION);
    flask.dregs = Math.min(threshold, flask.dregs + overflow);
    if (flask.dregs >= threshold && flask.charges < max) {
      flask.dregs = 0;
      flask.charges++;
      w.msg('The flask draws a charge from its dregs.', '#a0d8c8');
    }
  }
  return healed;
}

/**
 * Wear a piece of equipment and say something only when it crosses a line:
 * once when it is nearly gone, once when it goes. A message per swing would
 * be noise, and noise is how a player learns to stop reading the log.
 *
 * The Brittle curse adds +1 to every wear event, which is what makes
 * finding a font urgent rather than theoretical.
 */
export function wear(w: World, slot: EquipSlot, amount = 1): void {
  // Normal: gear does not wear at all.
  if (!w.diff.gearWears) return;
  const it = w.state.equipment[slot];
  if (w.run.curse === 'brittle') amount += 1;
  const oath = runOath(w.run, 'unbroken');
  if (oath) amount *= UNBROKEN_WEAR;
  const crossed = wearItem(it, amount);
  if (crossed === 'none' || !it) return;
  const name = itemName(it);
  if (crossed === 'warn') w.msg(`Your ${name} is close to failing.`, '#e8c060');
  else {
    w.msg(`Your ${name} breaks!`, '#ff7070');
    w.sfx('break');
    w.emit({ type: 'shake', amount: 0.3 });
    if (oath && oath.status === 'active') {
      oath.status = 'broken';
      w.msg('Your oath breaks with it. Unbroken is lost.', OATHS.unbroken.color);
    }
  }
  w.refreshDerived();
}

/**
 * Normal's slow mending. After REST_DELAY seconds without losing health,
 * with nothing on the floor hunting you, health creeps back up to
 * `restHeal` of the maximum. Any lost health, from any source, restarts
 * the wait. It never tops you up past the line, and never fights for you.
 */
export function restHeal(w: World, dt: number): void {
  const p = w.player;
  if (p.hp < w.restLastHp) w.restWait = 0;
  else w.restWait += dt;
  const cap = Math.round(w.derived.maxHp * w.diff.restHeal);
  const hunted = w.floor.enemies.some((e) => e.ai !== 'dead' && !e.lurk && e.alert > 0);
  if (!hunted && w.restWait >= REST_DELAY && p.hp > 0 && p.hp < cap) {
    // Health stays whole: the mend builds up here and lands a point at a
    // time. It answers to half_healing like every other heal, but not to
    // Normal's playerHealing, since this rate is already Normal's own knob.
    w.restMend += w.derived.maxHp * REST_RATE * dt * w.derived.traits.healing;
    const whole = Math.floor(w.restMend);
    if (whole > 0) {
      w.restMend -= whole;
      p.hp = Math.min(cap, p.hp + whole);
    }
  } else {
    w.restMend = 0;
  }
  w.restLastHp = p.hp;
}

/** Armour wears where you were actually hit: one worn piece takes the scuff. */
export function wearArmour(w: World): void {
  const worn = (['body', 'head', 'hands'] as EquipSlot[]).filter((s) => {
    const it = w.state.equipment[s];
    return it && !durability(it).broken;
  });
  // 2 per unblocked hit (was 1): armour is a consumable now, not furniture.
  if (worn.length) wear(w, w.rng.pick(worn), 2);
}

/** A swing that hit nothing still dulls the edge, slowly: 1 wear per 3 whiffs. */
export function wearWhiff(w: World): void {
  w.whiffs += 1;
  if (w.whiffs >= 3) {
    w.whiffs = 0;
    wear(w, 'weapon', 1);
  }
}

/**
 * What the infusion does once the sip has landed. Named every time, so the
 * player learns what their flask is by drinking it.
 */
export function drinkDraught(w: World, d: Draught | null): void {
  if (!d) return;
  const a = w.anim;
  switch (d.kind) {
    case 'breath':
      w.player.stamina = w.derived.maxStamina;
      w.msg(`${d.name}: your wind comes back.`, d.color);
      break;
    case 'iron':
      a.draught = { kind: 'iron', t: WARD_SECONDS, total: WARD_SECONDS };
      w.msg(`${d.name}: iron settles over you. The next blow is blunted.`, d.color);
      break;
    case 'marrow':
      a.draught = { kind: 'marrow', t: MARROW_SECONDS, total: MARROW_SECONDS };
      w.msg(`${d.name}: your arm fills. Make the next strike count.`, d.color);
      break;
    case 'kindled':
      a.draught = { kind: 'kindled', t: KINDLE_SECONDS, total: KINDLE_SECONDS };
      w.refreshDerived();
      w.msg(`${d.name}: your weapon takes it. ${d.kindleLabel}.`, d.color);
      break;
    default:
      // Thick, Quick and Fight Milk are in the heal, the sip time and the
      // delve itself; there is nothing further to announce.
      break;
  }
}
