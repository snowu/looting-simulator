import { DRY_WELL_CHARGES, SEAL_RENOWN, sealFloorMods, validSeals } from '../data/seals';
import { sealsUnlocked } from './seals';
import { digGrave, placeShade } from './grave';
import { itemBase } from '../data/items';
import { roadsForDay } from '../data/routes';
import { beginOath, settleOath } from './oaths';
import { createRng, randomSeed } from '../core/rng';
import { Item } from '../types';
import { GameState, RunState, RunSummary } from '../state/game-state';
import { Container, addItem, createContainer } from '../state/inventory';
import { generateFloor, stairsFront } from './dungeon';
import { backpackCapacity, metaLevel, renownForRun } from './meta';
import { derivePlayer } from './player';
import { difficultyOf } from '../data/difficulty';
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
 * portal brings you home mid-run: you are standing in Bleakmere, so the gold
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
  if (state.fallen) throw new Error('A fallen Hardcore hero cannot delve again.');
  // The delve plays at the town difficulty, snapshotted here: whatever the
  // town selector says afterwards does not touch this run.
  const difficulty = difficultyOf(state.difficulty).id;
  state.difficulty = difficulty;
  // Ashen Seals, once the King has fallen: snapshotted for the whole delve.
  const seals = sealsUnlocked(state) ? validSeals(state.pendingSeals) : [];
  const floor = generateFloor(seed, 1, difficulty, false, undefined, sealFloorMods(seals));
  const up = floor.stairs.find((s) => !s.down)!;
  const spawn = stairsFront(up);
  const d = derivePlayer(state.equipment, state.meta, difficulty);
  const backpack = createContainer(backpackCapacity(state.meta));
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
    difficulty,
    floors: [floor],
    player: { x: spawn.x, y: spawn.y, facing: spawn.facing, hp: d.maxHp, stamina: d.maxStamina },
    backpack,
    gold: 0,
    keys: [],
    blessing: null,
    curse: null,
    tonics: [],
    portal: null,
    thrown: { held: {}, retrieveCd: 0 },
    sigil: state.attuned ? { id: state.attuned, cd: 0 } : null,
    flask: { charges: Math.max(1, 3 + Math.min(3, state.flask?.shards ?? 0) - (seals.includes('dry_well') ? DRY_WELL_CHARGES : 0)), dregs: 0 },
    stats: { kills: 0, goldFound: 0, itemsFound: 0, deepest: 1, time: 0, bossKilled: false },
    outcome: 'active',
  };
  if (seals.length) run.seals = seals;
  beginOath(state, run);
  if (placeShade(state, floor, seed, difficulty)) run.shadePlaced = true;
  run.roads = roadsForDay(state.saveId ?? '', state.market.day, state.market.events);
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
  // Each Ashen Seal on the delve adds a quarter again to the renown it pays.
  const sealCount = validSeals(run.seals).length;
  const renown = Math.round(renownForRun(run.stats.deepest, outcome === 'extracted', run.stats.bossKilled) * (1 + SEAL_RENOWN * sealCount));
  const sealRecord = run.stats.bossKilled && sealCount > (state.lifetime.bestSeals ?? 0);
  if (sealRecord) state.lifetime.bestSeals = sealCount;
  state.renown += renown;
  const oath = settleOath(state, run, outcome);
  // The corpse run: what was lost waits on the depth you fell, with your Shade.
  // A Hardcore death ends the save, so there is nothing to come back for.
  const oneLife = difficultyOf(run.difficulty ?? state.difficulty).oneLife;
  let graveDepth: number | undefined;
  if (outcome === 'dead' && !oneLife) {
    const weapon = state.equipment.weapon;
    digGrave(state, run.depth, lost, run.gold - gold, (weapon && itemBase(weapon.ref).damageType) || 'blunt');
    graveDepth = state.grave?.depth;
  }
  const dayTurned = run.stats.deepest > 1;

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
    dayTurned,
    ...(oath ? { oath } : {}),
    ...(graveDepth ? { graveDepth } : {}),
    ...(sealCount ? { seals: { count: sealCount, record: sealRecord } } : {}),
  };
  // One life: the grave is dug before anything else is saved, so there is no
  // moment where the save holds a dead Hardcore hero who is still playable.
  if (outcome === 'dead' && difficultyOf(run.difficulty ?? state.difficulty).oneLife) {
    summary.fallen = true;
    state.fallen = { day: state.market.day, depth: run.stats.deepest, killedBy: run.killedBy, delve: state.lifetime.runs };
  }
  state.lastRun = summary;
  state.run = null;

  // A new day dawns in town — but only if the delve was one. Stepping into the
  // entrance and straight back out changes nothing: it pays no renown, and it
  // does not turn the day either, or it would be a free button for rerolling
  // market prices, expiring contracts you no longer want and restocking the
  // merchant, at no cost but the walk back to the stairs.
  if (dayTurned) {
    const dayRng = createRng(randomSeed());
    advanceDay(state.market, dayRng, state.lifetime.bestDepth, state.recipeRanks);
    state.contracts = refreshContracts(state.contracts, dayRng, Math.max(1, state.lifetime.bestDepth));
  }
  return summary;
}
