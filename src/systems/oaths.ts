import { createRng, hashString } from '../core/rng';
import { GameState, RunState } from '../state/game-state';
import { BLOOD_PRICE_GOLD, HUNTER_MARKS, OATH_FALLBACK, OATH_PICKS, OathId, OathState, findOath } from '../data/oaths';
import { learnProperty, unlearnedProperties } from './properties';

/**
 * Swear (or, with null, unswear) the oath for the next delve. Only in town,
 * between delves, and not while a kept oath's reward is still unchosen: a
 * second reward would overwrite the first.
 */
export function swearOath(state: GameState, id: OathId | null): boolean {
  if (state.run) return false;
  if (id !== null && state.oathReward) return false;
  if (id !== null && !findOath(id)) return false;
  state.pendingOath = id;
  return true;
}

/** Called as a delve starts: the sworn oath moves onto the run and takes hold. */
export function beginOath(state: GameState, run: RunState): void {
  const id = state.pendingOath;
  state.pendingOath = null;
  if (!id || !findOath(id)) return;
  run.oath = { id, status: 'active', marks: 0, placed: [] };
  if (id === 'blood_price') run.curse = 'frailty';
}

/** Whether the oath on this run has been kept, given how the delve ended. */
export function oathKept(run: RunState, outcome: 'dead' | 'extracted'): boolean {
  const oath = run.oath;
  if (!oath || outcome !== 'extracted' || oath.status === 'broken') return false;
  switch (oath.id) {
    case 'blood_price': return run.stats.goldFound >= BLOOD_PRICE_GOLD;
    case 'unbroken': return oath.status === 'kept';
    case 'hunter': return (oath.marks ?? 0) >= HUNTER_MARKS;
  }
}

/**
 * Settle the oath at the end of a delve. A kept oath leaves a reward waiting in
 * town: three unlearned properties, drawn from the run's seed so a reload
 * cannot reroll them, of which a medium oath learns one and a hard oath two.
 * With nothing left to learn it pays renown, twice as much for a hard oath.
 * Returns what happened, for the results screen.
 */
export function settleOath(state: GameState, run: RunState, outcome: 'dead' | 'extracted'): { id: OathId; kept: boolean; renown: number } | null {
  const oath: OathState | undefined = run.oath;
  if (!oath) return null;
  const kept = oathKept(run, outcome);
  let renown = 0;
  if (kept) {
    const tier = findOath(oath.id)!.tier;
    const pool = unlearnedProperties(state);
    if (pool.length) {
      const rng = createRng(hashString(`oath:${run.seed}:${oath.id}`));
      const choices = rng.shuffle([...pool]).slice(0, 3);
      state.oathReward = { oath: oath.id, choices, picks: Math.min(OATH_PICKS[tier], choices.length) };
    } else {
      renown = OATH_FALLBACK[tier];
      state.renown += renown;
    }
  }
  return { id: oath.id, kept, renown };
}

/**
 * Learn one of a waiting reward's choices. The reward stays until its picks are
 * used up (a hard oath's two), with the learned one taken off the list.
 */
export function claimOathReward(state: GameState, id: string): boolean {
  const reward = state.oathReward;
  if (!reward || !reward.choices.includes(id)) return false;
  learnProperty(state, id);
  const left = (reward.picks ?? 1) - 1;
  const choices = reward.choices.filter((c) => c !== id);
  state.oathReward = left > 0 && choices.length ? { ...reward, choices, picks: left } : null;
  return true;
}
