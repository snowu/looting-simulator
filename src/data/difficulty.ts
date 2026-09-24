/**
 * Difficulty levels.
 *
 * One file owns every knob that differs between Normal and Hard, so tuning the
 * easier game never means hunting constants across combat, dungeon generation
 * and loot — and so reviewing a balance change means reading this file, not a
 * diff scattered over five systems.
 *
 * Hardcore is Hard in every number, plus one life: it adds no knob of its
 * own, so anything tuned for Hard is tuned for Hardcore too.
 *
 * Hard uses neutral combat/economy multipliers. Normal softens combat and
 * improves loot. Special-container rarity has an explicit Hard progression
 * ramp; Normal retains its guaranteed rarity floors.
 *
 * Threading rule: difficulty is read from the *run* (`RunState.difficulty`,
 * snapshotted when the delve starts), never from live town state, so switching
 * mid-delve cannot soften a boss fight. Every function that takes a difficulty
 * accepts it as an optional trailing `DifficultyId` defaulting to `'hard'`,
 * which keeps old saves, tests and headless harnesses on Hard.
 */

export type DifficultyId = 'normal' | 'hard' | 'hardcore';

export interface DifficultyDef {
  id: DifficultyId;
  /** Short label for buttons and slot cards. */
  name: string;
  /** One line under the label, saying what it is. */
  tagline: string;
  /** What changes, in plain words, for the town tooltip. */
  description: string;
  /** Multiplier on monster health at spawn (`createEnemy`). */
  enemyHp: number;
  /** Multiplier on monster attack before your armour (`enemyStrike`, bolts, traps use `trapDamage`). */
  enemyDamage: number;
  /** Multiplier on the depth armour scaling your blows meet (`defensePower`). Below 1 means thinner hides. */
  enemyDefense: number;
  /** Multiplier on trap damage that reaches the player. */
  trapDamage: number;
  /** Multiplier on how many traps a floor scatters. */
  trapCount: number;
  /** Multiplier on how many monsters a floor wants. */
  enemyCount: number;
  /** Multiplier on the player's maximum health (`derivePlayer`). */
  playerHp: number;
  /** Multiplier on every source of healing (`World.heal`: flask, morsels, shrines, leech). */
  playerHealing: number;
  /** Multiplier on stamina regeneration. */
  staminaRegen: number;
  /** Multiplier on post-parry immunity and ranged follow-up windows. */
  parryGrace: number;
  /** Multiplier on gold from kills and containers. */
  gold: number;
  /** Flat loot-find bonus, stacking with gear and Treasure Sense. */
  findBonus: number;
  /** Multiplier on gear drop chances (kill `itemChance`, chest gear odds). */
  dropChance: number;
  /**
   * Multiplier on how long monsters take over everything they do: wind-up,
   * recovery, the gap before the next swing, a combo's beat and a step. Above
   * 1 is slower. Scales the clock the monster reads, not its numbers, so every
   * tell stays the same shape and simply lasts longer.
   */
  enemyTempo: number;
  /** Multiplier on the parry window (`PARRY_WINDOW`), the reaction-time half of a parry. */
  parryWindow: number;
  /** No feints, and a combo stops after its first follow-up. The moves keep their tells. */
  gentleMoves: boolean;
  /**
   * How many monsters may be winding up at you at once. Anyone else in reach
   * waits its turn. `Infinity` is no cap.
   */
  maxAttackers: number;
  /** Added to the share of a blow a raised guard absorbs, before the shield cap. */
  blockBonus: number;
  /** Multiplier on the stamina a block costs. */
  blockStamina: number;
  /** Multiplier on durability lost per wear event (swings, blocks, hits taken). */
  gearWear: number;
  /** Multiplier on the smith's repair price. */
  repairCost: number;
  /** Multiplier on the chance an ordinary spawn is promoted to an elite (Seals add on top). */
  eliteChance: number;
  /** Multiplier on the chance a floor gets a lieutenant. */
  lieutenantChance: number;
  /** Extra flask charges every delve. */
  flaskBonus: number;
  /** Multiplier on a mimic's held bite, the one blow no guard refuses. */
  mimicBite: number;
  /**
   * Health you slowly mend back to, as a share of the maximum, while nothing
   * is hunting you. 0 is no regeneration at all, which is Hard.
   */
  restHeal: number;
  /**
   * What a death costs when it does not cost the pack. `null` is the full
   * price: the pack and the coin go to your Shade. Otherwise you keep the
   * pack and lose only `goldLost` of the coin you carried, and that is what
   * the Shade holds.
   */
  softDeath: { goldLost: number } | null;
  /**
   * One life: a death ends the playthrough, not just the delve. The save is
   * marked fallen and can never be played again. Picked only when the save
   * is made, and never switched on or off afterwards.
   */
  oneLife: boolean;
}

const HARD: DifficultyDef = {
  id: 'hard',
  name: 'Hard',
  tagline: 'The game as it was.',
  description: 'Full monster strength, full trap teeth, lean drops. For those who like the current flow.',
  enemyHp: 1,
  enemyDamage: 1,
  enemyDefense: 1,
  trapDamage: 1,
  trapCount: 1,
  enemyCount: 1,
  playerHp: 1,
  playerHealing: 1,
  staminaRegen: 1,
  parryGrace: 1,
  gold: 1,
  findBonus: 0,
  dropChance: 1,
  enemyTempo: 1,
  parryWindow: 1,
  gentleMoves: false,
  maxAttackers: Infinity,
  blockBonus: 0,
  blockStamina: 1,
  gearWear: 1,
  repairCost: 1,
  eliteChance: 1,
  lieutenantChance: 1,
  flaskBonus: 0,
  mimicBite: 1,
  restHeal: 0,
  softDeath: null,
  oneLife: false,
};

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  hard: HARD,
  // Normal is for someone who wants the dungeon, the loot and the town, not
  // the reflex test. It softens numbers *and* time: slower tells, a wider
  // parry, one attacker at a time or two, a guard that holds, and a death that
  // costs a little coin instead of the pack.
  normal: {
    id: 'normal',
    name: 'Normal',
    tagline: 'A gentler delve.',
    description: 'Monsters are slower, softer and fewer: they hit a third less, fall faster, wind up longer, never feint, and no more than two swing at you at once. Your guard holds better, the parry is wider, you have more health, an extra flask charge, and you slowly mend while nothing hunts you. Gear wears half as fast and repairs cost less. Dying keeps your pack and costs a tenth of the gold you carried, which your Shade holds for you.',
    enemyHp: 0.75,
    enemyDamage: 0.65,
    enemyDefense: 0.8,
    trapDamage: 0.5,
    trapCount: 0.6,
    enemyCount: 0.8,
    playerHp: 1.3,
    playerHealing: 1.35,
    staminaRegen: 1.25,
    parryGrace: 5 / 3,
    gold: 1.2,
    findBonus: 25,
    dropChance: 1.25,
    enemyTempo: 1.3,
    parryWindow: 1.6,
    gentleMoves: true,
    maxAttackers: 2,
    blockBonus: 0.15,
    blockStamina: 0.7,
    gearWear: 0.5,
    repairCost: 0.6,
    eliteChance: 0.5,
    lieutenantChance: 0.6,
    flaskBonus: 1,
    mimicBite: 0.5,
    restHeal: 0.5,
    softDeath: { goldLost: 0.1 },
    oneLife: false,
  },
  // Hardcore is Hard, knob for knob — spread from it so the two can never
  // drift apart — plus one life.
  hardcore: {
    ...HARD,
    id: 'hardcore',
    name: 'Hardcore',
    tagline: 'Hard, with one life.',
    description: 'Exactly Hard — same monsters, traps and drops — but one life. Die once and the hero is dead for good: the save becomes a headstone. Chosen when a save begins; it can never be changed.',
    oneLife: true,
  },
};

export const DIFFICULTY_IDS: DifficultyId[] = ['normal', 'hard', 'hardcore'];

/** Resolve anything save-shaped into a definition. Unknown (or absent) means Hard: the old game. */
export function difficultyOf(id: string | null | undefined): DifficultyDef {
  return isDifficultyId(id) ? DIFFICULTIES[id] : DIFFICULTIES.hard;
}

/** Whether this id names a real difficulty (for validating migrated saves). */
export function isDifficultyId(id: unknown): id is DifficultyId {
  return id === 'normal' || id === 'hard' || id === 'hardcore';
}
