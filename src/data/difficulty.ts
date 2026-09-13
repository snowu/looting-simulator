/**
 * Difficulty levels.
 *
 * One file owns every knob that differs between Normal and Hard, so tuning the
 * easier game never means hunting constants across combat, dungeon generation
 * and loot — and so reviewing a balance change means reading this file, not a
 * diff scattered over five systems.
 *
 * The contract that matters: **Hard is the game as it was.** Every multiplier
 * on the Hard entry is exactly 1 and every bonus exactly 0, and every call
 * site applies difficulty as `value * mult` (or `value + bonus`), so Hard
 * computes byte-for-byte the numbers the old constants produced. Normal is the
 * only entry allowed to move, and it is deliberately a first pass to iterate
 * on: enemies hit softer and fall faster, traps sting less, the player mends
 * faster, and drops are slightly kinder. Nothing else — pacing, mechanics,
 * prices, progression — differs.
 *
 * Threading rule: difficulty is read from the *run* (`RunState.difficulty`,
 * snapshotted when the delve starts), never from live town state, so switching
 * mid-delve cannot soften a boss fight. Every function that takes a difficulty
 * accepts it as an optional trailing `DifficultyId` defaulting to `'hard'`,
 * which keeps old saves, tests and headless harnesses on the exact old path.
 */

export type DifficultyId = 'normal' | 'hard';

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
  /** Multiplier on every source of healing (`World.heal`: potions, shrines, leech). */
  playerHealing: number;
  /** Multiplier on stamina regeneration. */
  staminaRegen: number;
  /** Multiplier on gold from kills and containers. */
  gold: number;
  /** Flat loot-find bonus, stacking with gear and Treasure Sense. */
  findBonus: number;
  /** Multiplier on gear drop chances (kill `itemChance`, chest gear odds). */
  dropChance: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  hard: {
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
    gold: 1,
    findBonus: 0,
    dropChance: 1,
  },
  normal: {
    id: 'normal',
    name: 'Normal',
    tagline: 'A gentler delve.',
    description: 'Monsters hit softer (−20%) and fall faster (−20% health, thinner armour), traps sting less, you mend faster (+25% healing, +20% health), and drops are slightly kinder (+25 find, +25% gear odds, +20% gold). Same dungeon, same rules.',
    enemyHp: 0.8,
    enemyDamage: 0.8,
    enemyDefense: 0.85,
    trapDamage: 0.7,
    trapCount: 0.7,
    enemyCount: 0.85,
    playerHp: 1.2,
    playerHealing: 1.25,
    staminaRegen: 1.15,
    gold: 1.2,
    findBonus: 25,
    dropChance: 1.25,
  },
};

export const DIFFICULTY_IDS: DifficultyId[] = ['normal', 'hard'];

/** Resolve anything save-shaped into a definition. Unknown (or absent) means Hard: the old game. */
export function difficultyOf(id: string | null | undefined): DifficultyDef {
  return id === 'normal' ? DIFFICULTIES.normal : DIFFICULTIES.hard;
}

/** Whether this id names a real difficulty (for validating migrated saves). */
export function isDifficultyId(id: unknown): id is DifficultyId {
  return id === 'normal' || id === 'hard';
}
