import { Rng } from '../core/rng';
import { DamageType, DEFAULT_CRIT_MULT, ELEMENTS, EnemyDef } from '../types';
import { PlayerDerived } from './player';

/**
 * Physical mitigation: defense shaves a proportion off, never below 20%.
 * `k` sets how much defense it takes to halve a hit.
 */
export function mitigate(attack: number, defense: number, k: number): number {
  return attack * Math.max(0.2, 1 - defense / (defense + k));
}

/** Damage multiplier for staminas at swing time: full power above half a bar. */
export function staminaPower(stamina: number, maxStamina: number): number {
  const f = Math.max(0, Math.min(1, stamina / (maxStamina * 0.5)));
  return 0.4 + 0.6 * f;
}

export interface PlayerHit {
  damage: number;
  crit: boolean;
  /** Per-type breakdown, for resist feedback. */
  effective: 'weak' | 'resist' | 'normal' | 'immune';
}

export function playerHitsEnemy(rng: Rng, p: PlayerDerived, power: number, e: EnemyDef): PlayerHit {
  const physMult = e.resist[p.damageType] ?? 1;
  let dmg = mitigate(p.attack, e.defense, 15) * physMult;
  let bestMult = physMult;
  for (const el of ELEMENTS) {
    const v = p.stats[el];
    if (v <= 0) continue;
    const m = e.resist[el] ?? 1;
    dmg += v * m;
    bestMult = Math.max(bestMult, m);
  }
  dmg *= power * rng.float(0.9, 1.1);
  const crit = rng.chance(Math.min(0.6, p.stats.luck / 100));
  if (crit) dmg *= p.swing.critMult ?? DEFAULT_CRIT_MULT;
  const effective = physMult === 0 && bestMult === 0 ? 'immune' : bestMult >= 1.4 ? 'weak' : physMult <= 0.7 && bestMult < 1 ? 'resist' : 'normal';
  return { damage: Math.max(dmg > 0 ? 1 : 0, Math.round(dmg)), crit, effective };
}

/** Global tuning knob for how hard monsters hit. */
export const ENEMY_DAMAGE_MULT = 1.15;

export function enemyHitsPlayer(rng: Rng, attack: number, type: DamageType, p: PlayerDerived): number {
  // Elemental hits ignore half of armour.
  const def = type === 'slash' || type === 'pierce' || type === 'blunt' ? p.stats.defense : p.stats.defense * 0.5;
  return Math.max(1, Math.round(mitigate(attack * ENEMY_DAMAGE_MULT, def, 25) * rng.float(0.85, 1.15)));
}
