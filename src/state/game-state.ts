import { Rng } from '../core/rng';
import { Dir } from '../core/dir';
import { Item, Rarity, RecipeRanks } from '../types';
import { DifficultyId } from '../data/difficulty';
import { Container, addItem, createContainer } from './inventory';
import { Equipment, emptyEquipment } from '../systems/player';
import { MarketState, createMarket } from '../systems/market';
import { Contract, refreshContracts } from '../systems/contracts';
import { MetaLevels } from '../systems/meta';
import { BestiaryState } from '../systems/bestiary';
import { Floor } from '../systems/dungeon';
import { makeConsumable, makeEquipment, makeMaterial } from '../systems/items';
import { starterRecipeRanks } from '../data/recipes';
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
  /**
   * The difficulty this delve is played at, snapshotted from the town setting
   * when the run starts. The town selector locks while a run is open, and the
   * world reads this — never the live town value — so the difficulty cannot be
   * softened mid-fight. Absent on older saves, which were all Hard.
   */
  difficulty?: DifficultyId;
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
  /**
   * An open strife-shrine trial: enemy ids that must die for the prize.
   * Absent until the first challenge, so old saves and fixtures never see it.
   */
  trial?: { propId: string; ids: string[] } | null;
  /**
   * Legendary draughts drunk this delve, which last until it ends. Kept apart
   * from `blessing` on purpose: a tonic you found should never cost you the
   * shrine blessing you prayed for.
   */
  tonics: string[];
  /** Open town portal, if a Scroll of Recall has been read. One at a time. */
  portal: PortalState | null;
  /** Finite thrown stock in hand; landed stock lives on its persisted Floor. */
  thrown: { held: Record<string, number>; retrieveCd: number };
  /** Attuned sigil and remaining cooldown, snapshotted for this delve. */
  sigil: { id: string; cd: number } | null;
  /**
   * Player-chosen order of the delve quick bar (consumable refs, first = slot 1).
   * New consumable types append at the end; missing ones are ignored on read.
   * Absent on older saves, which used backpack order.
   */
  quickOrder?: string[];
  flask: { charges: number; dregs: number };
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
  /** A one-life death: this was the hero's last delve, not just a lost one. */
  fallen?: boolean;
}

/**
 * The headstone of a one-life hero. Once set the playthrough is over: it can
 * be looked at and deleted, never played again. Absent (the usual case) means
 * the hero is alive.
 */
export interface FallenRecord {
  day: number;
  depth: number;
  killedBy?: string;
  /** Which delve killed them, counting from 1. */
  delve: number;
}

export interface Lifetime {
  runs: number;
  deaths: number;
  extractions: number;
  bestDepth: number;
  goldEarned: number;
  kills: number;
  /** Hardest single blow you have landed, and the hardest you have taken. */
  bestHit?: number;
  worstHit?: number;
  /**
   * Every bespoke legendary this playthrough has turned up, in the order it
   * found them. The dungeon favours the ones missing from this list, and the
   * Ashen King will not repeat himself while it is short of the full set.
   */
  uniquesSeen?: string[];
  /**
   * Of those, the ones that have been identified — which is what opens a codex
   * entry. Separate from `uniquesSeen` so carrying an unappraised relic never
   * tells you for free what the appraiser is for.
   */
  uniquesKnown?: string[];
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
  /**
   * The player-given name for this playthrough, shown on the title screen.
   * Empty means unnamed, and the slot shows "Slot N" instead. It travels with
   * the save like any other field, but it is cosmetic: it never decides which
   * of two saves is newer.
   */
  name: string;
  /**
   * Town-side difficulty setting, picked between delves. New playthroughs
   * start on Hard — the game as it was — and Normal is offered as the gentler
   * alternative. Older saves migrate to Hard, so nothing about an existing
   * game changes under it.
   */
  difficulty: DifficultyId;
  /** Set when a one-life (Hardcore) hero dies. See `FallenRecord`. */
  fallen?: FallenRecord | null;
  gold: number;
  renown: number;
  stash: Container;
  equipment: Equipment;
  recipeRanks: RecipeRanks;
  recipeSalvage: Record<string, number>;
  /** Creatures met and the field notes read on them. */
  bestiary: BestiaryState;
  market: MarketState;
  contracts: Contract[];
  meta: MetaLevels;
  flask: { shards: number; potency: number; infusion: string | null };
  /** Permanently inscribed sigils and the one selected for the next delve. */
  spells: string[];
  attuned: string | null;
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
  addItem(stash, makeMaterial('copper', 3));
  addItem(stash, makeMaterial('timber', 2));
  addItem(stash, makeMaterial('rat_hide', 3));
  addItem(stash, makeMaterial('linen', 2));

  const recipeRanks = starterRecipeRanks();
  return {
    version: SAVE_VERSION,
    revision: SAVE_REVISION,
    saveId: newId(),
    name: '',
    difficulty: 'hard',
    gold: 120,
    renown: 0,
    stash,
    equipment,
    recipeRanks,
    recipeSalvage: {},
    bestiary: {},
    market: createMarket(rng, recipeRanks),
    contracts: refreshContracts([], rng, 1),
    meta: {},
    flask: { shards: 0, potency: 0, infusion: null },
    spells: [],
    attuned: null,
    loadout: createContainer(BASE_BACKPACK),
    run: null,
    lifetime: { runs: 0, deaths: 0, extractions: 0, bestDepth: 0, goldEarned: 0, kills: 0, uniquesSeen: [], uniquesKnown: [] },
    lastRun: null,
  };
}
