import { createRng, hashString } from '../core/rng';
import { GameState, RunState } from '../state/game-state';
import {
  BLOOD_PRICE_GOLD, DRY_THROAT_DEPTH, DUELIST_KILLS, HUNTER_MARKS, OATH_FALLBACK, OATH_PICKS, OathId, OathState,
  PILGRIM_PRAYERS, SILENCE_DEPTH, STACK_BONUS, STACK_BONUS_AT, UNBROKEN_DEPTH, findOath, oathsForDay,
} from '../data/oaths';
import { learnProperty, unlearnedProperties } from './properties';
import { difficultyOf } from '../data/difficulty';

/** Today's oaths on the stone, for this playthrough. */
export function todaysOaths(state: GameState): OathId[] {
  // Unbroken asks you not to break your gear, which cannot happen where nothing wears.
  return oathsForDay(state.saveId ?? '', state.market.day, difficultyOf(state.difficulty).gearWears ? [] : ['unbroken']);
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
  // Unbroken sworn on Hard before a switch to Normal has nothing to ask of the delve: dropped.
  const wears = difficultyOf(state.difficulty).gearWears;
  const ids = pendingOaths(state).filter((id) => wears || id !== 'unbroken');
  state.pendingOaths = [];
  state.pendingOath = null;
  if (!ids.length) return;
  run.oaths = ids.map((id) => ({ id, status: 'active', marks: 0, placed: [], kills: 0, prayers: 0 }));
  if (ids.includes('blood_price')) run.curse = 'frailty';
  if (ids.includes('dry_throat') && run.flask) run.flask.charges = 0;
}

/**
 * Where one oath's task stands on this delve: whether it is done, and what is
 * left in the HUD's words ('' once there is nothing left to show). The one
 * place each oath's objective is written; whether it was kept only adds how
 * the delve ended.
 */
export function oathProgress(run: RunState, oath: OathState): { met: boolean; left: string } {
  const task = (met: boolean, left: string) => ({ met, left: met ? '' : left });
  const count = (have: number, need: number, what: string) => task(have >= need, `${have}/${need} ${what}`);
  const reach = (depth: number) => task(run.stats.deepest >= depth, `reach depth ${depth}`);
  switch (oath.id) {
    case 'blood_price': return count(run.stats.goldFound, BLOOD_PRICE_GOLD, 'gold');
    // Kept the moment its depth is reached whole. Reaching it is enough for a
    // delve saved before that moment was recorded, but only the recorded
    // moment reads as done on the HUD.
    case 'unbroken': return { met: oath.status === 'kept' || run.stats.deepest >= UNBROKEN_DEPTH, left: oath.status === 'kept' ? '' : `reach depth ${UNBROKEN_DEPTH}` };
    case 'hunter': return count(oath.marks ?? 0, HUNTER_MARKS, 'marked');
    case 'dry_throat': return reach(DRY_THROAT_DEPTH);
    case 'duelist': return count(oath.kills ?? 0, DUELIST_KILLS, 'kills');
    case 'kingsbane': return task(run.stats.bossKilled, 'the King');
    case 'silence': return reach(SILENCE_DEPTH);
    case 'pilgrim': return count(oath.prayers ?? 0, PILGRIM_PRAYERS, 'shrines');
  }
  return { met: false, left: '' };
}

/** Whether one oath on this run has been kept, given how the delve ended. */
export function oathKept(run: RunState, oath: OathState, outcome: 'dead' | 'extracted'): boolean {
  return outcome === 'extracted' && oath.status !== 'broken' && oathProgress(run, oath).met;
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

/**
 * Learn one of a waiting reward's choices. The reward stays until its picks are
 * used up, with the learned one taken off the list.
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
