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
  oneLife: false,
};

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  hard: HARD,
  normal: {
    id: 'normal',
    name: 'Normal',
    tagline: 'A gentler delve.',
    description: 'Monsters hit softer (−20%) and fall faster (−20% health, thinner armour), traps sting less, parry grace lasts longer, you mend faster (+25% healing, +20% health), and drops are slightly kinder (+25 find, +25% gear odds, +20% gold).',
    enemyHp: 0.8,
    enemyDamage: 0.8,
    enemyDefense: 0.85,
    trapDamage: 0.7,
    trapCount: 0.7,
    enemyCount: 0.85,
    playerHp: 1.2,
    playerHealing: 1.25,
    staminaRegen: 1.15,
    parryGrace: 5 / 3,
    gold: 1.2,
    findBonus: 25,
    dropChance: 1.25,
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
