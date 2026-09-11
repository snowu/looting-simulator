import { createRng, randomSeed } from '../core/rng';
import { Item } from '../types';
import { GameState, RunState, RunSummary } from '../state/game-state';
import { Container, addItem, createContainer } from '../state/inventory';
import { generateFloor, stairsFront } from './dungeon';
import { backpackCapacity, metaLevel, renownForRun } from './meta';
import { derivePlayer } from './player';
import { makeConsumable } from './items';
import { advanceDay } from './market';
import { recordDepth, refreshContracts } from './contracts';

/**
 * Keep the town-side pack at the current backpack size. Called whenever the
 * town is drawn, so buying Pack Mule widens it straight away.
 */
export function syncLoadout(state: GameState): Container {
  state.loadout ??= createContainer(backpackCapacity(state.meta));
  state.loadout.capacity = backpackCapacity(state.meta);
  return state.loadout;
}

/**
 * Deposit the coin you are carrying into the town purse. Called when a town
 * portal brings you home mid-run: you are standing in Hollowmere, so the gold
 * is spendable and no longer at risk if the rest of the delve goes badly.
 */
export function bankCarriedGold(state: GameState): number {
  const run = state.run;
  if (!run || run.gold <= 0) return 0;
  const banked = run.gold;
  run.gold = 0;
  state.gold += banked;
  state.lifetime.goldEarned += banked;
  return banked;
}

export function startRun(state: GameState, seed = randomSeed()): RunState {
  const floor = generateFloor(seed, 1);
  const up = floor.stairs.find((s) => !s.down)!;
  const spawn = stairsFront(up);
  const d = derivePlayer(state.equipment, state.meta);
  const backpack = createContainer(backpackCapacity(state.meta));
  const crate = metaLevel(state.meta, 'supply_crate');
  if (crate > 0) addItem(backpack, makeConsumable('healing_draught', crate));
  // Everything packed in town comes with you. Anything that no longer fits
  // (the pack shrank, or the crate filled a slot) goes back to the stash.
  for (const it of syncLoadout(state).items) {
    const left = addItem(backpack, it);
    if (left > 0) addItem(state.stash, { ...it, qty: left });
  }
  state.loadout.items = [];
  const run: RunState = {
    seed,
    rngState: createRng(seed ^ 0x5bd1e995).state,
    depth: 1,
    floors: [floor],
    player: { x: spawn.x, y: spawn.y, facing: spawn.facing, hp: d.maxHp, stamina: d.maxStamina },
    backpack,
    gold: 0,
    keys: [],
    blessing: null,
    portal: null,
    stats: { kills: 0, goldFound: 0, itemsFound: 0, deepest: 1, time: 0, bossKilled: false },
    outcome: 'active',
  };
  state.run = run;
  state.lifetime.runs += 1;
  recordDepth(state.contracts, 1);
  return run;
}

/**
 * Close out the run: bank or lose the backpack, award renown, advance the day
 * (market moves, contracts age). Returns the summary for the results screen.
 */
export function endRun(state: GameState, outcome: 'dead' | 'extracted'): RunSummary {
  const run = state.run!;
  const kept: Item[] = [];
  const lost: Item[] = [];
  let gold = run.gold;
  if (outcome === 'extracted') {
    kept.push(...run.backpack.items);
    state.lifetime.extractions += 1;
  } else {
    // Soul Pouch: the first few slots and some coin survive.
    const pouch = metaLevel(state.meta, 'soul_pouch');
    const keepSlots = 3 * pouch;
    run.backpack.items.forEach((it, i) => (i < keepSlots ? kept : lost).push(it));
    gold = Math.floor(gold * 0.2 * pouch);
    state.lifetime.deaths += 1;
  }
  for (const it of kept) addItem(state.stash, it);
  state.gold += gold;
  state.lifetime.goldEarned += gold;
  state.lifetime.kills += run.stats.kills;
  state.lifetime.bestDepth = Math.max(state.lifetime.bestDepth, run.stats.deepest);
  const renown = renownForRun(run.stats.deepest, outcome === 'extracted', run.stats.bossKilled);
  state.renown += renown;

  const summary: RunSummary = {
    outcome,
    day: state.market.day,
    depth: run.stats.deepest,
    gold,
    items: kept,
    lost,
    renown,
    kills: run.stats.kills,
    bossKilled: run.stats.bossKilled,
    killedBy: run.killedBy,
  };
  state.lastRun = summary;
  state.run = null;

  // A new day dawns in town.
  const dayRng = createRng(randomSeed());
  advanceDay(state.market, dayRng, state.lifetime.bestDepth);
  state.contracts = refreshContracts(state.contracts, dayRng, Math.max(1, state.lifetime.bestDepth));
  return summary;
}
