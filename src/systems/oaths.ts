import { createRng, hashString } from '../core/rng';
import { GameState, RunState } from '../state/game-state';
import {
  BLOOD_PRICE_GOLD, DRY_THROAT_DEPTH, DUELIST_KILLS, HUNTER_MARKS, OATH_FALLBACK, OATH_PICKS, OathId, OathState,
  PILGRIM_PRAYERS, SILENCE_DEPTH, STACK_BONUS, STACK_BONUS_AT, UNBROKEN_DEPTH, findOath, oathsForDay,
} from '../data/oaths';
import { learnProperty, unlearnedProperties } from './properties';

/** Today's oaths on the stone, for this playthrough. */
export function todaysOaths(state: GameState): OathId[] {
  return oathsForDay(state.saveId ?? '', state.market.day);
}

/** The oaths sworn for the next delve, from the current field or the single one before oaths stacked. */
export function pendingOaths(state: GameState): OathId[] {
  const list = state.pendingOaths ?? (state.pendingOath ? [state.pendingOath] : []);
  return list.filter((id) => !!findOath(id));
}

/** The oaths on a delve, however it was saved. */
export function runOaths(run: RunState): OathState[] {
  return run.oaths ?? (run.oath ? [run.oath] : []);
}

/** One oath on this delve, if it was sworn. */
export function runOath(run: RunState, id: OathId): OathState | undefined {
  return runOaths(run).find((o) => o.id === id);
}

/**
 * Swear or unswear one of today's oaths for the next delve. Any number can be
 * sworn at once. Only in town between delves, and not while a kept oath's
 * reward is still unchosen: a second reward would overwrite the first.
 */
export function toggleOath(state: GameState, id: OathId): boolean {
  if (state.run || !findOath(id)) return false;
  const set = new Set(pendingOaths(state));
  if (set.has(id)) {
    set.delete(id);
  } else {
    if (state.oathReward || !todaysOaths(state).includes(id)) return false;
    set.add(id);
  }
  state.pendingOaths = [...set];
  state.pendingOath = null;
  return true;
}

/** Called as a delve starts: the sworn oaths move onto the run and take hold. */
export function beginOaths(state: GameState, run: RunState): void {
  const ids = pendingOaths(state);
  state.pendingOaths = [];
  state.pendingOath = null;
  if (!ids.length) return;
  run.oaths = ids.map((id) => ({ id, status: 'active', marks: 0, placed: [], kills: 0, prayers: 0 }));
  if (ids.includes('blood_price')) run.curse = 'frailty';
  if (ids.includes('dry_throat') && run.flask) run.flask.charges = 0;
}

/** Whether one oath on this run has been kept, given how the delve ended. */
export function oathKept(run: RunState, oath: OathState, outcome: 'dead' | 'extracted'): boolean {
  if (outcome !== 'extracted' || oath.status === 'broken') return false;
  switch (oath.id) {
    case 'blood_price': return run.stats.goldFound >= BLOOD_PRICE_GOLD;
    case 'unbroken': return oath.status === 'kept' || run.stats.deepest >= UNBROKEN_DEPTH;
    case 'hunter': return (oath.marks ?? 0) >= HUNTER_MARKS;
    case 'dry_throat': return run.stats.deepest >= DRY_THROAT_DEPTH;
    case 'duelist': return (oath.kills ?? 0) >= DUELIST_KILLS;
    case 'kingsbane': return run.stats.bossKilled;
    case 'silence': return run.stats.deepest >= SILENCE_DEPTH;
    case 'pilgrim': return (oath.prayers ?? 0) >= PILGRIM_PRAYERS;
  }
  return false;
}

export interface OathOutcome {
  results: { id: OathId; kept: boolean }[];
  /** Inscriptions to learn from the reward, or 0. */
  picks: number;
  /** Renown paid instead, when there is nothing left to learn. */
  renown: number;
  /** Whether every sworn oath was kept, with enough sworn for the bonus. */
  bonus: boolean;
}

/**
 * Settle the delve's oaths. Each kept oath pays on its own: a medium one an
 * inscription, a hard one two. Keep every oath you swore, having sworn at
 * least `STACK_BONUS_AT`, and one more on top. The inscriptions are chosen in
 * town from a list at least one longer than the picks, drawn from the run's
 * seed so a reload cannot reroll it. With nothing left to learn, renown.
 */
export function settleOaths(state: GameState, run: RunState, outcome: 'dead' | 'extracted'): OathOutcome | null {
  const oaths = runOaths(run);
  if (!oaths.length) return null;
  const results = oaths.map((o) => ({ id: o.id, kept: oathKept(run, o, outcome) }));
  const kept = results.filter((r) => r.kept);
  const bonus = kept.length === results.length && results.length >= STACK_BONUS_AT;
  let picks = kept.reduce((n, r) => n + OATH_PICKS[findOath(r.id)!.tier], 0) + (bonus ? STACK_BONUS : 0);
  let renown = 0;
  if (picks > 0) {
    const pool = unlearnedProperties(state);
    if (pool.length) {
      const rng = createRng(hashString(`oath:${run.seed}:${kept.map((r) => r.id).join(',')}`));
      const choices = rng.shuffle([...pool]).slice(0, Math.max(3, picks + 1));
      picks = Math.min(picks, choices.length);
      state.oathReward = { oaths: kept.map((r) => r.id), choices, picks };
    } else {
      renown = kept.reduce((n, r) => n + OATH_FALLBACK[findOath(r.id)!.tier], 0) + (bonus ? OATH_FALLBACK.medium : 0);
      state.renown += renown;
      picks = 0;
    }
  }
  return { results, picks, renown, bonus };
}

/**
 * Learn one of a waiting reward's choices. The reward stays until its picks are
 * used up, with the learned one taken off the list.
 */
/** How many inscriptions the waiting reward still lets you learn. */
export function oathRewardPicks(state: GameState): number {
  const reward = state.oathReward;
  return reward ? Math.min(reward.picks ?? 1, reward.choices.length) : 0;
}

/**
 * Learn every pick of the waiting reward at once. Refused unless `ids` are
 * that many distinct choices from the offer.
 */
export function claimOathRewards(state: GameState, ids: string[]): boolean {
  const reward = state.oathReward;
  if (!reward || new Set(ids).size !== ids.length || ids.length !== oathRewardPicks(state)) return false;
  if (!ids.every((id) => reward.choices.includes(id))) return false;
  for (const id of ids) learnProperty(state, id);
  state.oathReward = null;
  return true;
}

export function claimOathReward(state: GameState, id: string): boolean {
  const reward = state.oathReward;
  if (!reward || !reward.choices.includes(id)) return false;
  learnProperty(state, id);
  const left = (reward.picks ?? 1) - 1;
  const choices = reward.choices.filter((c) => c !== id);
  state.oathReward = left > 0 && choices.length ? { ...reward, choices, picks: left } : null;
  return true;
}
