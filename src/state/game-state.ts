import { Rng } from '../core/rng';
import { Dir } from '../core/dir';
import { Item, Rarity } from '../types';
import { Container, addItem, createContainer } from './inventory';
import { Equipment, emptyEquipment } from '../systems/player';
import { MarketState, createMarket } from '../systems/market';
import { Contract, refreshContracts } from '../systems/contracts';
import { MetaLevels } from '../systems/meta';
import { Floor } from '../systems/dungeon';
import { makeConsumable, makeEquipment, makeMaterial } from '../systems/items';
import { STARTER_RECIPES } from '../data/recipes';
import { SAVE_REVISION } from './migrations';
import { newId } from '../core/id';
import { BASE_BACKPACK } from '../systems/meta';

export const SAVE_VERSION = 2;

export interface PlayerRunState {
  x: number;
  y: number;
  facing: Dir;
  hp: number;
  stamina: number;
}

export interface RunStats {
  kills: number;
  goldFound: number;
  itemsFound: number;
  deepest: number;
  time: number;
  bossKilled: boolean;
}

export type RunOutcome = 'active' | 'dead' | 'extracted';

/** An open town portal: where in the dungeon it drops you back. */
export interface PortalState {
  depth: number;
  x: number;
  y: number;
}

export interface RunState {
  seed: number;
  rngState: number;
  depth: number;
  /** Floors persist for the whole run; index = depth - 1. */
  floors: (Floor | null)[];
  player: PlayerRunState;
  backpack: Container;
  gold: number;
  keys: string[];
  /** Shrine blessing active for the rest of the run. */
  blessing: string | null;
  /** Shrine curse active for the rest of the run; a font will lift it. */
  curse: string | null;
  /** Open town portal, if a Scroll of Recall has been read. One at a time. */
  portal: PortalState | null;
  stats: RunStats;
  outcome: RunOutcome;
  killedBy?: string;
}

export interface RunSummary {
  outcome: 'dead' | 'extracted';
  day: number;
  depth: number;
  gold: number;
  items: Item[];
  lost: Item[];
  renown: number;
  kills: number;
  bossKilled: boolean;
  killedBy?: string;
  /** Whether the delve counted: a new day in town, or nothing at all. */
  dayTurned: boolean;
}

export interface Lifetime {
  runs: number;
  deaths: number;
  extractions: number;
  bestDepth: number;
  goldEarned: number;
  kills: number;
}

export interface GameState {
  version: number;
  /** Additive schema revision within `version` — see state/migrations.ts. */
  revision?: number;
  /**
   * Identifies this playthrough wherever it is stored. Sync matches on it
   * rather than on slot position, so the same game is recognised across
   * devices even when it sits in a different slot on each.
   */
  saveId?: string;
  gold: number;
  renown: number;
  stash: Container;
  equipment: Equipment;
  knownRecipes: string[];
  market: MarketState;
  contracts: Contract[];
  meta: MetaLevels;
  /** Packed in town for the next delve; becomes the backpack when you descend. */
  loadout: Container;
  run: RunState | null;
  lifetime: Lifetime;
  lastRun: RunSummary | null;
}

export function newGame(rng: Rng): GameState {
  const equipment = emptyEquipment();
  equipment.weapon = makeEquipment({ baseId: 'short_sword', materialId: 'copper', rarity: Rarity.Common, ilvl: 1, quality: 0.95 });
  equipment.body = makeEquipment({ baseId: 'jerkin', materialId: 'rat_hide', rarity: Rarity.Common, ilvl: 1, quality: 0.95 });
  equipment.offhand = makeEquipment({ baseId: 'buckler', materialId: 'timber', rarity: Rarity.Common, ilvl: 1, quality: 0.95 });

  const stash = createContainer(0);
  addItem(stash, makeConsumable('healing_draught', 2));
  addItem(stash, makeMaterial('copper', 3));
  addItem(stash, makeMaterial('timber', 2));
  addItem(stash, makeMaterial('rat_hide', 3));
  addItem(stash, makeMaterial('linen', 2));

  return {
    version: SAVE_VERSION,
    revision: SAVE_REVISION,
    saveId: newId(),
    gold: 120,
    renown: 0,
    stash,
    equipment,
    knownRecipes: [...STARTER_RECIPES],
    market: createMarket(rng),
    contracts: refreshContracts([], rng, 1),
    meta: {},
    loadout: createContainer(BASE_BACKPACK),
    run: null,
    lifetime: { runs: 0, deaths: 0, extractions: 0, bestDepth: 0, goldEarned: 0, kills: 0 },
    lastRun: null,
  };
}
