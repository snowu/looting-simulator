import { Rng } from '../core/rng';
import { DamageType, DEFAULT_CRIT_MULT, ELEMENTS, EnemyDef } from '../types';
import { PlayerDerived } from './player';
import { clamp } from '../core/math';

/**
 * Physical mitigation: defense shaves a proportion off, never below `floor`.
 * `k` sets how much defense it takes to halve a hit.
 */
export function mitigate(attack: number, defense: number, k: number, floor = 0.2): number {
  return attack * Math.max(floor, 1 - defense / (defense + k));
}

/** Damage multiplier for staminas at swing time: full power above half a bar. */
export function staminaPower(stamina: number, maxStamina: number): number {
  const f = clamp(stamina / (maxStamina * 0.5), 0, 1);
  return 0.4 + 0.6 * f;
}

export interface PlayerHit {
  damage: number;
  crit: boolean;
  /** Per-type breakdown, for resist feedback. */
  effective: 'weak' | 'resist' | 'normal' | 'immune';
}

/**
 * How hard it is to cut through a monster's armour. It was 15, which made
 * armour so sharp a knob that the only usable values were tiny ones: 30 defense
 * on a Hollow Knight turned a 62-attack axe into 13 damage and a 25-swing
 * fight. Wider means armour can carry real numbers and still be a slope rather
 * than a wall — it is the reason to bring the right weapon, not a refusal.
 */
const ENEMY_ARMOUR_K = 45;

/**
 * Elemental damage is armour-piercing, but not armour-*ignoring*. It used to be
 * added flat after mitigation, which was harmless while deep monsters had 9
 * defense and became an outright bypass the moment they had 40 — a star-iron
 * axe would have done more to a plated knight through its shadow rider than
 * through the axe. Half weight keeps "bring fire to the frost" meaningful while
 * leaving armour worth wearing.
 */
const ELEMENTAL_ARMOUR_WEIGHT = 0.5;

export function playerHitsEnemy(
  rng: Rng,
  p: PlayerDerived,
  power: number,
  e: EnemyDef,
  /** Depth armour scaling, from `defensePower`. 1 for a monster at its home floor. */
  defenseMult = 1,
  /**
   * Attack added for this swing only — the Prize Bull's Horn banks it as the
   * charge builds. It goes in **here**, with the rest of your Attack, so armour
   * takes its cut of it and a target that is immune to the blow is immune to
   * this too. Added to the damage afterwards it would have been an armour
   * bypass wearing the words "+4 Attack".
   */
  bonusAttack = 0,
): PlayerHit {
  const defense = e.defense * defenseMult;
  const physMult = e.resist[p.damageType] ?? 1;
  let dmg = mitigate(p.attack + bonusAttack, defense, ENEMY_ARMOUR_K) * physMult;
  let bestMult = physMult;
  for (const el of ELEMENTS) {
    const v = p.stats[el];
    if (v <= 0) continue;
    const m = e.resist[el] ?? 1;
    dmg += mitigate(v, defense * ELEMENTAL_ARMOUR_WEIGHT, ENEMY_ARMOUR_K) * m;
    bestMult = Math.max(bestMult, m);
  }
  // A weapon sworn against the dead only cares whether the thing is dead.
  if (e.undead) dmg *= p.traits.undeadBane;
  dmg *= power * rng.float(0.9, 1.1);
  const crit = rng.chance(Math.min(0.6, p.stats.luck / 100));
  if (crit) dmg *= p.swing.critMult ?? DEFAULT_CRIT_MULT;
  const effective = physMult === 0 && bestMult === 0 ? 'immune' : bestMult >= 1.4 ? 'weak' : physMult <= 0.7 && bestMult < 1 ? 'resist' : 'normal';
  return { damage: Math.max(dmg > 0 ? 1 : 0, Math.round(dmg)), crit, effective };
}

/** Global tuning knob for how hard monsters hit. */
export const ENEMY_DAMAGE_MULT = 1.15;

/**
 * Your armour.
 *
 * `k` is deliberately large and the floor is deliberately high. With the old
 * k=25 and a 20% floor, a suit of moonsilver plate did not reduce damage, it
 * deleted it: 75 defense sat at the clamp, and a Hollow Knight needed 26 swings
 * to kill a player it should have needed six for. Armour should be the
 * difference between four hits and nine, never the difference between dying and
 * not noticing. A blow always lands for at least a third.
 */
const PLAYER_ARMOUR_K = 75;
const PLAYER_ARMOUR_FLOOR = 0.34;

export function enemyHitsPlayer(rng: Rng, attack: number, type: DamageType, p: PlayerDerived): number {
  // Elemental hits ignore half of armour.
  const def = type === 'slash' || type === 'pierce' || type === 'blunt' ? p.stats.defense : p.stats.defense * 0.5;
  return Math.max(1, Math.round(mitigate(attack * ENEMY_DAMAGE_MULT, def, PLAYER_ARMOUR_K, PLAYER_ARMOUR_FLOOR) * rng.float(0.85, 1.15)));
}
