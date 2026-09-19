import { Rng, createRng, hashString } from '../core/rng';
import { Dir, DIR_NAMES, DIRS, DX, DY, dirOf, turnAround, turnLeft, turnRight } from '../core/dir';
import { DamageType, EnemyDef, EquipSlot, EQUIP_SLOTS, Item, SwingProfile } from '../types';
import { GameState, RunState } from '../state/game-state';
import { addItem, canFit, findItem, removeItem, roomFor, takeQty } from '../state/inventory';
import {
  THIEF_CREEP, THIEF_ESCAPE, THIEF_FUMBLE, THIEF_FUMBLE_CHANCE, THIEF_TRAIL_EVERY, THIEF_TRAIL_MAX,
  VENGEFUL_DAMAGE_MULT, VENGEFUL_FUSE,
} from '../data/elites';
import { CACHE_MIN_GOLD, CRACK_BLOWS, CRACK_NOISE, CRACK_WEAR, Crack, SEAM_ORE } from '../data/walls';
import {
  AMBUSH_BEAT, AMBUSH_TRIGGER, BURROW_MAX, BURROW_MIN, DIVE_AT, DROP_SECONDS, KNOCKOUT_STUN, MOUND_STEP, SURFACE_SECONDS,
} from '../data/ambush';
import {
  EnemyState,
  Floor,
  FLOOR,
  Pickup,
  Prop,
  Room,
  ShrineKind,
  attackPower,
  blocksMove,
  blocksSight,
  createEnemy,
  defensePower,
  doorAt,
  enemyAt,
  lurkerAt,
  crackAt,
  generateFloor,
  inBounds,
  isBossDoor,
  propAt,
  secretAt,
  shrinePityFor,
  stairsAt,
  stairsFront,
  Trap,
  TrapKind,
  trapAt,
} from '../systems/dungeon';
import { BOSS_ID, ENEMIES, enemyDef, enemyView, kingPhase, phaseForHp } from '../data/enemies';
import { consumable, itemBase, viewmodelFor } from '../data/items';
import { biomeForFloor, FINAL_DEPTH } from '../data/biomes';
import { PlayerDerived, derivePlayer, thrownView } from '../systems/player';
import { DifficultyId, DifficultyDef, difficultyOf } from '../data/difficulty';
import { enemyHitsPlayer, playerHitsEnemy, staminaPower } from '../systems/combat';
import { ContainerTier, durability, identify, isIdentified, itemName, makeMaterial, materialForDepth, rollContainerLoot, rollEnemyLoot, uniqueOf, wearItem } from '../systems/items';
import { nameRelic } from '../systems/relics';
import { recordDepth, recordKill } from '../systems/contracts';
import {
  loreName,
  recordDamageDealt,
  recordDamageTaken,
  recordDeath as recordBestiaryDeath,
  recordKill as recordBestiaryKill,
  unlockEntry,
} from '../systems/bestiary';
import { lightRadius, metaLevel } from '../systems/meta';
import { Rarity } from '../types';
import type { SfxName } from '../audio/sfx';
import { SigilId, findSigil, sigil } from '../data/spells';
import { makeSigil, unknownSigils } from '../systems/spells';
import { CHEW_SECONDS, DREGS_FRACTION, FLASK_POTENCY, MORSEL_HEAL, MORSEL_ROT_SECONDS, SIP_BUFFER_SECONDS, SIP_SECONDS, flaskMax, morselChance } from '../systems/healing';
import { findMaterial } from '../data/materials';
import { Draught, KINDLE_SECONDS, MARROW_SECONDS, WARD_SECONDS, draught } from '../systems/infusion';
import { addStats, Stats } from '../types';

// ---------------------------------------------------------------------------
// Events the world emits for the renderer / UI / audio to react to.
// ---------------------------------------------------------------------------

export type WorldEvent =
  | { type: 'msg'; text: string; color?: string }
  | { type: 'sfx'; name: SfxName; x?: number; y?: number }
  | { type: 'hurt'; amount: number; blocked: boolean }
  | { type: 'float'; x: number; y: number; text: string; color: string }
  | { type: 'shake'; amount: number }
  | { type: 'sigil'; r: number; g: number; b: number; strength: number }
  | { type: 'loot'; pickupId: string }
  | { type: 'floor' }
  | { type: 'end'; outcome: 'dead' | 'extracted' }
  | { type: 'secret'; x: number; y: number }
  | { type: 'crack'; id: string; hits: number }
  | { type: 'trap'; id: string; x: number; y: number; kind: Trap['kind'] }
  | { type: 'town' };

export interface Projectile {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  damage: number;
  type: DamageType;
  sprite: string;
  light?: string;
  tileX: number;
  tileY: number;
  source: string;
  /** Enemy id behind the shot, so a death can be filed in the codex. */
  sourceId?: string;
  /** Parried back at them: now it hits monsters instead of passing through. */
  reflected?: boolean;
  /**
   * Flying back to you, not at anything. Hits nothing, is stopped by nothing,
   * and is collected the moment it reaches your tile.
   */
  returning?: boolean;
  /** Recoverable player throw. Its combat snapshot prevents gear swaps changing a shot in flight. */
  thrownBase?: string;
  thrownRange?: number;
  traveled?: number;
  player?: PlayerDerived;
  weaponUid?: string;
}

type Move = 'forward' | 'back' | 'left' | 'right';
type Action = Move | 'turnLeft' | 'turnRight';

export interface PlayerAnim {
  fromX: number;
  fromY: number;
  moveT: number;
  moveDur: number;
  yaw: number;
  yawFrom: number;
  yawTo: number;
  turnT: number;
  attack: 'idle' | 'windup' | 'recover';
  attackT: number;
  attackDur: number;
  attackPower: number;
  attackThrow: boolean;
  /**
   * A retrieval in progress: the base being called back, how many shafts are
   * still out across the run (re-anchored whenever shafts are picked up on
   * foot, so it never counts what is already back in hand), and the seconds
   * until the next one leaves the floor. Zero left holds the receiving pose
   * until the final return arrives or the player cancels. Null when idle. Shafts already
   * flying home are not counted here — they land on their own even if the
   * call stops — but `thrownCounts` reports them alongside this.
   */
  retrieving: { base: string; left: number; t: number } | null;
  attackRecovery: number;
  attackBase: string | null;
  attackWeaponUid: string | null;
  attackSnapshot: PlayerDerived | null;
  blockRaise: number;
  /** Seconds the guard has been up, or Infinity while it is down. */
  blockT: number;
  /** Whether this particular raise got a parry window (it was off cooldown). */
  parryArmed: boolean;
  /** Time until another parry window can open, so mashing block isn't a parry. */
  parryCd: number;
  /** Brief window in which one more incoming projectile can be parried. */
  rangedParryT: number;
  /** Brief immunity after a melee parry, covering near-simultaneous attacks. */
  parryInvulnT: number;
  /** Seconds of shield-bash stun: no moving, swinging or guarding. */
  stunT: number;
  steps: number;
  /** Parries banked by a blade that feeds on them. Never saved: a fight's state. */
  parryStacks: number;
  sinceStamina: number;
  /** Throttles the winded cue so a held attack button can't spam it. */
  windedCd: number;
  recall: number | null;
  cast: { id: SigilId; t: number } | null;
  snuffT: number;
  unseenT: number;
  ward: { x: number; y: number; t: number } | null;
  transition: { t: number; dir: 'down' | 'up'; done: boolean } | null;
  sip: number | null;
  chew: { id: string; left: number; delivered: number; total: number } | null;
  /** The infused flask's on-sip effect, waiting to be spent. One at a time. */
  draught: { kind: 'iron' | 'marrow' | 'kindled'; t: number; total: number } | null;
}

const STEP_TIME = 0.24;
const TURN_TIME = 0.17;
/** Pause between repeated turns while a turn is held, so you can stop where you want. */
const TURN_REPEAT = 0.16;
/**
 * Stamina. Deliberately slower than it was, and slower to start coming back.
 *
 * At 34/s with half a second of grace, the bar refilled faster than a fight
 * could empty it, so nothing in the game was ever limited by breath — you
 * swung until the thing in front of you fell over. A fight now costs more than
 * it earns back, which is what makes backing off a move rather than a mistake.
 */
export const STAMINA_REGEN = 22;
const STAMINA_DELAY = 0.9;

/**
 * Parry. Raising the guard opens a short window; a hit that lands inside it is
 * denied outright rather than absorbed. The cooldown is what stops mashing the
 * block key from being a permanent parry — at best you get one attempt per
 * PARRY_COOLDOWN, so it has to be timed against the wind-up you can see.
 */
const PARRY_WINDOW = 0.22;
const PARRY_COOLDOWN = 0.75;
/**
 * Opening a mimic, Dark Souls style: it snaps shut on you, chews for
 * MIMIC_GRAB seconds and bites once for MIMIC_BITE times its normal blow,
 * which no guard or parry can refuse; only armour softens it. Then it spits you out
 * and you lie there another MIMIC_SPAT seconds before the fight is yours.
 * The chest is not a surprise you can react to; it is one you can test for,
 * by hitting it first.
 */
const MIMIC_GRAB = 1.1;
const MIMIC_BITE = 2.5;
const MIMIC_SPAT = 0.45;
/** How long a mimic takes to rise after being struck awake. */
const MIMIC_RISE = 0.9;
/**
 * Striking a chest is a test, and it is never free. Every blow on an honest
 * chest breaks one thing inside (see chestLoot for the order), and a blunt or
 * two-handed weapon has CHEST_SHATTER_HEAVY_EXTRA odds of breaking a second.
 * The clang carries too, waking anything within CHEST_CLANG_RADIUS tiles. A
 * player who reads the lid tell and just opens it keeps everything and stays
 * quiet.
 */
const CHEST_SHATTER_HEAVY_EXTRA = 0.55;
/** Share of a gear piece's max durability one blow knocks off, once nothing smaller is left to break. */
const CHEST_DENT = 0.4;
/** Share of the remaining coin one blow spills, once there is nothing else. */
const CHEST_SPILL = 0.25;
const CHEST_CLANG_RADIUS = 7;
/** Base grace after a parry; Normal extends it through difficulty tuning. */
const PARRY_GRACE = 0.75;
/** Crowd control after turning aside a melee blow. */
const MELEE_PARRY_SPLASH_STUN = 0.25;
/** How long a parried melee attacker is left open, and how much harder it takes hits. */
const PARRY_STUN = 1;

const PARRY_VULN_MULT = 2;

/**
 * How long a turned blow counts toward a shield-bash: keep swinging into the
 * wall for this long and the second consecutive block bashes you. Back off,
 * circle behind, or let the bearer start a swing, and the count goes stale.
 */
const BLOCK_EXPIRY = 2.5;

/**
 * The guard rhythm. The shield sweeps center fast, holds long enough to chip
 * two swings, then drops long enough to punish. Hitting the raise is the
 * parry the bearer lands on *you*; chipping three in a row sags the arm and
 * opens them up. Everything is read off the sprite, never off a counter.
 */
const GUARD_RAISE = 0.25;
const GUARD_UP = 1.4;
const GUARD_DOWN = 1.6;
const GUARD_RANGE = 4;
const GUARD_BREAK_AT = 3;

/** Tiles per second a called shaft travels on its way back to your hand. */
const RETURN_SPEED = 11;
/**
 * Seconds between one shaft leaving the floor and the next.
 *
 * The whole stock used to snap into your hand the instant you pressed R, which
 * made running dry cost nothing worth planning around — six knives were six
 * frames away. One at a time, a full stock is several seconds of standing
 * there, so the decision to throw the last one is a real one and a fight can
 * end before your knives get home.
 *
 * The waiting is the whole cost now. It used to also charge stamina per shaft,
 * which made the one thing you do *after* a fight compete with the bar you need
 * *during* one, and paid for nothing: the tension is already the standing still.
 */
const RETRIEVE_PER_SHAFT = 0.75;
// Fog fully hides the dungeon at 18 world units (nine two-unit tiles).
const RETURN_VISIBLE_TILES = 9;
const RETURN_LOCAL_TILES = 2;

/**
 * Anything lighter than this is knocked out of its wind-up when you land a
 * blow, which is what makes trading with a rat different from trading with a
 * ghoul. It is a raw health number and so it has to move whenever the health
 * scale does: it was 40 against a roster topping out at 30 for a shieldguard,
 * and 55 keeps exactly the same creatures on the light side of the line now
 * that every stat block is larger.
 */
const STAGGER_HP = 55;

/**
 * How long the King reels when a phase breaks. Long enough to read the turn and
 * take a free swing at it, short enough that it is a moment rather than a
 * cutscene.
 */
const BOSS_PHASE_BEAT = 1.2;

/**
 * What share of its health a guard comes back up with, and how many rise. They
 * came back wrong: a third of what they were is enough to be a problem while
 * you are trying to fight something else, without becoming the fight.
 */
const RAISED_GUARD_HP = 0.3;
const MAX_RAISED_GUARDS = 2;
/** Compact button label for an interaction hint. */
/** What a blow on a chest breaks first: gems, valuables, and anything in a flask or on a page. */
function fragileLoot(it: Item): boolean {
  if (it.kind === 'consumable' || it.kind === 'blueprint') return true;
  if (it.kind !== 'material') return false;
  const cat = findMaterial(it.ref)?.category;
  return cat === 'gem' || cat === 'valuable';
}

/** "2× Jade, Silver Chalice, Iron Mace dented 2×, 14 gold": repeats counted, coin summed last. */
function summarizeLost(lost: string[]): string {
  const counts = new Map<string, number>();
  let gold = 0;
  for (const l of lost) {
    const g = /^(\d+) gold$/.exec(l);
    if (g) gold += Number(g[1]);
    else counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  const parts = [...counts].map(([l, n]) => l.startsWith('dent:')
    ? `${l.slice(5)} dented${n > 1 ? ` ${n}×` : ''}`
    : n > 1 ? `${n}× ${l}` : l);
  if (gold) parts.push(`${gold} gold`);
  return parts.join(', ');
}

export function shortLabel(hint: string): string {
  if (hint === 'Search') return 'Loot';
  if (hint.startsWith('Descend')) return 'Descend';
  if (hint.startsWith('Climb')) return 'Climb';
  if (hint.startsWith('Leave')) return 'Leave';
  if (hint.startsWith('Push')) return 'Push';
  if (hint.startsWith('Disarm')) return 'Disarm';
  if (hint.startsWith('Pray')) return 'Pray';
  if (hint.startsWith('Drink')) return 'Drink';
  if (hint.startsWith('Offer')) return 'Offer';
  if (hint === 'Step through to Bleakmere') return 'Town';
  if (hint.startsWith('Step through')) return 'Enter';
  if (hint.startsWith('Unlock')) return 'Unlock';
  if (hint.startsWith('Open')) return 'Open';
  if (hint === 'Part the fog') return 'Enter';
  if (hint === 'Sealed by fog') return 'Sealed';
  return hint;
}

/**
 * The hazard table. Damage is `base + perDepth × depth` before your armour,
 * so a dart is a toll and a spike pit is a real threat if you are already hurt.
 */
export const TRAPS: Record<
  TrapKind,
  {
    name: string;
    base: number;
    perDepth: number;
    damageType: DamageType;
    source: string;
    article: string;
    sfx: SfxName;
    spotted: string;
    hit: string;
    disarmed: string;
  }
> = {
  dart: {
    name: 'Dart trap',
    base: 5,
    perDepth: 3,
    damageType: 'pierce',
    source: 'a dart trap',
    article: 'a dart trap',
    sfx: 'shoot',
    spotted: 'A pinhole in the wall, and a plate underfoot.',
    hit: 'A dart snaps out of the wall!',
    disarmed: 'You jam the dart mechanism.',
  },
  spikes: {
    name: 'Spike pit',
    base: 9,
    perDepth: 5,
    damageType: 'pierce',
    source: 'a spike pit',
    article: 'a spike pit',
    sfx: 'break',
    spotted: 'The flagstones here sit loose over a gap.',
    hit: 'The floor gives way onto spikes!',
    disarmed: 'You wedge the spike plate shut.',
  },
  alarm: {
    name: 'Alarm ward',
    base: 0,
    perDepth: 0,
    damageType: 'shadow',
    source: 'an alarm ward',
    article: 'an alarm ward',
    sfx: 'alert',
    spotted: 'A ward is scratched into the stone here.',
    hit: 'A ward shrieks!',
    disarmed: 'You scuff the ward out.',
  },
};

export const BLESSINGS: Record<string, { name: string; text: string }> = {
  fortune: { name: 'Fortune', text: '+40 loot find this run, more the deeper you pray.' },
  fury: { name: 'Fury', text: '+30% damage this run.' },
  ward: { name: 'Warding', text: '+6 defense this run, more the deeper you pray.' },
  vitality: { name: 'Vitality', text: '+20% maximum health this run.' },
};

/**
 * The other half of the bargain. A curse lasts the run like a blessing does,
 * and the two are independent — you can carry both. A Font of Mending lifts
 * one, which is what makes finding a font worth something once you are cursed.
 */
export const CURSES: Record<string, { name: string; text: string }> = {
  frailty: { name: 'Frailty', text: '−20% maximum health this run.' },
  leaden: { name: 'Leaden Limbs', text: '−15 speed this run.' },
  dulled: { name: 'Dulled Edge', text: '−25% damage this run.' },
  hunted: { name: 'Hunted', text: 'Monsters see you three tiles further this run.' },
  brittle: { name: 'Brittle Bones', text: 'Your gear wears faster this run.' },
};

/**
 * Delve-long draughts. A tonic is the one Legendary you can drink: found in the
 * dark, never stocked, and it lasts until the run ends rather than until a
 * timer does. Applied in refreshDerived alongside blessings and curses, and
 * held in its own list so drinking one never costs you a shrine's favour.
 */
export const TONICS: Record<string, { name: string; text: string; apply: (d: PlayerDerived) => void }> = {
  fight_milk: {
    name: 'Fight Milk',
    text: 'Stamina recovery 22/s → 37.4/s, maximum stamina −20.',
    apply: (d) => {
      d.traits.staminaRegen *= 1.7;
      d.maxStamina = Math.max(30, d.maxStamina - 20);
    },
  },
};

/**
 * How many paid offerings one stone takes, how much thirstier it gets each
 * time, and how often it takes the coin and answers with silence.
 */
export const COFFER_MAX_OFFERINGS = 3;
export const COFFER_PRICE_GROWTH = 1.75;
export const COFFER_FIZZLE = 0.25;

/** What [F] says at each shrine, so you know what you are touching. */
export const SHRINE_PROMPT: Record<ShrineKind, (cost: number) => string> = {
  font: () => 'Drink at the font',
  idol: () => 'Pray at the hollow idol',
  coffer: (cost) => `Offer ${cost} gold at the stone`,
  blood: () => 'Bleed at the red altar',
  combat: () => 'Challenge the ember shrine',
};

export class World {
  readonly state: GameState;
  readonly run: RunState;
  rng: Rng;
  private flavorRng: Rng;
  derived!: PlayerDerived;
  projectiles: Projectile[] = [];
  events: WorldEvent[] = [];
  anim: PlayerAnim;
  held = new Set<Action | 'block'>();
  private queued: Action | null = null;
  private projN = 0;
  private pathCache = new Map<string, { t: number; next: [number, number] | null }>();
  private turnReadyAt = 0;
  private trail: { x: number; y: number; facing: Dir; time: number }[] = [];
  /** A flask sip pressed mid-step, waiting for the step to land. */
  private sipBuffered = 0;
  time = 0;

  constructor(state: GameState) {
    this.state = state;
    this.run = state.run!;
    this.rng = createRng(this.run.rngState);
    this.flavorRng = createRng(hashString(`flavor:${this.run.seed}:${this.run.rngState}`));
    this.refreshDerived();
    const yaw = this.run.player.facing * (Math.PI / 2);
    this.anim = {
      fromX: this.run.player.x, fromY: this.run.player.y, moveT: 1, moveDur: STEP_TIME,
      yaw, yawFrom: yaw, yawTo: yaw, turnT: 1,
      attack: 'idle', attackT: 0, attackDur: 0, attackPower: 1, attackThrow: false, retrieving: null, attackRecovery: 0,
      attackBase: null, attackWeaponUid: null, attackSnapshot: null,
      blockRaise: 0, blockT: Infinity, parryArmed: false, parryCd: 0,
      rangedParryT: 0, parryInvulnT: 0, stunT: 0, steps: 0, parryStacks: 0,
      sinceStamina: 10, windedCd: 0, recall: null, cast: null, snuffT: 0, unseenT: 0, ward: null, transition: null,
      sip: null, chew: null, draught: null,
    };
    this.trail.push({ x: this.player.x, y: this.player.y, facing: this.player.facing, time: this.run.stats.time });
    this.reveal();
  }

  get floor(): Floor {
    return this.run.floors[this.run.depth - 1]!;
  }

  get player() {
    return this.run.player;
  }

  /**
   * The difficulty this delve is playing at. Read from the run snapshot, never
   * from town state: the selector locks while a run is open, and even if it
   * did not, this getter would keep a boss fight from getting softer halfway
   * through. Older saves have no snapshot and were all Hard.
   */
  get diff(): DifficultyDef {
    return difficultyOf(this.run.difficulty ?? this.state.difficulty);
  }

  /** The raw id behind `diff`, for passing into loot and generation calls. */
  get difficultyId(): DifficultyId {
    return this.diff.id;
  }

  refreshDerived(): void {
    this.derived = derivePlayer(this.state.equipment, this.state.meta, this.difficultyId);
    // Blessings scale with the depth prayed at: a D6 blessing should feel
    // like a D6 blessing. Fortune +40 +5/depth past 2, Ward +6 +1 per 2 depths.
    const depth = this.run.depth;
    if (this.run.blessing === 'fury') this.derived.attack = Math.round(this.derived.attack * 1.3);
    if (this.run.blessing === 'fortune') this.derived.find += 40 + 5 * Math.max(0, depth - 2);
    if (this.run.blessing === 'ward') this.derived.stats.defense += 6 + Math.floor(depth / 2);
    if (this.run.blessing === 'vitality') this.derived.maxHp = Math.round(this.derived.maxHp * 1.2);
    if (this.run.curse === 'frailty') this.derived.maxHp = Math.max(1, Math.round(this.derived.maxHp * 0.8));
    if (this.run.curse === 'leaden') this.derived.stats.speed -= 15;
    if (this.run.curse === 'dulled') this.derived.attack = Math.max(1, Math.round(this.derived.attack * 0.75));
    // hunted is read in sightPenalty (+3); brittle is read in wear (+1).
    for (const id of this.run.tonics ?? []) TONICS[id]?.apply(this.derived);
    if (this.state.flask?.infusion === 'fight_milk') TONICS.fight_milk.apply(this.derived);
    // A kindled blade carries its gem's catalyst stat. Elemental stats deal
    // damage through the ELEMENTS loop in combat, so they must NOT also land
    // in attack — that dealt every gem twice.
    if (this.anim?.draught?.kind === 'kindled') {
      const kindle = draught(this.state.flask?.infusion)?.kindle;
      if (kindle) addStats(this.derived.stats, kindle);
    }
    this.player.hp = Math.min(this.player.hp, this.derived.maxHp);
    this.player.stamina = Math.min(this.player.stamina, this.derived.maxStamina);
    this.ensureThrownStock();
  }

  private ensureThrownStock(): void {
    const base = this.state.equipment.thrown?.ref;
    if (!base || !this.derived.thrown) return;
    this.run.thrown ??= { held: {}, retrieveCd: 0 };
    this.run.thrown.held ??= {};
    if (this.run.thrown.held[base] === undefined) this.run.thrown.held[base] = this.derived.thrownCapacity;
  }

  /**
   * Every drop of healing in the game goes through here, which is what lets one
   * suit of armour halve all of it at once. Returns what was actually restored.
   * Difficulty mends faster on Normal; Hard multiplies by exactly 1.
   */
  private heal(amount: number): number {
    const scaled = Math.round(amount * this.derived.traits.healing * this.diff.playerHealing);
    const healed = Math.min(Math.max(0, scaled), this.derived.maxHp - this.player.hp);
    this.player.hp += healed;
    const overflow = Math.max(0, scaled - healed);
    if (overflow > 0) {
      const flask = (this.run.flask ??= { charges: flaskMax(this.state.flask?.shards ?? 0), dregs: 0 });
      const max = flaskMax(this.state.flask?.shards ?? 0);
      const threshold = Math.max(1, this.derived.maxHp * DREGS_FRACTION);
      flask.dregs = Math.min(threshold, flask.dregs + overflow);
      if (flask.dregs >= threshold && flask.charges < max) {
        flask.dregs = 0;
        flask.charges++;
        this.msg('The flask draws a charge from its dregs.', '#a0d8c8');
      }
    }
    return healed;
  }

  /** Swings into empty air since the last scuff: every third one wears the edge. */
  private whiffs = 0;
  /** Blows landed on chests this session, so each one rolls its own shatter chance. */
  private chestBlows = 0;
  /** Throttles the broken-guard refusal so holding block can't spam it. */
  private guardWarnCd = 0;

  /**
   * Wear a piece of equipment and say something only when it crosses a line:
   * once when it is nearly gone, once when it goes. A message per swing would
   * be noise, and noise is how a player learns to stop reading the log.
   *
   * The Brittle curse adds +1 to every wear event, which is what makes
   * finding a font urgent rather than theoretical.
   */
  private wear(slot: EquipSlot, amount = 1): void {
    const it = this.state.equipment[slot];
    if (this.run.curse === 'brittle') amount += 1;
    const crossed = wearItem(it, amount);
    if (crossed === 'none' || !it) return;
    const name = itemName(it);
    if (crossed === 'warn') this.msg(`Your ${name} is close to failing.`, '#e8c060');
    else {
      this.msg(`Your ${name} breaks!`, '#ff7070');
      this.sfx('break');
      this.emit({ type: 'shake', amount: 0.3 });
    }
    this.refreshDerived();
  }

  /** Armour wears where you were actually hit: one worn piece takes the scuff. */
  private wearArmour(): void {
    const worn = (['body', 'head', 'hands'] as EquipSlot[]).filter((s) => {
      const it = this.state.equipment[s];
      return it && !durability(it).broken;
    });
    // 2 per unblocked hit (was 1): armour is a consumable now, not furniture.
    if (worn.length) this.wear(this.rng.pick(worn), 2);
  }

  /** A swing that hit nothing still dulls the edge, slowly: 1 wear per 3 whiffs. */
  private wearWhiff(): void {
    this.whiffs += 1;
    if (this.whiffs >= 3) {
      this.whiffs = 0;
      this.wear('weapon', 1);
    }
  }

  /** Extra tiles of sight the floor has on you, from the Hunted curse. */
  private get sightPenalty(): number {
    return (this.run.curse === 'hunted' ? 3 : 0) - this.derived.traits.unseen - (this.anim?.unseenT > 0 ? 99 : 0);
  }

  private emit(e: WorldEvent): void {
    this.events.push(e);
  }

  private msg(text: string, color?: string): void {
    this.emit({ type: 'msg', text, color });
  }

  private sfx(name: SfxName, x?: number, y?: number): void {
    this.emit({ type: 'sfx', name, x, y });
  }

  drainEvents(): WorldEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  press(a: Action): void {
    this.held.add(a);
    this.queued = a;
  }

  release(a: Action | 'block'): void {
    this.held.delete(a);
  }

  setBlock(on: boolean): void {
    if (on) this.held.add('block');
    else this.held.delete('block');
  }

  get busy(): boolean {
    return this.run.outcome !== 'active' || !!this.anim.transition || this.anim.sip !== null || !!this.anim.chew;
  }

  get moving(): boolean {
    return this.anim.moveT < 1 || this.anim.turnT < 1;
  }

  /**
   * What the infusion does once the sip has landed. Named every time, so the
   * player learns what their flask is by drinking it.
   */
  private drinkDraught(d: Draught | null): void {
    if (!d) return;
    const a = this.anim;
    switch (d.kind) {
      case 'breath':
        this.player.stamina = this.derived.maxStamina;
        this.msg(`${d.name}: your wind comes back.`, d.color);
        break;
      case 'iron':
        a.draught = { kind: 'iron', t: WARD_SECONDS, total: WARD_SECONDS };
        this.msg(`${d.name}: iron settles over you. The next blow is blunted.`, d.color);
        break;
      case 'marrow':
        a.draught = { kind: 'marrow', t: MARROW_SECONDS, total: MARROW_SECONDS };
        this.msg(`${d.name}: your arm fills. Make the next strike count.`, d.color);
        break;
      case 'kindled':
        a.draught = { kind: 'kindled', t: KINDLE_SECONDS, total: KINDLE_SECONDS };
        this.refreshDerived();
        this.msg(`${d.name}: your weapon takes it. ${d.kindleLabel}.`, d.color);
        break;
      default:
        // Thick, Quick and Fight Milk are in the heal, the sip time and the
        // delve itself; there is nothing further to announce.
        break;
    }
  }

  /** Begin the flask commitment. The charge is spent only when the sip lands. */
  sipFlask(): boolean {
    const flask = (this.run.flask ??= { charges: flaskMax(this.state.flask?.shards ?? 0), dregs: 0 });
    if (this.player.hp >= this.derived.maxHp) {
      this.sipBuffered = 0;
      this.msg('You are already at full health.', '#888');
      return false;
    }
    if (flask.charges <= 0) {
      this.sipBuffered = 0;
      this.msg('The flask is dry.', '#888');
      return false;
    }
    if (this.busy || this.grabbed || this.anim.attack !== 'idle' || this.anim.cast || this.anim.sip !== null || this.anim.chew) return false;
    // Mid-step presses are buffered, not dropped: the sip starts the moment
    // the step lands, so walking never eats the input. Anything longer than
    // the buffer is a new decision, not a late one.
    if (this.moving) {
      this.sipBuffered = SIP_BUFFER_SECONDS;
      return false;
    }
    this.anim.sip = draught(this.state.flask?.infusion)?.sipSeconds ?? SIP_SECONDS;
    this.held.clear();
    this.setBlock(false);
    return true;
  }

  frontTile(dist = 1): { x: number; y: number } {
    return { x: this.player.x + DX[this.player.facing] * dist, y: this.player.y + DY[this.player.facing] * dist };
  }

  // -------------------------------------------------------------------------
  // Main update
  // -------------------------------------------------------------------------

  update(dt: number): void {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    if (this.run.outcome !== 'active') return;
    this.run.stats.time += dt;
    const a = this.anim;
    if (a.draught) {
      a.draught.t -= dt;
      if (a.draught.t <= 0) {
        const kind = a.draught.kind;
        a.draught = null;
        if (kind === 'kindled') {
          this.refreshDerived();
          this.msg('The kindling on your blade gutters out.', '#9a9aa8');
        }
      }
    }

    // Rot is run-clock based and therefore pauses naturally in town. Floors
    // are cleaned lazily when visited; no background ticking is needed.
    this.floor.morsels ??= [];
    this.floor.morsels = this.floor.morsels.filter((m) => this.run.stats.time - m.droppedAt < MORSEL_ROT_SECONDS);

    this.run.thrown ??= { held: {}, retrieveCd: 0 };
    this.run.thrown.retrieveCd = Math.max(0, (this.run.thrown.retrieveCd ?? 0) - dt);
    a.snuffT = Math.max(0, a.snuffT - dt);
    a.unseenT = Math.max(0, a.unseenT - dt);
    if (a.ward) {
      a.ward.t -= dt;
      if (a.ward.t <= 0 || a.ward.x !== this.player.x || a.ward.y !== this.player.y) a.ward = null;
    }
    if (this.run.sigil && this.run.sigil.cd > 0) {
      const hunted = this.floor.enemies.some((e) => e.ai !== 'dead' && e.alert > 0 && Math.abs(e.x - this.player.x) + Math.abs(e.y - this.player.y) <= 8);
      this.run.sigil.cd = Math.max(0, this.run.sigil.cd - dt * (hunted ? 0.5 : 1));
    }

    if (a.transition) {
      a.transition.t += dt;
      if (!a.transition.done && a.transition.t >= 0.45) {
        a.transition.done = true;
        this.changeFloor(a.transition.dir);
      }
      if (a.transition.t >= 0.9) a.transition = null;
      return;
    }

    // Interpolation.
    if (a.moveT < 1) {
      a.moveT = Math.min(1, a.moveT + dt / a.moveDur);
      if (a.moveT >= 1) this.arrive();
    }
    if (a.turnT < 1) {
      a.turnT = Math.min(1, a.turnT + dt / TURN_TIME);
      const e = 1 - Math.pow(1 - a.turnT, 2);
      a.yaw = a.yawFrom + (a.yawTo - a.yawFrom) * e;
      if (a.turnT >= 1) this.turnReadyAt = this.time + TURN_REPEAT;
    }

    // Block raise/lower, and the parry window that opens as the guard comes up.
    // A bashed head guards nothing: stun drops the shield and locks it down.
    a.stunT = Math.max(0, a.stunT - dt);
    a.rangedParryT = Math.max(0, a.rangedParryT - dt);
    a.parryInvulnT = Math.max(0, a.parryInvulnT - dt);
    // A sip is a commitment: the guard stays down for the whole 0.5s, so a
    // blow mid-sip lands unblocked (see damagePlayer) and the heal still lands.
    const wantGuard = this.held.has('block') && a.attack === 'idle' && !a.cast && a.stunT <= 0 && a.sip === null;
    const brokenGuard = wantGuard ? this.brokenGuardGear() : null;
    const wantBlock = wantGuard && !brokenGuard;
    a.parryCd = Math.max(0, a.parryCd - dt);
    if (wantBlock) {
      if (a.blockT === Infinity) {
        // Rising edge: this raise gets a window only if we're off cooldown.
        a.blockT = 0;
        a.parryArmed = a.parryCd <= 0;
        if (a.parryArmed) a.parryCd = a.ward ? PARRY_COOLDOWN * 0.6 : PARRY_COOLDOWN;
      } else {
        a.blockT += dt;
      }
    } else {
      a.blockT = Infinity;
      a.parryArmed = false;
    }
    a.blockRaise = Math.max(0, Math.min(1, a.blockRaise + (wantBlock ? dt : -dt) / 0.12));

    // Refusing the guard says why, throttled like the winded cue: holding
    // block with a broken shield would otherwise fail in silence.
    this.guardWarnCd = Math.max(0, this.guardWarnCd - dt);
    if (brokenGuard && this.guardWarnCd <= 0) {
      this.guardWarnCd = 1.6;
      this.msg(`Your broken ${itemName(brokenGuard)} cannot guard — mend it at the forge.`, '#ff9070');
    }

    // Next movement, from the queue or held keys. Stun sits you out.
    // A buffered sip holds the next step, or a held walk key would start a new
    // step on the very tick the last one landed and the sip would never fit.
    if (!this.moving && a.transition === null && a.stunT <= 0 && !a.cast && a.sip === null && !a.chew && this.sipBuffered <= 0) {
      const next = this.queued ?? this.heldMove();
      this.queued = null;
      if (next) this.doAction(next);
    }

    // Attack timeline.
    if (a.attack !== 'idle') {
      a.attackT += dt;
      if (a.attack === 'windup' && a.attackT >= a.attackDur) {
        this.resolvePlayerAttack();
        a.attack = 'recover';
        a.attackT = 0;
        a.attackDur = a.attackRecovery;
      } else if (a.attack === 'recover' && a.attackT >= a.attackDur) {
        a.attack = 'idle';
        // The belt only holds the viewmodel for the length of the throw. Left
        // set, one javelin put shafts in your hands for the rest of the delve
        // and your sword was never seen again.
        a.attackThrow = false;
      }
    }

    if (a.cast) {
      a.cast.t -= dt;
      if (a.cast.t <= 0) {
        const id = a.cast.id;
        a.cast = null;
        this.resolveSigil(id);
      }
    }


    if (this.sipBuffered > 0) {
      this.sipBuffered = Math.max(0, this.sipBuffered - dt);
      // One attempt when the step lands, so a refusal speaks once, not per tick.
      if (!this.moving) {
        this.sipBuffered = 0;
        this.sipFlask();
      }
    }

    if (a.sip !== null) {
      a.sip -= dt;
      if (a.sip <= 0) {
        a.sip = null;
        const flask = this.run.flask;
        if (flask.charges > 0) {
          flask.charges--;
          const level = Math.max(0, Math.min(4, this.state.flask?.potency ?? 0));
          const d = draught(this.state.flask?.infusion);
          this.heal(this.derived.maxHp * (FLASK_POTENCY[level] + (d?.heal ?? 0) / 100));
          this.sfx('drink');
          this.drinkDraught(d);
        }
      }
    }

    if (a.chew) {
      a.chew.left = Math.max(0, a.chew.left - dt);
      const target = Math.round(a.chew.total * (1 - a.chew.left / CHEW_SECONDS));
      const portion = Math.max(0, target - a.chew.delivered);
      if (portion) {
        this.heal(portion);
        a.chew.delivered += portion;
      }
      if (a.chew.left <= 0) {
        const id = a.chew.id;
        a.chew = null;
        this.floor.morsels = (this.floor.morsels ?? []).filter((m) => m.id !== id);
        this.sfx('drink');
      }
    }

    // Stamina recovers; health never does on its own (flask, food, shrines and leech only).
    a.windedCd = Math.max(0, a.windedCd - dt);
    a.sinceStamina += dt;
    if (a.sinceStamina > STAMINA_DELAY && a.attack === 'idle') {
      const rate = (a.blockRaise > 0.5 ? STAMINA_REGEN * 0.3 : STAMINA_REGEN) * this.derived.traits.staminaRegen * this.diff.staminaRegen;
      this.player.stamina = Math.min(this.derived.maxStamina, this.player.stamina + rate * dt);
    }

    // Recall channel: it tears open a portal rather than yanking you home, so
    // the trip to town and back costs one scroll instead of the whole run.
    if (a.recall !== null) {
      a.recall -= dt;
      if (a.recall <= 0) {
        a.recall = null;
        this.openTownPortal();
      }
    }

    this.checkBossSeal();
    this.updateRetrieve(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.run.rngState = this.rng.state;
  }

  private heldMove(): Action | null {
    for (const a of ['forward', 'back', 'left', 'right', 'turnLeft', 'turnRight'] as Action[]) {
      if (!this.held.has(a)) continue;
      if ((a === 'turnLeft' || a === 'turnRight') && this.time < this.turnReadyAt) continue;
      return a;
    }
    return null;
  }

  private doAction(act: Action): void {
    const p = this.player;
    if (act === 'turnLeft' || act === 'turnRight') {
      p.facing = act === 'turnLeft' ? turnLeft(p.facing) : turnRight(p.facing);
      this.anim.yawFrom = this.anim.yaw;
      this.anim.yawTo = this.anim.yaw + (act === 'turnLeft' ? -Math.PI / 2 : Math.PI / 2);
      this.anim.turnT = 0;
      this.reveal();
      return;
    }
    const dir: Dir =
      act === 'forward' ? p.facing : act === 'back' ? turnAround(p.facing) : act === 'left' ? turnLeft(p.facing) : turnRight(p.facing);
    const nx = p.x + DX[dir];
    const ny = p.y + DY[dir];
    if (blocksMove(this.floor, nx, ny) || enemyAt(this.floor, nx, ny)) {
      // Bump: tell the player why a door didn't budge.
      const d = doorAt(this.floor, nx, ny);
      if (d && !d.open && act === 'forward') this.interact();
      return;
    }
    if (this.anim.recall !== null) {
      this.anim.recall = null;
      this.msg('The recall fizzles as you move.', '#888');
    }
    this.anim.fromX = p.x;
    this.anim.fromY = p.y;
    p.x = nx;
    p.y = ny;
    this.anim.moveT = 0;
    const encumbered = this.derived.stats.speed < -12;
    this.anim.moveDur = STEP_TIME * (act === 'back' ? 1.25 : 1) * (encumbered ? 1.2 : 1);
  }

  /** Called when a step completes. */
  private arrive(): void {
    this.trail.push({ x: this.player.x, y: this.player.y, facing: this.player.facing, time: this.run.stats.time });
    this.trail = this.trail.filter((p) => this.run.stats.time - p.time <= 2.1).slice(-5);
    const p = this.player;
    this.anim.steps++;
    this.reveal();
    this.checkBossSeal();
    const f = this.floor;
    this.collectThrownHere();
    const trap = trapAt(f, p.x, p.y);
    if (trap && trap.armed) {
      this.springTrap(trap, null);
      if (this.run.outcome !== 'active') return;
    }
    const s = stairsAt(f, p.x, p.y);
    this.sfx(biomeForFloor(f).id === 'catacombs' && !s ? 'splash' : 'step');
    if (s) {
      if (!s.down && this.run.depth === 1) {
        this.msg('You climb back into the daylight.', '#e8d8a0');
        this.finish('extracted');
        return;
      }
      this.anim.transition = { t: 0, dir: s.down ? 'down' : 'up', done: false };
      this.sfx('stairs');
      return;
    }
    // Auto-collect coin and keys; mention anything else lying here.
    const pk = f.pickups.find((q) => q.x === p.x && q.y === p.y);
    if (pk) {
      this.collectLoose(pk);
      if (pk.items.length) this.msg(`Something lies here. [F] to search.`, '#c8b890');
    }
  }

  private collectLoose(pk: Pickup): void {
    if (pk.gold > 0) {
      this.run.gold += pk.gold;
      this.run.stats.goldFound += pk.gold;
      this.emit({ type: 'float', x: pk.x, y: pk.y, text: `+${pk.gold}g`, color: '#ffd24a' });
      this.msg(`Picked up ${pk.gold} gold.`, '#ffd24a');
      this.sfx('gold');
      pk.gold = 0;
    }
    if (pk.keyId) {
      const key = this.floor.keys.find((k) => k.id === pk.keyId);
      this.run.keys.push(pk.keyId);
      this.msg(`Found the ${key?.name ?? 'key'}.`, '#ffe08a');
      this.sfx('unlock');
      pk.keyId = undefined;
    }
    this.prunePickups();
  }

  private prunePickups(): void {
    this.floor.pickups = this.floor.pickups.filter((q) => q.items.length > 0 || q.gold > 0 || q.keyId || q.flaskShard);
  }

  // -------------------------------------------------------------------------
  // Floors
  // -------------------------------------------------------------------------

  private changeFloor(dir: 'down' | 'up'): void {
    const run = this.run;
    // A floor transition cannot erase a charge that was still in flight.
    for (const pr of this.projectiles) {
      if (!pr.thrownBase) continue;
      // One already flying home is yours: it goes into the stock rather than
      // being dropped on the floor you are walking off, which would lose it.
      if (pr.returning) this.collectReturn(pr.thrownBase);
      else this.landThrown(pr.thrownBase, pr.tileX, pr.tileY);
    }
    this.retrieve(false);
    run.depth += dir === 'down' ? 1 : -1;
    if (!run.floors[run.depth - 1]) {
      // Pity guarantees: ≥1 shrine in depths 1–3, ≥2 in 4–6. Natural rolls
      // cover most runs; the force only bites on a drought.
      const force = shrinePityFor(run.floors, run.depth);
      run.floors[run.depth - 1] = generateFloor(run.seed, run.depth, this.difficultyId, force);
    }
    const f = this.floor;
    const arrive = f.stairs.find((s) => s.down === (dir === 'up'))!;
    const spot = stairsFront(arrive);
    this.player.x = spot.x;
    this.player.y = spot.y;
    this.player.facing = spot.facing;
    const yaw = spot.facing * (Math.PI / 2);
    Object.assign(this.anim, { fromX: spot.x, fromY: spot.y, moveT: 1, yaw, yawFrom: yaw, yawTo: yaw, turnT: 1 });
    this.projectiles = [];
    this.pathCache.clear();
    // A new floor means a new path: stale trail entries point at tiles on the
    // floor you just left, and a backstep within 2s of the stairs would read
    // them against the wrong map.
    this.trail = [{ x: spot.x, y: spot.y, facing: spot.facing, time: this.run.stats.time }];
    if (dir === 'down' && run.depth > run.stats.deepest) {
      run.stats.deepest = run.depth;
      recordDepth(this.state.contracts, run.depth);
      const milestone = run.depth >= 5 ? 2 : run.depth >= 3 ? 1 : 0;
      if (milestone > (this.state.flask?.shards ?? 0)) {
        const shard = f.pickups.find((p) => p.x === spot.x && p.y === spot.y) ?? { id: `shard_depth_${run.depth}`, x: spot.x, y: spot.y, items: [], gold: 0 };
        shard.flaskShard = true;
        if (!f.pickups.includes(shard)) f.pickups.push(shard);
        this.msg('A Flask Shard waits at the stair.', '#9fe0cf');
      }
    }
    this.reveal();
    const biome = biomeForFloor(f);
    this.msg(`Depth ${run.depth} — ${biome.name}`, '#d8c8a8');
    if (run.depth === FINAL_DEPTH && dir === 'down') this.msg('The air is thick with ash. Something waits below the throne.', '#c080ff');
    this.emit({ type: 'floor' });
  }

  /** Debug/playtest hook: jump a floor without walking to the stairs. */
  changeFloorForTest(dir: 'down' | 'up'): void {
    this.changeFloor(dir);
  }

  private finish(outcome: 'dead' | 'extracted'): void {
    if (this.run.outcome !== 'active') return;
    this.run.outcome = outcome;
    this.emit({ type: 'end', outcome });
  }

  /**
   * How many tiles down a clear line you read the floor. A better lamp buys one
   * more tile of warning — one extra step to stop in, which at a walk is the
   * difference between reading the floor and finding it the hard way.
   */
  private get lookAhead(): number {
    return 2 + (metaLevel(this.state.meta, 'lantern') > 0 ? 1 : 0) + this.derived.traits.trapSense;
  }

  /**
   * Notice the seam in the flagstones on the tile in front of you. Only the
   * tile you are about to step onto and the ones beside you, so a corridor
   * taken at a run is a corridor taken blind.
   */
  private spotTraps(): void {
    const f = this.floor;
    const p = this.player;
    const look: { x: number; y: number }[] = [];
    for (let d = 1; d <= this.lookAhead; d++) look.push(this.frontTile(d));
    for (const d of DIRS) look.push({ x: p.x + DX[d], y: p.y + DY[d] });
    // The same look reads the ceiling: whatever clings up there is found by
    // the same glance that finds a seam in the flagstones.
    for (const t of look) {
      const up = lurkerAt(f, t.x, t.y);
      if (!up || up.lurk !== 'ceiling' || up.spotted) continue;
      if (!this.los(p.x, p.y, t.x, t.y)) continue;
      up.spotted = true;
      this.msg('Something clings to the ceiling ahead.', '#d0b080');
      this.sfx('ui');
    }
    if (!f.traps?.length) return;
    for (const t of look) {
      const trap = trapAt(f, t.x, t.y);
      if (!trap || trap.found || !trap.armed) continue;
      if (!this.los(p.x, p.y, t.x, t.y)) continue;
      // The far tile is only readable if you are facing straight down it.
      if (Math.abs(t.x - p.x) + Math.abs(t.y - p.y) > 1 && blocksSight(f, t.x, t.y)) continue;
      trap.found = true;
      this.msg(`${TRAPS[trap.kind].spotted}`, '#e0c060');
      this.sfx('ui');
    }
  }

  /**
   * Set a trap off. `victim` is the monster that stood on it, or null for you —
   * monsters blunder into them too, which is the whole reason to back through
   * one you have already found.
   */
  private springTrap(trap: Trap, victim: EnemyState | null): void {
    const def = TRAPS[trap.kind];
    trap.armed = false;
    trap.found = true;
    const depth = this.run.depth;
    this.emit({ type: 'trap', id: trap.id, x: trap.x, y: trap.y, kind: trap.kind });
    this.sfx(def.sfx, trap.x, trap.y);

    if (trap.kind === 'alarm') {
      // No damage — it just tells the floor exactly where you are.
      let woken = 0;
      for (const e of this.floor.enemies) {
        if (e.ai === 'dead') continue;
        if (Math.abs(e.x - trap.x) + Math.abs(e.y - trap.y) > 12) continue;
        e.alert = Math.max(e.alert, 10);
        e.lastSeenX = trap.x;
        e.lastSeenY = trap.y;
        woken++;
      }
      if (!victim) {
        this.msg(woken ? 'A ward shrieks. Something heard that.' : 'A ward shrieks into an empty floor.', '#ff9070');
        this.emit({ type: 'shake', amount: 0.2 });
      }
      return;
    }

    const damage = Math.round(def.base + def.perDepth * depth);
    if (victim) {
      // Monsters take the hit raw; they have no armour model for hazards.
      // Deliberately unscaled by difficulty: a softer trap that still thins
      // the pack for you is help enough on Normal.
      const dealt = Math.max(1, Math.round(damage * 0.8));
      victim.hp -= dealt;
      victim.hurtT = 0.3;
      const vdef = enemyDef(victim.def);
      this.emit({ type: 'float', x: victim.x, y: victim.y, text: `${dealt}`, color: '#ffb060' });
      if (victim.hp <= 0) {
        this.msg(`The ${vdef.name} blunders into ${def.article}.`, '#e0c060');
        this.killEnemy(victim);
      }
      return;
    }
    this.msg(def.hit, '#ff7070');
    this.damagePlayer(Math.max(1, Math.round(damage * this.diff.trapDamage)), def.damageType, trap.x, trap.y, def.source);
  }

  /** Mark tiles near and in view as explored (automap fog). */
  private reveal(): void {
    const f = this.floor;
    const { x, y } = this.player;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const tx = x + dx, ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= f.width || ty >= f.height) continue;
      if (Math.abs(dx) + Math.abs(dy) <= 3 && this.los(x, y, tx, ty, true)) f.explored[ty * f.width + tx] = 1;
    }
    // Straight ahead down the corridor.
    for (let d = 1; d <= 8; d++) {
      const t = this.frontTile(d);
      if (t.x < 0 || t.y < 0 || t.x >= f.width || t.y >= f.height) break;
      f.explored[t.y * f.width + t.x] = 1;
      for (const side of [turnLeft(this.player.facing), turnRight(this.player.facing)]) {
        const sx = t.x + DX[side], sy = t.y + DY[side];
        if (sx >= 0 && sy >= 0 && sx < f.width && sy < f.height) f.explored[sy * f.width + sx] = 1;
      }
      if (blocksSight(f, t.x, t.y)) break;
    }
    this.spotTraps();
  }

  /**
   * Is an attack arriving from (x, y) inside the parry window? The guard has to
   * have gone up in the last PARRY_WINDOW seconds and be facing the attack —
   * the same facing rule blocking uses, since a parry is a sharper block.
   */
  private parries(fromX: number, fromY: number): boolean {
    const a = this.anim;
    const window = a.ward ? PARRY_WINDOW * 2 : PARRY_WINDOW;
    if (!a.parryArmed || a.blockT > window) return false;
    return this.facingSource(fromX, fromY);
  }

  /** A projectile parry may spend the one follow-up granted by a prior reflection. */
  private parriesProjectile(fromX: number, fromY: number): boolean {
    return this.parries(fromX, fromY) || (this.anim.rangedParryT > 0 && this.facingSource(fromX, fromY));
  }

  /** Whether an attack from (x, y) comes at you from the tile you are facing. */
  private facingSource(fromX: number, fromY: number): boolean {
    const p = this.player;
    const front = this.frontTile();
    return (
      (fromX === front.x && fromY === front.y) ||
      (Math.sign(fromX - p.x) === DX[p.facing] && Math.sign(fromY - p.y) === DY[p.facing] && (fromX === p.x || fromY === p.y))
    );
  }

  /**
   * The gear your guard is raised with — the shield if you carry one, else
   * the weapon — when it is broken and guards nothing. At 15% stats a
   * cracked guard would barely turn a blow anyway, and a guard that
   * sometimes works teaches you to trust it right up until it doesn't.
   * Fists cannot break, so an unarmed guard always holds.
   */
  private brokenGuardGear(): Item | null {
    const eq = this.state.equipment;
    const g = this.derived.hasShield ? eq.offhand : eq.weapon;
    return g && durability(g).broken ? g : null;
  }

  /** Shared feedback for any parry: it should feel like a moment. */
  private parryFlourish(x: number, y: number): void {
    this.anim.blockT = Infinity;
    this.anim.parryArmed = false;
    this.sfx('parry', x, y);
    this.emit({ type: 'float', x, y, text: 'Parry!', color: '#ffe8a0' });
    this.emit({ type: 'shake', amount: 0.35 });
  }

  /** Grid line of sight (Bresenham). `inclusive` lets the target itself be opaque. */
  los(x0: number, y0: number, x1: number, y1: number, inclusive = false): boolean {
    const f = this.floor;
    if (this.crossesBossBoundary(x0, y0, x1, y1)) return false;
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0, y = y0;
    for (;;) {
      if (x === x1 && y === y1) return true;
      if (!(x === x0 && y === y0) && blocksSight(f, x, y)) return false;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
      if (inclusive && x === x1 && y === y1) return true;
    }
  }

  // -------------------------------------------------------------------------
  // Player actions
  // -------------------------------------------------------------------------

  attack(): void {
    const a = this.anim;
    if (this.busy || a.attack !== 'idle' || a.stunT > 0 || a.cast) return;
    // A swing has to be paid for in full. This used to clamp at zero and land
    // anyway at staminaPower's 40% floor, so a spent player could attack for
    // free forever. Gating on "any stamina at all" is not enough either: the
    // trickle of regen at the tail of each recovery is always a sliver above
    // zero, which kept the free swings coming. How tired you are still shows
    // in the damage, through staminaPower — it just is not free any more.
    const profile: SwingProfile = this.derived.swing;
    const cost = profile.staminaCost;
    if (this.player.stamina < cost) {
      // Throttled hard: at the bottom of the bar almost every frame is a
      // refusal, and without this the breath loops under a held button.
      if (a.windedCd <= 0) {
        a.windedCd = 1.6;
        this.sfx('winded');
      }
      return;
    }
    a.attackPower = staminaPower(this.player.stamina, this.derived.maxStamina);
    this.player.stamina = Math.max(0, this.player.stamina - cost);
    a.sinceStamina = 0;
    a.attack = 'windup';
    a.attackT = 0;
    a.attackThrow = false;
    a.attackBase = null;
    a.attackWeaponUid = null;
    a.attackSnapshot = null;
    a.attackRecovery = profile.recovery;
    a.attackDur = profile.windup;
    a.blockRaise = 0;
    this.rockAndStone();
    this.breakChannels();
  }

  /**
   * Throw one shaft of the equipped thrown weapon.
   *
   * On its own key, not on the attack button. Attack used to throw by itself
   * whenever nothing was adjacent, which meant the weapon decided for you: you
   * could not choose to close and stab, you could not swing at a barrel, and
   * stepping back from a fight spent a javelin you were saving. A throw is a
   * decision, so it gets a key.
   */
  hurl(): boolean {
    const a = this.anim;
    if (this.busy || a.attack !== 'idle' || a.stunT > 0 || a.cast) return false;
    const thrown = this.derived.thrown;
    const base = this.state.equipment.thrown?.ref;
    if (!thrown || !base) {
      this.msg('Nothing on your belt to throw.', '#888');
      return false;
    }
    if ((this.run.thrown?.held?.[base] ?? 0) <= 0) {
      this.msg(`Out of ${itemBase(base).name.toLowerCase()} — hold R to call them back.`, '#ff9070');
      return false;
    }
    if (this.player.stamina < thrown.staminaCost) {
      if (a.windedCd <= 0) {
        a.windedCd = 1.6;
        this.sfx('winded');
      }
      return false;
    }
    a.attackPower = staminaPower(this.player.stamina, this.derived.maxStamina);
    this.player.stamina = Math.max(0, this.player.stamina - thrown.staminaCost);
    a.sinceStamina = 0;
    a.attack = 'windup';
    a.attackT = 0;
    a.attackThrow = true;
    a.attackBase = base;
    a.attackWeaponUid = this.state.equipment.thrown?.uid ?? null;
    a.attackSnapshot = {
      ...thrownView(this.derived),
      stats: { ...this.derived.stats },
      traits: { ...this.derived.traits },
      swing: { ...this.derived.swing },
    };
    a.attackRecovery = thrown.recovery;
    a.attackDur = thrown.windup;
    a.blockRaise = 0;
    this.breakChannels();
    return true;
  }

  /** Everything that a deliberate action of your own cancels. */
  private breakChannels(): void {
    const a = this.anim;
    if (a.recall !== null) {
      a.recall = null;
      this.msg('The recall fizzles.', '#888');
    }
    if (a.retrieving) {
      a.retrieving = null;
      this.msg('You stop calling them back.', '#888');
    }
  }

  /**
   * Begin charging returns for the equipped base across the run.
   *
   * Hold to channel: each shaft takes RETRIEVE_PER_SHAFT to leave the
   * floor. Release stops further launches; shafts already airborne still land.
   */
  retrieve(held = true): boolean {
    const a = this.anim;
    if (!held) {
      a.retrieving = null;
      return false;
    }
    if (a.retrieving) return true;
    const base = this.state.equipment.thrown?.ref;
    const thrown = this.derived.thrown;
    if (!base || !thrown) {
      this.msg('Nothing on your belt to call back.', '#888');
      return false;
    }
    if (this.busy || (a.attack !== 'idle' && !a.attackThrow) || a.stunT > 0 || a.cast) return false;
    const count = this.retrievableCount(base);
    if (!count) {
      this.msg(`No ${itemBase(base).name.toLowerCase()} left to retrieve.`, '#888');
      return false;
    }
    a.retrieving = { base, left: count, t: RETRIEVE_PER_SHAFT };
    this.msg(`You raise your hand. ${count} ${itemBase(base).name.toLowerCase()} to retrieve.`, '#c8b890');
    return true;
  }

  /** Current floor first; remote stock never needs a cross-floor projectile. */
  private retrievalStock(base: string) {
    const floors = [this.floor, ...this.run.floors.filter(f => f && f !== this.floor)];
    return floors.flatMap(floor => (floor?.thrown ?? [])
      .filter(marker => marker.base === base && marker.n > 0)
      .map(marker => ({ floor: floor!, marker })));
  }

  private outgoingThrows(base: string): Projectile[] {
    return this.projectiles.filter(pr => pr.thrownBase === base && !pr.returning && pr.speed > 0);
  }

  private retrievableCount(base: string): number {
    const windingUp = this.anim.attackThrow && this.anim.attack === 'windup' && this.anim.attackBase === base ? 1 : 0;
    return this.retrievalStock(base).reduce((n, { marker }) => n + marker.n, 0)
      + this.outgoingThrows(base).length + windingUp;
  }

  /** One tick of the retrieval channel. */
  private updateRetrieve(dt: number): void {
    const a = this.anim;
    const r = a.retrieving;
    if (!r) return;
    // Swinging, casting and being stunned all end it; walking does not, because
    // the shafts are coming to you rather than you to them.
    const thrown = this.derived.thrown;
    if (!thrown || this.state.equipment.thrown?.ref !== r.base || (a.attack !== 'idle' && !a.attackThrow) || a.stunT > 0 || a.cast) {
      a.retrieving = null;
      return;
    }
    // The final charge is complete: keep the receiving pose until arrival.
    // Release/attack still cancels the pose without cancelling airborne shafts.
    if (r.left <= 0) return;
    r.t -= dt;
    if (r.t > 1e-9) return;
    const stock = this.retrievalStock(r.base)[0];
    const outgoing = this.outgoingThrows(r.base)[0];
    if (!stock && !outgoing) {
      // The floor ran dry without a launch spending the last of `left` — that
      // happens when shafts are picked up by walking mid-call. Walking is the
      // other cost, already paid in steps, so the call just ends: no cooldown
      // for recovering the rest on foot.
      a.retrieving = null;
      return;
    }
    // The shaft leaves the floor now and flies home; it is added to the stock
    // when it arrives, not here. Nothing is ever in limbo: it is either a
    // marker on the floor, a projectile in the air, or in your stock, and
    // stopping the call mid-flight still lets the one already airborne land.
    let fromX: number, fromY: number, otherFloor = false;
    if (stock) {
      const { marker, floor } = stock;
      marker.n--;
      floor.thrown = (floor.thrown ?? []).filter(m => m.n > 0);
      fromX = marker.x;
      fromY = marker.y;
      otherFloor = floor !== this.floor;
    } else {
      // Transfer the outgoing shaft to its return only once charging finishes.
      fromX = outgoing.x - 0.5;
      fromY = outgoing.y - 0.5;
      this.projectiles = this.projectiles.filter(pr => pr !== outgoing);
    }
    const remote = otherFloor || Math.hypot(fromX - this.player.x, fromY - this.player.y) > RETURN_VISIBLE_TILES;
    this.launchReturn(r.base,
      remote ? this.player.x + DX[this.player.facing] * RETURN_LOCAL_TILES : fromX,
      remote ? this.player.y + DY[this.player.facing] * RETURN_LOCAL_TILES : fromY);
    this.sfx('retrieve');
    r.left = this.retrievableCount(r.base);
    if (r.left <= 0) {
      r.t = 0;
      this.msg(`${itemBase(r.base).name} coming back to your hand.`, '#c8b890');
      return;
    }
    r.t += RETRIEVE_PER_SHAFT;
  }

  /**
   * A called shaft has reached your hand.
   *
   * The stock is credited here rather than when it left the floor, so it is
   * never in limbo — a shaft is a marker on the floor, a projectile in the air,
   * or in your stock, and nothing can lose one in between. Stopping the call
   * still lets whatever is already airborne land.
   */
  private collectReturn(base: string): void {
    this.run.thrown ??= { held: {}, retrieveCd: 0 };
    this.run.thrown.held[base] = (this.run.thrown.held[base] ?? 0) + 1;
    this.wear('thrown');
    this.emit({ type: 'float', x: this.player.x, y: this.player.y, text: `+1`, color: '#c8b890' });
  }

  /** Send one recovered shaft flying from where it lay back to your hand. */
  private launchReturn(base: string, fromX: number, fromY: number): void {
    const thrown = this.derived.thrown;
    const dx = this.player.x - fromX, dy = this.player.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    this.projectiles.push({
      id: this.projN++,
      x: fromX + 0.5, y: fromY + 0.5,
      dx: dx / len, dy: dy / len,
      speed: RETURN_SPEED,
      damage: 0, type: 'pierce',
      sprite: thrown?.sprite ?? 'proj_knife',
      tileX: fromX, tileY: fromY,
      source: 'your hand',
      returning: true,
      thrownBase: base,
    });
  }

  /**
   * Every shaft of the belted base, wherever it is: in hand, on the floor, or
   * flying home. The three used to be shown — and counted — separately, which
   * is how the call could promise shafts the stock never received: the counter
   * moved when a shaft left the floor, the stock only when one arrived, and a
   * stop between the two lost the difference.
   */
  thrownCounts(): { held: number; cap: number; floor: number; flying: number; calling: boolean } | null {
    const base = this.state.equipment.thrown?.ref;
    const thrown = this.derived.thrown;
    if (!base || !thrown) return null;
    const floor = this.retrievalStock(base).reduce((n, { marker }) => n + marker.n, 0);
    let flying = 0;
    for (const pr of this.projectiles) if (pr.returning && pr.thrownBase === base) flying++;
    return {
      held: this.run.thrown.held[base] ?? 0,
      cap: this.derived.thrownCapacity,
      floor,
      flying,
      calling: this.anim.retrieving?.base === base,
    };
  }

  /**
   * Begin a cast.
   *
   * Every refusal says why. It used to return false in silence for six
   * different reasons — no sigil attuned, still cooling, walking, mid-swing,
   * stunned, out of breath — so pressing the key and having nothing at all
   * happen was the normal experience of the feature, and indistinguishable
   * from it being broken.
   */
  castSigil(): boolean {
    const active = this.run.sigil;
    const a = this.anim;
    if (!active) {
      this.msg('No sigil attuned. Inscribe and attune one at the forge.', '#888');
      return false;
    }
    const def = sigil(active.id);
    if (a.cast) return false;
    if (active.cd > 0) {
      this.msg(`${def.name} is still cold — ${Math.ceil(active.cd)}s.`, '#888');
      return false;
    }
    if (this.busy || this.moving || a.attack !== 'idle' || a.stunT > 0) {
      this.msg('You must stand still to cast.', '#888');
      return false;
    }
    if (this.player.stamina < def.stamina) {
      this.msg(`Not enough breath for the ${def.name} — ${def.stamina} needed.`, '#ff9070');
      return false;
    }
    this.player.stamina -= def.stamina;
    a.sinceStamina = 0;
    a.blockRaise = 0;
    a.cast = { id: def.id, t: def.cast };
    this.msg(`You raise the ${def.name}...`, '#9a8fd8');
    this.sfx('sigil');
    return true;
  }

  /**
   * Each sigil's own colour for the wash that plays when it lands.
   *
   * Casting had no moment: the stamina went, the cooldown started, and unless
   * you happened to be looking at the one thing that got pushed there was
   * nothing to tell you it had worked. Four of the five do something you cannot
   * see from where you stand.
   */
  private static readonly SIGIL_FLASH: Record<SigilId, [number, number, number, number]> = {
    wardcry: [0.95, 0.85, 0.55, 0.5],
    snuff: [0.05, 0.04, 0.10, 0.6],
    sounding: [0.55, 0.75, 1.0, 0.38],
    threshold: [1.0, 0.82, 0.45, 0.42],
    temper: [0.75, 0.95, 0.7, 0.36],
  };

  private resolveSigil(id: SigilId): void {
    const def = sigil(id);
    switch (id) {
      case 'wardcry': this.castWardcry(); break;
      case 'snuff': this.castSnuff(); break;
      case 'sounding': this.castSounding(); break;
      case 'threshold': this.anim.ward = { x: this.player.x, y: this.player.y, t: 8 }; break;
      case 'temper': this.castTemper(); break;
    }
    if (this.run.sigil) this.run.sigil.cd = def.cooldown;
    const [r, g, b, strength] = World.SIGIL_FLASH[id];
    this.emit({ type: 'sigil', r, g, b, strength });
    this.emit({ type: 'shake', amount: id === 'wardcry' ? 0.5 : 0.2 });
    this.emit({ type: 'float', x: this.player.x, y: this.player.y, text: def.name.replace('Sigil of ', ''), color: '#c8b8ff' });
    this.sfx('sigil_land');
    this.msg(`${def.name} answers.`, '#c8b8ff');
  }

  private castWardcry(): void {
    for (const e of this.floor.enemies) {
      if (e.ai === 'dead' || Math.abs(e.x - this.player.x) + Math.abs(e.y - this.player.y) > 8) continue;
      e.alert = Math.max(e.alert, 8);
      e.lastSeenX = this.player.x;
      e.lastSeenY = this.player.y;
    }
    const front = this.frontTile();
    const e = enemyAt(this.floor, front.x, front.y);
    if (!e) return;
    const enemy = this.view(e);
    if (enemy.behavior === 'boss') {
      e.attackCd = Math.max(e.attackCd, 0.5);
      return;
    }
    e.ai = 'recover';
    e.timer = Math.max(e.timer, 1.2);
    e.attackCd = Math.max(e.attackCd, 1.4);
    if (enemy.shield) { e.guard = 'down'; e.guardT = GUARD_DOWN; e.blocks = 0; }
    const destination = this.frontTile(2);
    const portal = this.floor.props.some((p) => (p.kind === 'portal' || p.kind === 'town_portal') && p.x === destination.x && p.y === destination.y);
    if (this.canStep(e, destination.x, destination.y) && !portal) {
      this.stepEnemy(e, destination.x, destination.y);
      return;
    }
    const other = enemyAt(this.floor, destination.x, destination.y);
    if (other) {
      other.ai = 'recover';
      other.timer = Math.max(other.timer, 0.6);
      other.attackCd = Math.max(other.attackCd, 0.6);
      return;
    }
    e.timer = Math.max(e.timer, 1.8);
    const damage = Math.min(25, Math.round(e.maxHp * 0.1));
    e.hp -= Math.round(damage * (enemy.resist.blunt ?? 1));
    e.hurtT = 0.3;
    if (e.hp <= 0) this.killEnemy(e);
  }

  private castSnuff(): void {
    for (const e of this.floor.enemies) {
      if (e.ai === 'dead' || e.ai === 'windup' || Math.abs(e.x - this.player.x) + Math.abs(e.y - this.player.y) > 12) continue;
      e.alert = 0;
      if (e.ai === 'chase') e.ai = 'idle';
    }
    this.anim.snuffT = 8;
    this.anim.unseenT = 3;
    this.sfx('snuff');
  }

  private castSounding(): void {
    const f = this.floor;
    for (let y = this.player.y - 6; y <= this.player.y + 6; y++) for (let x = this.player.x - 6; x <= this.player.x + 6; x++) {
      if (!inBounds(f, x, y) || Math.abs(x - this.player.x) + Math.abs(y - this.player.y) > 6) continue;
      f.explored[y * f.width + x] = 1;
      const trap = trapAt(f, x, y);
      if (trap && !trap.found) {
        trap.found = true;
        this.msg(TRAPS[trap.kind].spotted, '#e0c060');
      }
    }
    for (const e of f.enemies) {
      if (e.lurk !== 'ceiling' || e.spotted || e.ai === 'dead') continue;
      if (Math.abs(e.x - this.player.x) + Math.abs(e.y - this.player.y) > 6) continue;
      e.spotted = true;
      this.msg('Something clings to the ceiling nearby.', '#d0b080');
    }
    for (const secret of f.secrets) {
      const dx = secret.x - this.player.x, dy = secret.y - this.player.y;
      if (secret.found || Math.abs(dx) + Math.abs(dy) > 6) continue;
      const bearing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north');
      this.msg(`Stone rings hollow to the ${bearing}.`, '#e8d8a0');
    }
  }

  private castTemper(): void {
    const slots = this.derived.twoHanded ? EQUIP_SLOTS.filter((s) => s !== 'offhand') : EQUIP_SLOTS;
    const worst = slots.map((slot) => ({ slot, item: this.state.equipment[slot] }))
      .filter((v): v is { slot: EquipSlot; item: Item } => !!v.item && durability(v.item).max > 0)
      .sort((a, b) => durability(a.item).frac - durability(b.item).frac)[0];
    if (!worst) return;
    const d = durability(worst.item);
    worst.item.dur = Math.min(d.max, (worst.item.dur ?? d.max) + Math.round(d.max * 0.25));
    this.refreshDerived();
  }

  /** A separate flavor stream must never move combat, loot or dungeon RNG. */
  private rockAndStone(): void {
    const weapon = this.state.equipment.weapon;
    if (weapon && itemBase(weapon.ref).weaponClass === 'pick' && this.flavorRng.chance(0.01)) {
      this.msg('Rock and Stone!', '#d8b878');
    }
  }

  private resolvePlayerAttack(): void {
    const f = this.floor;
    if (this.anim.attackThrow) {
      this.throwWeapon();
      return;
    }
    this.sfx('swing');
    for (let d = 1; d <= this.derived.swing.reach; d++) {
      const t = this.frontTile(d);
      // A spotted dropper overhead, or any mound, can be struck where it
      // hides: it comes out early, reeling and open.
      const hidden = d === 1 ? lurkerAt(f, t.x, t.y) : undefined;
      if (hidden && (hidden.lurk === 'buried' || hidden.spotted)) {
        this.knockOut(hidden);
        this.wear('weapon', 2);
        return;
      }
      const e = enemyAt(f, t.x, t.y);
      if (e) {
        this.hitEnemy(e);
        // 2 per landed blow, 3 on a cleave (was 1/2): ~55 hits to break a
        // weapon, roughly a floor and a half of fighting, not four floors.
        this.wear('weapon', this.cleave(t.x, t.y) ? 3 : 2);
        return;
      }
      const p = propAt(f, t.x, t.y);
      if (p && d === 1 && (p.kind === 'urn' || p.kind === 'barrel' || p.kind === 'root_cache') && !p.used) {
        this.breakProp(p);
        return;
      }
      const crack = d === 1 ? crackAt(f, t.x, t.y) : undefined;
      if (crack) {
        this.strikeCrack(crack);
        return;
      }
      // An emptied chest is only boards now: one blow and it is splinters.
      if (p && p.kind === 'chest' && p.used && !p.smashed) {
        p.smashed = true;
        this.sfx('break', p.x, p.y);
        this.emit({ type: 'shake', amount: 0.15 });
        return;
      }
      // Dark Souls rules: an honest chest shrugs off a blow like a wall does,
      // and a mimic takes it and wakes up. Hitting first is the test.
      if (p && p.kind === 'chest' && !p.used) {
        this.wear('weapon', 1);
        this.chestClang(p);
        // The blow only wakes it: it rises at full health, as in Dark Souls.
        if (p.mimic) {
          this.wakeMimic(p, MIMIC_RISE);
          this.sfx('alert', p.x, p.y);
          this.emit({ type: 'shake', amount: 0.4 });
          this.msg('The chest rises up and reveals itself. Prepare to fight!', '#e8c080');
          return;
        }
        this.sfx('block', p.x, p.y);
        this.emit({ type: 'shake', amount: 0.15 });
        this.shatterInChest(p);
        this.msg('Your blow glances off the chest. Something inside breaks.', '#d0a070');
        return;
      }
      if (blocksSight(f, t.x, t.y)) break;
    }
    this.wearWhiff();
    this.sfx('miss');
  }

  /**
   * Spill a two-hander's blow into everything touching the thing it landed on.
   *
   * The cleave is centred on the *target*, not on you, which is the whole
   * difference between it and a shield: a guard covers the tile you face, and
   * this covers the rank behind that tile. With a halberd's reach the centre is
   * two tiles out, so the cleave lands entirely among the things you cannot
   * touch with anything else in the game.
   *
   * Your own tile is excluded — you are standing on it, and a swing that
   * wrapped all the way back around would be free damage on anything that had
   * already closed, which is exactly the position a two-hander is supposed to
   * be bad in. The main target is excluded because it already took the blow in
   * full.
   *
   * Returns whether anything was caught, which is all the caller wants: a
   * cleave that bit costs the weapon a second point of wear.
   */
  private cleave(cx: number, cy: number): boolean {
    const mult = this.derived.swing.cleave;
    if (!mult) return false;
    // A broken edge spills nothing: the blow still lands single-target at
    // 15%, but there is no splash into its neighbours.
    const w = this.state.equipment.weapon;
    if (w && durability(w).broken) return false;
    const caught: EnemyState[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const x = cx + dx, y = cy + dy;
      if (x === this.player.x && y === this.player.y) continue;
      const e = enemyAt(this.floor, x, y);
      if (e) caught.push(e);
    }
    // Every cleaved blow is a glancing one: one guard chip, never the two a
    // two-hander's full swing is worth, and never the bash that opens a shield.
    for (const e of caught) this.hitEnemy(e, true, 1, mult);
    return caught.length > 0;
  }

  /**
   * What the bearer's shield does about this blow. Frontal only, and only
   * while the guard is up in some form: committed to a swing, reeling from
   * your parry, running, or guard down, and the shield might as well be
   * firewood. A blow into the *raise* is the parry the bearer lands on you;
   * a blow into the hold just chips.
   */
  /**
   * This creature as it is right now. Identical to its stat block for
   * everything in the game except the King, who answers from his phase — so the
   * guard rhythm, the sprite picker, the wind-up and the volley all keep
   * reading the fields they always read.
   */
  private view(e: EnemyState): EnemyDef {
    return enemyView(enemyDef(e.def), e.hp, e.maxHp, { elite: e.elite, carrying: !!e.stolen?.length });
  }

  private guardReaction(e: EnemyState, def: EnemyDef): 'bash' | 'chip' | null {
    if (!def.shield) return null;
    if ((e.vuln ?? 0) > 0) return null;
    if (e.ai === 'windup' || e.ai === 'recover' || e.ai === 'flee') return null;
    if ((e.guard ?? 'down') === 'down') return null;
    const d = dirOf(Math.sign(this.player.x - e.x), Math.sign(this.player.y - e.y));
    if (d === null || d !== e.facing) return null;
    return e.guard === 'raising' ? 'bash' : 'chip';
  }

  /**
   * The guard rhythm runs on its own while you are close: raise, hold, drop.
   * The sprite is the whole telegraph — shield sweeping center means back
   * off, held means circle, dropped means strike.
   */
  private updateGuard(e: EnemyState, def: EnemyDef, dt: number, threat: boolean): void {
    if (!def.shield) return;
    if (e.ai === 'windup' || e.ai === 'recover' || e.ai === 'flee' || e.ai === 'dead') return;
    if (!threat) {
      e.guard = 'down';
      e.blocks = 0;
      e.guardT = Math.max(e.guardT ?? 0, 0.5);
      return;
    }
    const left = (e.guardT ?? 0) - dt;
    switch (e.guard ?? 'down') {
      case 'down':
        if (left <= 0) {
          e.guard = 'raising';
          e.guardT = GUARD_RAISE;
          const d = dirOf(Math.sign(this.player.x - e.x), Math.sign(this.player.y - e.y));
          if (d !== null) e.facing = d;
        } else {
          e.guardT = left;
        }
        break;
      case 'raising':
        if (left <= 0) {
          e.guard = 'up';
          e.guardT = GUARD_UP;
        } else {
          e.guardT = left;
        }
        break;
      case 'up':
        if (left <= 0) {
          e.guard = 'down';
          e.guardT = GUARD_DOWN;
          e.blocks = 0;
        } else {
          e.guardT = left;
        }
        break;
    }
  }

  /**
   * A blow into the held guard: most of it absorbed, no stagger — the guard
   * holds. Lean on it three chips running and the arm sags, dropping the
   * guard wide open. Flank it, meet its swing, or time the drop instead.
   */
  private shieldChip(e: EnemyState, def: EnemyDef, chips = 1, power = this.anim.attackPower, player = this.derived): void {
    if (this.protectedByFog(e)) return;
    const sh = def.shield!;
    // Difficulty thins the armour on Normal; Hard multiplies by exactly 1.
    const hit = playerHitsEnemy(this.rng, player, power, def, defensePower(e.power) * this.diff.enemyDefense);
    const dmg = Math.max(0, Math.round(hit.damage * (1 - sh.block)));
    e.hp -= dmg;
    e.blocks = (e.blocks ?? 0) + chips;
    e.blockT = BLOCK_EXPIRY;
    e.hurtT = 0.3;
    e.alert = 8;
    e.lastSeenX = this.player.x;
    e.lastSeenY = this.player.y;
    const life = this.state.lifetime;
    if (dmg > (life.bestHit ?? 0)) life.bestHit = dmg;
    recordDamageDealt(this.state.bestiary, def.id, dmg);
    this.emit({ type: 'float', x: e.x, y: e.y, text: `${dmg}`, color: '#9a9aa8' });
    this.sfx('block', e.x, e.y);
    if (player.stats.leech > 0 && dmg > 0) {
      const heal = Math.max(1, Math.round((dmg * player.stats.leech) / 100));
      this.player.hp = Math.min(this.derived.maxHp, this.player.hp + heal);
    }
    if (e.hp <= 0) {
      this.killEnemy(e);
      return;
    }
    if ((e.blocks ?? 0) >= GUARD_BREAK_AT) {
      e.blocks = 0;
      e.guard = 'down';
      e.guardT = GUARD_DOWN;
      this.sfx('break', e.x, e.y);
      this.msg(`The ${def.name}'s guard sags!`, '#ffe8a0');
    }
  }

  private shieldBash(e: EnemyState, def: EnemyDef): void {
    const a = this.anim;
    a.attack = 'idle';
    a.attackThrow = false;
    a.attackT = 0;
    a.blockRaise = 0;
    a.blockT = Infinity;
    a.parryArmed = false;
    a.stunT = def.shield!.stun;
    e.alert = 8;
    e.blocks = 0;
    e.guard = 'down';
    e.guardT = GUARD_DOWN;
    e.lastSeenX = this.player.x;
    e.lastSeenY = this.player.y;
    this.emit({ type: 'shake', amount: 0.6 });
    this.sfx('block', e.x, e.y);
    this.msg(`The ${def.name} turns your blow aside and bashes you!`, '#ff9070');
    // The sure hit: it starts its swing now, while you can't move or guard.
    this.beginWindup(e, def, this.player.x, this.player.y);
  }

  private hitEnemy(e: EnemyState, neverBash = false, chips = this.derived.swing.chips ?? 1, powerMult = 1): void {
    if (this.protectedByFog(e)) return;
    const def = this.view(e);
    if ((e.eating ?? 0) > 0) e.eating = undefined;
    const reaction = this.guardReaction(e, def);
    if (reaction === 'bash' && !neverBash) {
      this.shieldBash(e, def);
      return;
    }
    if (reaction === 'chip' || (reaction === 'bash' && neverBash)) {
      this.shieldChip(e, def, chips, this.anim.attackPower * powerMult);
      return;
    }
    e.blocks = 0;
    const hit = playerHitsEnemy(this.rng, this.derived, this.anim.attackPower * powerMult, def, defensePower(e.power) * this.diff.enemyDefense);
    // Everything you land while the parry opening lasts hits twice as hard.
    const exposed = !!e.vuln && e.vuln > 0;
    if (exposed) hit.damage = Math.round(hit.damage * PARRY_VULN_MULT);
    // Banked parries ride on the next blows and only the next blows.
    const fed = this.anim.parryStacks * this.derived.traits.parryFeed;
    if (fed > 0) hit.damage = Math.round(hit.damage * (1 + fed));
    // A Marrow Draught rides on the first blow that lands, and only that one.
    const marrow = this.anim.draught?.kind === 'marrow' ? draught(this.state.flask?.infusion)?.marrowMult ?? 1 : 1;
    if (marrow > 1) {
      hit.damage = Math.round(hit.damage * marrow);
      this.anim.draught = null;
      if (def.behavior !== 'boss') {
        e.ai = 'recover';
        e.timer = Math.max(e.timer, 0.8);
        e.attackCd = Math.max(e.attackCd, 1);
      }
      this.emit({ type: 'shake', amount: 0.4 });
    }
    e.hp -= hit.damage;
    const life = this.state.lifetime;
    if (hit.damage > (life.bestHit ?? 0)) life.bestHit = hit.damage;
    recordDamageDealt(this.state.bestiary, def.id, hit.damage);
    e.hurtT = 0.3;
    e.alert = 8;
    e.lastSeenX = this.player.x;
    e.lastSeenY = this.player.y;
    const color = exposed ? '#ffe8a0' : hit.crit ? '#ffe040' : hit.effective === 'weak' ? '#ff9a40' : hit.effective === 'resist' ? '#9a9aa8' : '#ffffff';
    this.emit({ type: 'float', x: e.x, y: e.y, text: hit.crit || exposed ? `${hit.damage}!` : `${hit.damage}`, color });
    this.sfx(hit.crit ? 'crit' : 'hit', e.x, e.y);
    if (hit.effective === 'resist' && this.rng.chance(0.3)) this.msg(`The ${def.name} shrugs off your ${this.derived.damageType} blows.`, '#9a9aa8');
    if (hit.effective === 'weak' && this.rng.chance(0.3)) this.msg(`The ${def.name} reels!`, '#ff9a40');
    if (this.derived.stats.leech > 0) {
      this.heal(Math.max(1, Math.round((hit.damage * this.derived.stats.leech) / 100)));
    }
    // Lighter foes are staggered out of their wind-up.
    if (this.derived.swing.stagger) e.attackCd += this.derived.swing.stagger;
    if (!this.derived.swing.stagger && e.ai === 'windup' && def.hp < STAGGER_HP && def.behavior !== 'boss') {
      e.ai = 'recover';
      e.timer = 0.5;
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: EnemyState): void {
    // Deliberately the stat block and not the phase view: what dies here has to
    // be the creature itself, because its id is what the codex, the field notes
    // and the one guaranteed relic in the game are all keyed off.
    const def = enemyDef(e.def);
    e.hp = 0;
    e.ai = 'dead';
    e.deadT = 0;
    this.sfx('enemyDie', e.x, e.y);
    // A Vengeful elite's fuse lights as it falls; `updateEnemies` sets it off.
    if (e.elite === 'vengeful') {
      e.burstT = VENGEFUL_FUSE;
      this.msg('The corpse swells with violet light. Get clear!', '#c070ff');
    }
    // Something the King stood back up pays out once, not twice. It already
    // gave you its hoard, its tally and its contract credit the first time it
    // fell; without this the throne room would be the best place in the game to
    // farm a Hollow Knight's moonsilver.
    if (e.risen) {
      this.msg(`${def.name} falls still again.`, '#c8c0b0');
      return;
    }
    this.refundSigil(def);
    this.run.stats.kills++;
    recordKill(this.state.contracts, def.id);
    recordBestiaryKill(this.state.bestiary, def.id);
    const idBelow = metaLevel(this.state.meta, 'appraiser') >= 2 ? Rarity.Epic : undefined;
    const loot = e.mimicTier && e.mimicPropId
      ? rollContainerLoot(createRng(hashString(`${this.floor.seed}:${e.mimicPropId}`)), this.run.depth, this.derived.find, e.mimicTier, idBelow, this.state.recipeRanks, this.seenUniques, this.difficultyId)
      : rollEnemyLoot(this.rng, def, this.run.depth, this.derived.find, idBelow, this.state.recipeRanks, this.state.bestiary, this.seenUniques, this.difficultyId, !!e.elite);
    const sigilDrop = def.behavior === 'boss'
      ? this.rollSigil(`boss:${e.id}`, 1)
      : e.mimicTier && e.mimicPropId
        ? this.rollSigil(`chest:${e.mimicPropId}`, e.mimicTier === 'vault' || e.mimicTier === 'secret' ? 0.22 : 0.03 * Math.max(0, Math.min(1, (this.run.depth - 1) / 4)))
        : null;
    if (sigilDrop) loot.items.push(sigilDrop);
    if (def.behavior === 'boss') {
      // The portal opens where the king fell, so his hoard goes beside it —
      // dropped on the same tile it would be unreachable behind the portal.
      const spot = this.freeTileNear(e.x, e.y, true);
      this.dropLoot(spot.x, spot.y, loot.items, loot.gold);
      this.run.stats.bossKilled = true;
      if ((this.state.flask?.shards ?? 0) < 3) {
        const shard = this.floor.pickups.find((p) => p.x === spot.x && p.y === spot.y) ?? { id: 'shard_king', x: spot.x, y: spot.y, items: [], gold: 0 };
        shard.flaskShard = true;
        if (!this.floor.pickups.includes(shard)) this.floor.pickups.push(shard);
      }
      this.msg('The Ashen King crumbles to cinders. A portal tears open.', '#c080ff');
      this.unsealBossDoors();
      this.floor.props.push({ id: `portal${this.time}`, kind: 'portal', x: e.x, y: e.y, used: false, tier: 'none', blocking: false, mimic: false });
    } else {
      if (def.morsel) {
        const foodRng = createRng(hashString(`morsel:${this.floor.seed}:${e.id}`));
        if (foodRng.chance(morselChance(this.run.depth))) {
          (this.floor.morsels ??= []).push({
            id: `morsel_${e.id}`, kind: def.morsel, x: e.x, y: e.y,
            remaining: MORSEL_HEAL[def.morsel], droppedAt: this.run.stats.time,
          });
        }
      }
      this.dropLoot(e.x, e.y, loot.items, loot.gold);
      this.msg(`${this.view(e).name} slain.`, e.elite ? '#e8d8a0' : '#c8c0b0');
      if (e.stolen?.length) {
        this.dropLoot(e.x, e.y, e.stolen, 0);
        this.msg(`It drops your ${e.stolen.map(itemName).join(', ')}.`, '#e8c060');
        delete e.stolen;
        delete e.stolenT;
      }
    }
    this.trialKill(e.id);
  }

  /**
   * A walkable tile at or next to (x, y). `avoidCentre` skips the tile itself,
   * for when something is about to be put there that would cover a loot pile.
   */
  private freeTileNear(x: number, y: number, avoidCentre = false): { x: number; y: number } {
    const f = this.floor;
    const ok = (tx: number, ty: number) =>
      !blocksMove(f, tx, ty) && !f.props.some((p) => (p.kind === 'portal' || p.kind === 'town_portal') && p.x === tx && p.y === ty);
    if (!avoidCentre && ok(x, y)) return { x, y };
    for (const d of DIRS) {
      const tx = x + DX[d], ty = y + DY[d];
      if (ok(tx, ty)) return { x: tx, y: ty };
    }
    return { x, y };
  }

  /** Bespoke legendaries this playthrough has turned up, oldest first. */
  private get seenUniques(): string[] {
    return (this.state.lifetime.uniquesSeen ??= []);
  }

  /** Relics this playthrough has identified, which is what opens a codex entry. */
  private get knownUniques(): string[] {
    return (this.state.lifetime.uniquesKnown ??= []);
  }

  private refundSigil(def: EnemyDef): void {
    const active = this.run.sigil;
    if (!active || active.cd <= 0) return;
    const spell = sigil(active.id);
    const base = 2 + 8 * Math.min(1, def.hp / 140);
    const multiplier = 1 + 0.25 * metaLevel(this.state.meta, 'attunement') + this.derived.stats.focus / 100;
    active.cd = Math.max(0, active.cd - Math.min(base * multiplier, spell.cooldown * 0.2));
  }

  private rollSigil(stream: string, chance: number): Item | null {
    const carried = [
      ...this.state.stash.items,
      ...this.state.loadout.items,
      ...this.run.backpack.items,
      ...this.run.floors.flatMap((f) => f?.pickups.flatMap((p) => p.items) ?? []),
    ].filter((i) => i.kind === 'sigil').map((i) => i.ref);
    const unknown = unknownSigils(this.state.spells ?? [], carried);
    if (!unknown.length) return null;
    const rng = createRng(hashString(`sigil:${this.run.seed}:${this.run.depth}:${stream}`));
    return rng.chance(chance) ? makeSigil(rng.pick(unknown)) : null;
  }

  /**
   * Note a relic that has just come into your hands. Recorded on pickup rather
   * than on drop: leaving it on the floor or dying on the way out means you
   * never held it, and the King's promise reads this list.
   *
   * Naming it is a second step that waits for identification, so the codex
   * never tells you what the unappraised lump in your pack is.
   */
  private recordUnique(item: Item): void {
    const u = uniqueOf(item);
    if (!u) return;
    const seen = this.seenUniques;
    if (!seen.includes(u.id)) seen.push(u.id);
    if (!isIdentified(item)) return;
    if (nameRelic(this.knownUniques, u.id)) {
      this.msg(`${u.name}. The codex has a page for it now.`, '#e8b84a');
    }
  }

  private dropLoot(x: number, y: number, items: Item[], gold: number): Pickup | null {
    if (!items.length && gold <= 0) return null;
    const f = this.floor;
    let pk = f.pickups.find((p) => p.x === x && p.y === y);
    if (!pk) {
      pk = { id: `d${Math.floor(this.time * 1000)}_${x}_${y}`, x, y, items: [], gold: 0 };
      f.pickups.push(pk);
    }
    pk.items.push(...items);
    pk.gold += gold;
    // Standing on it already? Grab the coin.
    if (x === this.player.x && y === this.player.y) this.collectLoose(pk);
    return pk;
  }

  private propRng(p: Prop): Rng {
    return createRng(hashString(`${this.floor.seed}:${p.id}`));
  }

  /**
   * What a chest holds, less whatever blows have already broken inside it.
   * Each recorded blow takes one thing, worst first: a fragile piece (gem,
   * valuable, consumable, blueprint), then a unit of material, then a dent in
   * the gear, and once nothing else is left, a quarter of the coin.
   */
  private chestLoot(p: Prop, tier: ContainerTier): { items: Item[]; gold: number; lost: string[] } {
    const idBelow = metaLevel(this.state.meta, 'appraiser') >= 2 ? Rarity.Epic : undefined;
    const loot = rollContainerLoot(this.propRng(p), this.run.depth, this.derived.find, tier, idBelow, this.state.recipeRanks, this.seenUniques, this.difficultyId);
    // Its own stream, so which piece broke never moves the loot roll itself.
    const pick = createRng(hashString(`chest-shatter:${this.floor.seed}:${p.id}`));
    const lost: string[] = [];
    const takeOne = (it: Item) => {
      lost.push(itemName(it));
      it.qty -= 1;
      if (it.qty <= 0) loot.items.splice(loot.items.indexOf(it), 1);
    };
    for (let n = p.shattered ?? 0; n > 0; n--) {
      const fragile = loot.items.filter(fragileLoot);
      if (fragile.length) { takeOne(pick.pick(fragile)); continue; }
      const mats = loot.items.filter((it) => it.kind === 'material');
      if (mats.length) { takeOne(pick.pick(mats)); continue; }
      const gear = loot.items.filter((it) => it.kind === 'equipment' && durability(it).wears && durability(it).cur > 0);
      if (gear.length) {
        const it = pick.pick(gear);
        const d = durability(it);
        it.dur = Math.max(0, d.cur - Math.ceil(d.max * CHEST_DENT));
        lost.push(`dent:${itemName(it)}`);
        continue;
      }
      if (loot.gold > 0) {
        const spilt = Math.max(1, Math.round(loot.gold * CHEST_SPILL));
        loot.gold -= spilt;
        lost.push(`${spilt} gold`);
      }
    }
    return { ...loot, lost };
  }

  /** Record what one blow on an honest chest breaks inside it: always one thing, sometimes two. */
  private shatterInChest(p: Prop): void {
    const heavy = this.derived.twoHanded || this.derived.damageType === 'blunt';
    const struck = createRng(hashString(`chest-strike:${this.floor.seed}:${p.id}:${this.chestBlows++}`));
    p.shattered = (p.shattered ?? 0) + (heavy && struck.chance(CHEST_SHATTER_HEAVY_EXTRA) ? 2 : 1);
  }

  /** Iron on iron carries: anything near enough comes to see what it was. */
  private chestClang(p: Prop): void {
    let woken = 0;
    for (const e of this.floor.enemies) {
      if (e.ai === 'dead' || this.protectedByFog(e)) continue;
      if (Math.abs(e.x - p.x) + Math.abs(e.y - p.y) > CHEST_CLANG_RADIUS) continue;
      if (e.alert <= 0) woken++;
      e.alert = Math.max(e.alert, 6);
      e.lastSeenX = this.player.x;
      e.lastSeenY = this.player.y;
    }
    if (woken) this.msg('The clang echoes down the halls. Something heard it.', '#ff9070');
  }

  /** Swap a disguised chest for the mimic inside it, holding the chest's reward. */
  private wakeMimic(p: Prop, rise: number): EnemyState {
    const f = this.floor;
    f.props = f.props.filter((q) => q !== p);
    const mimic = createEnemy(enemyDef('mimic'), p.x, p.y, turnAround(this.player.facing), `mimic:${p.id}`, this.run.depth, this.difficultyId);
    mimic.ai = 'recover';
    mimic.timer = rise;
    mimic.alert = 6;
    mimic.lastSeenX = this.player.x;
    mimic.lastSeenY = this.player.y;
    mimic.mimicTier = p.tier === 'none' ? 'chest' : p.tier;
    mimic.mimicPropId = p.id;
    f.enemies.push(mimic);
    return mimic;
  }

  /** The held bite of a mimic you opened: nothing refuses it but armour. */
  private mimicBite(e: EnemyState): void {
    const def = this.view(e);
    this.sfx('swing', e.x, e.y);
    e.strikeT = 0;
    this.damagePlayer(
      Math.max(1, Math.round(def.attack * MIMIC_BITE * attackPower(e.power) * this.diff.enemyDamage)),
      def.damageType, e.x, e.y, def.name, def.id, e, true,
    );
    if (this.run.outcome === 'active') this.msg('It chews, then spits you out. Get up!', '#ff9070');
  }

  /** In a mimic's jaws: every other action waits for the bite. */
  private get grabbed(): boolean {
    return this.floor.enemies.some((e) => (e.grabT ?? 0) > 0 && e.ai !== 'dead');
  }

  private breakProp(p: Prop): void {
    p.used = true;
    this.sfx('break', p.x, p.y);
    const idBelow = metaLevel(this.state.meta, 'appraiser') >= 2 ? Rarity.Epic : undefined;
    const loot = rollContainerLoot(this.propRng(p), this.run.depth, this.derived.find, 'urn', idBelow, this.state.recipeRanks, this.seenUniques, this.difficultyId);
    this.dropLoot(p.x, p.y, loot.items, loot.gold);
  }

  /** What [F] would do right now, for the prompt. */
  interactionHint(): string | null {
    if (this.busy) return null;
    const f = this.floor;
    const t = this.frontTile();
    const door = doorAt(f, t.x, t.y);
    if (door) {
      if (isBossDoor(f, door) && door.locked && this.bossAlive()) return 'Sealed by fog';
      if (isBossDoor(f, door) && !door.open && !door.locked) return 'Part the fog';
      if (door.open) return enemyAt(f, t.x, t.y) ? null : 'Close door';
      if (door.locked) return this.run.keys.includes(door.keyId!) ? 'Unlock door' : 'Locked';
      return 'Open door';
    }
    if (secretAt(f, t.x, t.y)) return 'Push the marked wall';
    const trap = trapAt(f, t.x, t.y);
    if (trap && trap.armed && trap.found) return `Disarm ${TRAPS[trap.kind].name.toLowerCase()}`;
    const p = propAt(f, t.x, t.y);
    if (p && !p.used) {
      if (p.kind === 'chest') return 'Open chest';
      if (p.kind === 'shrine') {
        // A stone that has already taken coin names its rising price and how
        // many offerings it has left, so the second and third are decisions.
        if ((p.shrine ?? 'font') === 'coffer' && (p.offerings ?? 0) > 0) {
          const made = p.offerings ?? 0;
          return `${SHRINE_PROMPT.coffer(this.offeringCost(made))} (${COFFER_MAX_OFFERINGS - made} of ${COFFER_MAX_OFFERINGS} left)`;
        }
        return SHRINE_PROMPT[p.shrine ?? 'font'](this.offeringCost(p.offerings ?? 0));
      }
      if (p.kind === 'urn' || p.kind === 'barrel' || p.kind === 'root_cache') return `Smash ${p.kind === 'root_cache' ? 'root cache' : p.kind}`;
    }
    // A pile sharing the portal's tile wins the prompt, so loot that ended up
    // under a portal (as boss drops used to) can still be picked up.
    const portal = this.portalHere();
    if (portal) return this.pickupNear() ? 'Search' : 'Step through the portal';
    if (this.townPortalHere()) return this.pickupNear() ? 'Search' : 'Step through to Bleakmere';
    const s = stairsAt(f, t.x, t.y);
    if (s) return s.down ? `Descend to depth ${this.run.depth + 1}` : this.run.depth === 1 ? 'Leave the dungeon' : `Climb to depth ${this.run.depth - 1}`;
    if (this.pickupNear()) return 'Search';
    const morsel = this.morselNear();
    if (morsel) return `Eat the ${morsel.kind}${this.player.hp >= this.derived.maxHp ? ' (you are not hurt)' : ''}`;
    return null;
  }

  /**
   * One-button play (touch): swing at enemies, breakables and empty air;
   * otherwise do whatever [F] would (loot, open, pray, push, take the stairs).
   */
  contextAction(): { kind: 'attack' | 'interact'; label: string } {
    const f = this.floor;
    for (let d = 1; d <= this.derived.swing.reach; d++) {
      const t = this.frontTile(d);
      if (enemyAt(f, t.x, t.y)) return { kind: 'attack', label: '' };
      if (d === 1 && crackAt(f, t.x, t.y)) return { kind: 'attack', label: '' };
      // Something you can see hiding right in front of you is a target too.
      const hidden = d === 1 ? lurkerAt(f, t.x, t.y) : undefined;
      if (hidden && (hidden.lurk === 'buried' || hidden.spotted)) return { kind: 'attack', label: '' };
      if (blocksSight(f, t.x, t.y)) break;
    }
    const hint = this.interactionHint();
    if (!hint || hint.startsWith('Smash') || hint === 'Close door') return { kind: 'attack', label: '' };
    // A pile underfoot must never steal the swing: killing the first of two
    // monsters drops loot on your tile, and on touch that turned every tap
    // into the loot window instead of a hit on the second one. Doors, stairs
    // and portals still win, since running is a legitimate answer to a fight.
    if ((hint === 'Search' || hint.startsWith('Eat the ')) && this.threatNear()) return { kind: 'attack', label: '' };
    return { kind: 'interact', label: shortLabel(hint) };
  }

  /** Something alive and interested, close enough that you are still in a fight. */
  private threatNear(): boolean {
    const p = this.player;
    for (const e of this.floor.enemies) {
      // A lurker is not in the fight until it drops: counting it would give it away.
      if (e.ai === 'dead' || e.lurk) continue;
      const dist = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
      if (dist <= 2) return true;
      if (dist <= 4 && e.alert > 0 && this.los(p.x, p.y, e.x, e.y)) return true;
    }
    return false;
  }

  /**
   * Tear open a town portal on a free tile next to you (or under you if there
   * is nowhere else). Only one is ever open: reading a second scroll moves it.
   */
  private openTownPortal(): void {
    // In front of you where there is room, so you can see what you opened.
    const front = this.frontTile();
    const clear = (t: { x: number; y: number }) => !blocksMove(this.floor, t.x, t.y) && !propAt(this.floor, t.x, t.y);
    const spot = clear(front) ? front : this.freeTileNear(this.player.x, this.player.y, true);
    this.closeTownPortal();
    this.floor.props.push({
      id: `town_portal_${Math.round(this.time * 1000)}`,
      kind: 'town_portal',
      x: spot.x,
      y: spot.y,
      used: false,
      tier: 'none',
      blocking: false,
      mimic: false,
    });
    this.run.portal = { depth: this.run.depth, x: spot.x, y: spot.y };
    this.sfx('recall');
    this.msg('A portal tears open. It holds until you step back through.', '#9ac0ff');
    this.emit({ type: 'shake', amount: 0.25 });
  }

  /** Collapse the open portal wherever it is. Safe to call with none open. */
  closeTownPortal(): void {
    const open = this.run.portal;
    if (!open) return;
    const floor = this.run.floors[open.depth - 1];
    if (floor) floor.props = floor.props.filter((p) => p.kind !== 'town_portal');
    this.run.portal = null;
  }

  /** The town portal, if you are standing on it or facing it. */
  private townPortalHere(): Prop | undefined {
    const f = this.floor;
    const t = this.frontTile();
    return f.props.find(
      (q) => q.kind === 'town_portal' && ((q.x === t.x && q.y === t.y) || (q.x === this.player.x && q.y === this.player.y)),
    );
  }

  /** The boss's exit portal, if you are standing on it or facing it. */
  private portalHere(): Prop | undefined {
    const f = this.floor;
    const t = this.frontTile();
    return f.props.find(
      (q) => q.kind === 'portal' && ((q.x === t.x && q.y === t.y) || (q.x === this.player.x && q.y === this.player.y)),
    );
  }

  pickupNear(): Pickup | undefined {
    const f = this.floor;
    const t = this.frontTile();
    return (
      f.pickups.find((p) => p.x === this.player.x && p.y === this.player.y && (p.items.length || p.flaskShard)) ??
      f.pickups.find((p) => p.x === t.x && p.y === t.y && (p.items.length || p.flaskShard) && !blocksSight(f, t.x, t.y))
    );
  }

  morselNear() {
    const t = this.frontTile();
    return (this.floor.morsels ?? []).find((m) =>
      (m.x === this.player.x && m.y === this.player.y) || (m.x === t.x && m.y === t.y && !blocksSight(this.floor, t.x, t.y)),
    );
  }

  interact(): void {
    if (this.busy || this.moving || this.grabbed) return;
    const f = this.floor;
    const t = this.frontTile();

    const door = doorAt(f, t.x, t.y);
    if (door) {
      if (isBossDoor(f, door) && door.locked && this.bossAlive()) {
        this.msg('Sealed by fog. The King must fall.', '#c0a0ff');
        this.sfx('locked', t.x, t.y);
        return;
      }
      if (door.open) {
        if (enemyAt(f, t.x, t.y)) return;
        door.open = false;
        this.sfx('door', t.x, t.y);
        return;
      }
      if (door.locked) {
        const key = f.keys.find((k) => k.id === door.keyId);
        if (!this.run.keys.includes(door.keyId!)) {
          this.msg(`Locked. It needs the ${key?.name ?? 'right key'}.`, '#c8a060');
          this.sfx('locked', t.x, t.y);
          return;
        }
        this.run.keys = this.run.keys.filter((k) => k !== door.keyId);
        door.locked = false;
        this.msg(`The ${key?.name ?? 'key'} turns. The vault opens.`, '#ffe08a');
        this.sfx('unlock', t.x, t.y);
      }
      door.open = true;
      this.sfx('door', t.x, t.y);
      this.reveal();
      return;
    }

    const trap = trapAt(f, t.x, t.y);
    if (trap && trap.armed && trap.found) {
      this.disarm(trap);
      return;
    }

    const secret = secretAt(f, t.x, t.y);
    if (secret) {
      secret.found = true;
      f.tiles[t.y * f.width + t.x] = FLOOR;
      this.sfx('secret', t.x, t.y);
      this.msg('The marked stones grind aside. A hidden room!', '#e8d8a0');
      this.emit({ type: 'secret', x: t.x, y: t.y });
      this.reveal();
      return;
    }

    const p = propAt(f, t.x, t.y);
    if (p && !p.used) {
      if (p.kind === 'urn' || p.kind === 'barrel' || p.kind === 'root_cache') {
        this.breakProp(p);
        return;
      }
      if (p.kind === 'chest') {
        const tier = p.tier === 'none' ? 'chest' : p.tier;
        if (p.mimic) {
          // Its recovery is frozen while it chews, so this is the beat after the bite.
          const mimic = this.wakeMimic(p, 0.8);
          mimic.grabT = MIMIC_GRAB;
          const a = this.anim;
          a.stunT = Math.max(a.stunT, MIMIC_GRAB + MIMIC_SPAT);
          a.blockRaise = 0;
          this.held.clear();
          this.setBlock(false);
          this.sfx('alert', p.x, p.y);
          this.emit({ type: 'shake', amount: 0.8 });
          this.msg('The lid snaps shut on you — the chest grabs you and tries to eat you whole!', '#ff6a50');
          return;
        }
        p.used = true;
        this.sfx('chest', p.x, p.y);
        const loot = this.chestLoot(p, tier);
        if (loot.lost.length) this.msg(`Your blows cost you: ${summarizeLost(loot.lost)}.`, '#d0a070');
        const sigilDrop = this.rollSigil(
          `chest:${p.id}`,
          tier === 'vault' || tier === 'secret' ? 0.22 : 0.03 * Math.max(0, Math.min(1, (this.run.depth - 1) / 4)),
        );
        if (sigilDrop) loot.items.push(sigilDrop);
        let pk = this.dropLoot(p.x, p.y, loot.items, 0);
        if ((tier === 'vault' || tier === 'secret') && (this.state.flask?.shards ?? 0) < 3 && createRng(hashString(`flask-shard:${f.seed}:${p.id}`)).chance(0.04)) {
          pk ??= { id: `shard_${p.id}`, x: p.x, y: p.y, items: [], gold: 0 };
          pk.flaskShard = true;
          if (!f.pickups.includes(pk)) f.pickups.push(pk);
        }
        if (loot.gold) {
          this.run.gold += loot.gold;
          this.run.stats.goldFound += loot.gold;
          this.emit({ type: 'float', x: p.x, y: p.y, text: `+${loot.gold}g`, color: '#ffd24a' });
          this.sfx('gold');
        }
        if (pk) this.emit({ type: 'loot', pickupId: pk.id });
        else this.msg('The chest is empty.', '#888');
        return;
      }
      if (p.kind === 'shrine') {
        p.used = true;
        this.pray(p);
        return;
      }
    }

    const portal = this.portalHere();
    const town = this.townPortalHere();
    if (portal || town) {
      // No slipping out of the throne fight through a town portal: the fog
      // holds you until the King falls. His own exit portal only exists
      // after that, so it is never blocked.
      if (town && this.playerInThrone() && this.bossAlive()) {
        this.msg('The fog smothers the portal. No way out but through him.', '#c0a0ff');
        this.sfx('locked');
        return;
      }
      const loose = this.pickupNear();
      if (loose) {
        this.emit({ type: 'loot', pickupId: loose.id });
        return;
      }
      this.sfx('recall');
      // The boss's portal is the way out; a town portal keeps the run alive.
      if (portal) this.finish('extracted');
      else this.emit({ type: 'town' });
      return;
    }

    const s = stairsAt(f, t.x, t.y);
    if (s) {
      // Interacting with stairs is one step, not a held movement key.
      this.queued = 'forward';
      return;
    }

    // A corpse usually leaves loot and food on the same tile. The pile wins:
    // eating first cost a 1.2s chew (and, at full health, the food itself)
    // before you could search. The loot window offers the food as well, so a
    // pile you only half-empty never hides the morsel under it; once the pile
    // is gone, [F] eats. Food still loses to doors and stairs above.
    const pk = this.pickupNear();
    if (pk) {
      this.emit({ type: 'loot', pickupId: pk.id });
      return;
    }
    this.eatMorsel();
  }

  /**
   * Start chewing the morsel underfoot or faced. [F] is always deliberate, so
   * unlike the one-button tap it eats even with something hunting you; the
   * 1.2s chew and the dropped morsel on a hit are the price, not a refusal.
   */
  eatMorsel(): boolean {
    if (this.busy || this.moving || this.anim.attack !== 'idle' || this.anim.cast) return false;
    const morsel = this.morselNear();
    if (!morsel) return false;
    this.anim.chew = { id: morsel.id, left: CHEW_SECONDS, delivered: 0, total: Math.round(this.derived.maxHp * morsel.remaining) };
    this.held.clear();
    this.msg(`You eat the ${morsel.kind}.`, '#d8c098');
    return true;
  }

  /**
   * Disarming always works — the skill was noticing it, not fiddling with it.
   * The salvage is what makes clearing one worth the detour instead of just
   * stepping around it.
   */
  private disarm(trap: Trap): void {
    trap.armed = false;
    const def = TRAPS[trap.kind];
    this.sfx('craft', trap.x, trap.y);
    this.msg(def.disarmed, '#a8d8a0');
    const salvage = trap.kind === 'alarm' ? 0.25 : 0.6;
    if (this.rng.chance(salvage)) {
      const pool = trap.kind === 'dart' ? ['iron', 'timber'] : trap.kind === 'spikes' ? ['iron', 'copper'] : ['bone', 'linen'];
      const id = this.rng.pick(pool);
      this.dropLoot(trap.x, trap.y, [makeMaterial(id, 1)], 0);
    }
  }

  /** What an offering stone asks for at this depth. */
  offeringCost(offeringsMade = 0): number {
    // Every paid offering raises the next by 75%: the stone is a sink that
    // gets thirstier. D1 runs 55 → 96 → 168; D6 runs 180 → 315 → 551.
    return Math.round((30 + 25 * this.run.depth) * Math.pow(COFFER_PRICE_GROWTH, Math.max(0, offeringsMade)));
  }

  /**
   * What a shrine gives back. Not a full heal any more: a font that refills the
   * bar is a save point, and a save point on every other floor is the end of
   * attrition as a mechanic. It is a large, welcome, *partial* mend.
   */
  private restore(refillFlask = false): void {
    this.heal(Math.round(this.derived.maxHp * 0.6));
    this.player.stamina = this.derived.maxStamina;
    if (refillFlask) {
      const flask = this.run.flask;
      flask.charges = Math.min(flaskMax(this.state.flask?.shards ?? 0), flask.charges + 1);
    }
  }

  private grantBlessing(): boolean {
    if (this.run.blessing) return false;
    const id = this.rng.pick(Object.keys(BLESSINGS));
    const before = this.derived.maxHp;
    this.run.blessing = id;
    this.refreshDerived();
    // Vitality raises the ceiling: heal the gained amount on pickup, so the
    // blessing feels like a gift rather than a larger empty bar.
    if (id === 'vitality') this.player.hp = Math.min(this.derived.maxHp, this.player.hp + Math.max(0, this.derived.maxHp - before));
    this.msg(`Blessing of ${BLESSINGS[id].name}: ${BLESSINGS[id].text}`, '#a0c8ff');
    return true;
  }

  private pray(p: Prop): void {
    this.sfx('magic');
    switch (p.shrine ?? 'font') {
      // The safe one. A large mend and it washes off a curse — which is what
      // makes a font worth crossing a floor for once an idol has marked you.
      case 'font': {
        const lifted = this.run.curse;
        this.run.curse = null;
        this.refreshDerived();
        this.restore(true);
        if (lifted) this.msg(`The water runs black and clears. ${CURSES[lifted].name} is washed away.`, '#a0c8ff');
        else this.msg('Cold clean water. Most of the hurt goes out of you.', '#a0c8ff');
        return;
      }

      // The gamble. Thirteen times in twenty it gives; the rest of the time
      // it takes, and what it takes lasts the rest of the run. Slightly
      // kinder than before (was 60/40) to compensate stronger curses.
      case 'idol': {
        if (this.rng.chance(0.65)) {
          this.restore(true);
          if (!this.grantBlessing()) this.msg('The idol is satisfied. Much of the hurt leaves you.', '#a0c8ff');
          return;
        }
        const id = this.rng.pick(Object.keys(CURSES));
        this.run.curse = id;
        this.refreshDerived();
        this.msg(`The idol drinks something out of you. ${CURSES[id].name}: ${CURSES[id].text}`, '#c080ff');
        this.emit({ type: 'shake', amount: 0.4 });
        this.sfx('hurt');
        return;
      }

      // The thirsty one: up to three paid offerings, each 75% dearer than
      // the last, and one time in four the stone takes the coin and answers
      // with silence — no mend, no blessing. A fizzled offering still counts:
      // three payments is three payments.
      case 'coffer': {
        const made = p.offerings ?? 0;
        if (made >= COFFER_MAX_OFFERINGS) return;
        const cost = this.offeringCost(made);
        if (this.run.gold < cost) {
          // Not consumed — come back with the coin.
          p.used = false;
          this.msg(`The bowl is empty and stays empty. It wants ${cost} gold.`, '#c8a060');
          this.sfx('locked', p.x, p.y);
          return;
        }
        this.run.gold -= cost;
        p.offerings = made + 1;
        if (p.offerings >= COFFER_MAX_OFFERINGS) {
          // interact() already marked it used; staying used means quiet.
          this.msg('The stone drinks deep and goes dark. It will take no more.', '#c8a060');
        } else {
          // Keep it touchable for the next, dearer offering.
          p.used = false;
        }
        if (this.rng.chance(COFFER_FIZZLE)) {
          this.msg('The coin vanishes into the stone. Nothing answers.', '#8888a0');
          this.sfx('gold');
          return;
        }
        this.restore();
        if (!this.grantBlessing()) this.msg('The coin vanishes. Much of the hurt leaves you.', '#e8c060');
        this.sfx('gold');
        return;
      }

      // The red one. Half your current health, rounded down, for gold that
      // scales with depth and with what you paid. It cannot kill you: at 1 HP
      // it refuses. Single use — HP is a currency now, and the font
      // and the draughts are where you buy it back.
      case 'blood': {
        if (this.player.hp <= 1) {
          p.used = false;
          this.msg('You have nothing left to give.', '#c8a060');
          return;
        }
        const pay = Math.floor(this.player.hp / 2);
        const prize = 40 + 30 * this.run.depth + pay;
        this.player.hp -= pay;
        this.run.gold += prize;
        this.run.stats.goldFound += prize;
        this.emit({ type: 'float', x: p.x, y: p.y, text: `+${prize}g`, color: '#ffd24a' });
        this.msg(`Your blood runs into the brass bowl. +${prize} gold.`, '#ff8090');
        this.sfx('hurt');
        return;
      }

      // The trial. Free to invoke, paid in nerve: depth-appropriate enemies
      // rise around the shrine, already looking at you. They drop their
      // ordinary loot, and the last trial-marked kill pays the prize.
      // One trial at a time — a second challenge waits its turn.
      case 'combat': {
        if (this.run.trial && this.run.trial.ids.length > 0) {
          p.used = false;
          this.msg('The yard is already bloodied. Finish the trial first.', '#c8a060');
          return;
        }
        const ids = this.raiseTrial(p);
        if (!ids.length) {
          p.used = false;
          this.msg('The embers stir, then settle. No room to bleed here.', '#8888a0');
          return;
        }
        this.run.trial = { propId: p.id, ids };
        this.msg(`The ember shrine catches. ${ids.length} rise for the trial!`, '#ff9a50');
        this.emit({ type: 'shake', amount: 0.5 });
        this.sfx('alert');
        return;
      }
    }
  }

  /**
   * Raise a strife trial around a shrine: 2 + ceil(depth/2) enemies from the
   * same pool the floor itself draws on (never the boss), on free tiles near
   * the stone, already alerted. Returns the marked ids (empty when the room
   * is too cramped to bleed in).
   */
  private raiseTrial(p: Prop): string[] {
    const f = this.floor;
    const biome = biomeForFloor(f);
    const depth = this.run.depth;
    const pool = ENEMIES.filter((e) =>
      e.weight > 0 && e.behavior !== 'boss' && e.minDepth <= depth && depth <= e.maxDepth &&
      !(biome.element && e.element && e.element !== biome.element));
    if (!pool.length) return [];
    const want = 2 + Math.ceil(depth / 2);
    const ids: string[] = [];
    let n = 0;
    outer: for (let r = 1; r <= 4 && ids.length < want; r++) {
      for (let dy = -r; dy <= r && ids.length < want; dy++) {
        for (let dx = -r; dx <= r && ids.length < want; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = p.x + dx, y = p.y + dy;
          if (!inBounds(f, x, y) || blocksMove(f, x, y)) continue;
          if (x === this.player.x && y === this.player.y) continue;
          if (enemyAt(f, x, y)) continue;
          if (f.props.some((q) => q.blocking && q.x === x && q.y === y)) continue;
          const def = this.rng.weighted(pool.map((e) => [e, e.weight] as const));
          const id = `trial_${p.id}_${n++}`;
          const e = createEnemy(def, x, y, this.rng.pick(DIRS), id, depth, this.difficultyId);
          e.alert = 8;
          e.lastSeenX = this.player.x;
          e.lastSeenY = this.player.y;
          f.enemies.push(e);
          ids.push(id);
        }
      }
    }
    return ids;
  }

  /** A trial-marked kill: strike it from the roll, and pay the prize when the roll is empty. */
  private trialKill(id: string): void {
    const trial = this.run.trial;
    if (!trial) return;
    trial.ids = trial.ids.filter((t) => t !== id);
    if (trial.ids.length > 0) return;
    this.run.trial = null;
    const prize = 60 + 40 * this.run.depth;
    this.dropLoot(this.player.x, this.player.y, [], prize);
    this.emit({ type: 'float', x: this.player.x, y: this.player.y, text: `+${prize}g`, color: '#ffd24a' });
    this.msg('The trial is survived. The shrine pays its prize.', '#ffb050');
    this.sfx('gold');
  }

  /** Move items from a pickup into the backpack. Returns how many stacks moved. */
  take(pickupId: string, uid?: string): number {
    const pk = this.floor.pickups.find((p) => p.id === pickupId);
    if (!pk) return 0;
    let moved = 0;
    if (pk.flaskShard && (this.state.flask?.shards ?? 0) < 3) {
      this.state.flask.shards++;
      this.run.flask.charges = Math.min(flaskMax(this.state.flask.shards), this.run.flask.charges + 1);
      pk.flaskShard = false;
      if (this.state.flask.shards >= 3) {
        for (const fl of this.run.floors ?? []) for (const other of fl?.pickups ?? []) other.flaskShard = false;
        this.prunePickups();
      }
      moved++;
      this.msg('The Flask Shard dissolves into the vessel. Its capacity grows.', '#9fe0cf');
    }
    for (const it of [...pk.items]) {
      if (uid && it.uid !== uid) continue;
      // Field notes are read where they lie. They never reach the pack, so a
      // bad run can't cost you the page, and a full pack can't block it.
      if (it.kind === 'lore') {
        const fresh = unlockEntry(this.state.bestiary, it.ref);
        pk.items = pk.items.filter((i) => i !== it);
        this.msg(fresh ? `${loreName(it.ref)} — added to the codex.` : 'You already know these notes.', '#c8b8ff');
        this.sfx('study');
        moved++;
        continue;
      }
      const before = it.qty;
      const left = addItem(this.run.backpack, it);
      if (left < before) {
        moved++;
        this.recordUnique(it);
      }
      if (left === 0) pk.items = pk.items.filter((i) => i !== it);
      else it.qty = left;
    }
    if (moved) {
      this.run.stats.itemsFound += moved;
      this.sfx('pickup');
    } else if (pk.items.length) {
      this.msg('Your pack is full.', '#ff9070');
    }
    this.prunePickups();
    return moved;
  }

  canTake(item: Item): boolean {
    return canFit(this.run.backpack, item) || roomFor(this.run.backpack, item) > 0;
  }

  drop(uid: string, pickupId?: string): void {
    const it = removeItem(this.run.backpack, uid);
    if (!it) return;
    if (pickupId) {
      // Dropping while a loot pile is open puts it straight back on that
      // pile, so a full pack can be swapped one for one without closing the
      // panel. The pile may sit in front of you rather than underfoot.
      const pk = this.floor.pickups.find((p) => p.id === pickupId);
      if (pk) {
        pk.items.push(it);
        this.sfx('ui');
        return;
      }
    }
    this.dropLoot(this.player.x, this.player.y, [it], 0);
    this.sfx('ui');
  }

  /** Equipment in the pack still waiting to be identified. */
  unidentifiedItems(): Item[] {
    return this.run.backpack.items.filter((i) => i.kind === 'equipment' && i.identified === false);
  }

  use(uid: string, targetUid?: string): void {
    if (this.run.outcome !== 'active') return;
    const it = findItem(this.run.backpack, uid);
    if (!it) return;
    if (it.kind === 'blueprint') {
      this.msg('Study it back in town at the forge.', '#9ab0d8');
      return;
    }
    if (it.kind !== 'consumable') return;
    const def = consumable(it.ref);
    const e = def.effect;
    switch (e.type) {
      case 'heal':
        if (this.player.hp >= this.derived.maxHp) {
          this.msg('You are already at full health.', '#888');
          return;
        }
        this.heal(Math.round(this.derived.maxHp * e.fraction));
        this.sfx('drink');
        break;
      case 'stamina':
        this.player.stamina = this.derived.maxStamina;
        this.sfx('drink');
        break;
      case 'tonic': {
        const tonic = TONICS[e.tonicId];
        if (!tonic) return;
        // Fight Milk stopped being drunk when the flask took over healing. The
        // bottle is a forge infusion now; drinking it would bypass the potency
        // trade the infusion charges for. Legacy delves that already drank keep
        // their run.tonics effect until that run ends.
        if (e.tonicId === 'fight_milk') {
          this.msg('Too precious to drink raw. The forge can infuse the flask with it.', '#e8b84a');
          return;
        }
        const tonics = (this.run.tonics ??= []);
        // Two of the same draught is two of the same draught. It is already in
        // you; drinking another would only cost you the bottle.
        if (tonics.includes(e.tonicId)) {
          this.msg(`You already reek of ${tonic.name}.`, '#888');
          return;
        }
        tonics.push(e.tonicId);
        this.refreshDerived();
        this.sfx('drink');
        this.msg(`${tonic.name}, for the rest of the delve. ${tonic.text}`, '#e8b84a');
        break;
      }
      case 'identify': {
        const unids = this.unidentifiedItems();
        if (!unids.length) {
          this.msg('Nothing in your pack needs identifying.', '#888');
          return;
        }
        // A caller may name which item the scroll is read over; without a
        // choice the UI asks, and headless callers (quick-slots, tests) fall
        // back to the first. The scroll is only spent when something is
        // actually identified.
        let target = targetUid ? unids.find((i) => i.uid === targetUid) : undefined;
        if (targetUid && !target) {
          this.msg('That doesn\'t need identifying.', '#888');
          return;
        }
        target ??= unids[0];
        identify(target!);
        this.recordUnique(target!);
        this.msg(`It is: ${itemName(target!)}.`, '#c8b8ff');
        this.sfx('magic');
        break;
      }
      case 'recall':
        if (this.anim.recall !== null) return;
        if (this.playerInThrone() && this.bossAlive()) {
          this.msg('The fog smothers the scroll. No way out but through him.', '#c0a0ff');
          this.sfx('locked');
          return;
        }
        this.anim.recall = e.seconds;
        this.msg(
          this.run.portal ? 'You read the scroll. The old portal will collapse...' : 'You read the scroll. Stand still...',
          '#9ac0ff',
        );
        this.sfx('magic');
        break;
      case 'flash': {
        // Blinding true light, and it burns whether it lands or not. Whiff it
        // into empty air and you have one fewer scroll — that is the lesson.
        let target: EnemyState | undefined;
        for (let d = 1; d <= 3; d++) {
          const t = this.frontTile(d);
          const foe = enemyAt(this.floor, t.x, t.y);
          if (foe) {
            const toward = dirOf(Math.sign(this.player.x - foe.x), Math.sign(this.player.y - foe.y));
            if (foe.alert > 0 && toward === foe.facing) target = foe;
            break;
          }
          if (blocksSight(this.floor, t.x, t.y)) break;
        }
        this.anim.recall = null; this.anim.sip = null; this.anim.chew = null;
        // True light, seen: a white-hot wash over the whole view, stronger
        // than any sigil landing. Reuses the sigil flash path in the
        // renderer, so headless callers and saves see nothing new.
        this.emit({ type: 'sigil', r: 1.0, g: 0.97, b: 0.88, strength: 0.85 });
        if (!target) {
          this.msg('Light bursts over nothing. There is nothing looking at you.', '#888');
          this.sfx('magic', this.player.x, this.player.y);
          break;
        }
        if (target.def === BOSS_ID) {
          // No blind, no cancelled wind-up, no lost trail: a blind that ran
          // through the ordinary AI reset his wind-up and could drop his aggro.
          this.msg('The King does not blink.', '#c0a0ff');
          this.sfx('magic', target.x, target.y);
          break;
        }
        const save = target.ai === 'windup';
        target.blind = save ? 3 : 2;
        if (save) { target.ai = 'recover'; target.timer = target.blind; }
        target.guard = 'down'; target.guardT = target.blind;
        this.msg(save ? 'Caught it in the light!' : `${enemyDef(target.def).name} reels from the flash.`, '#fff2a0');
        this.sfx('magic', target.x, target.y);
        break;
      }
      case 'backstep': {
        const now = this.run.stats.time;
        const candidates = this.trail.filter((p) => now - p.time <= 2 && (p.x !== this.player.x || p.y !== this.player.y)).slice(-4);
        const dest = candidates.find((p) => !blocksMove(this.floor, p.x, p.y) && !enemyAt(this.floor, p.x, p.y));
        this.anim.recall = null; this.anim.sip = null; this.anim.chew = null;
        if (!dest) {
          this.msg('The scroll comes to nothing. You have been nowhere.', '#888');
          break;
        }
        this.player.x = dest.x; this.player.y = dest.y; this.player.facing = dest.facing;
        const yaw = dest.facing * Math.PI / 2;
        Object.assign(this.anim, { fromX: dest.x, fromY: dest.y, moveT: 1, yaw, yawFrom: yaw, yawTo: yaw, turnT: 1 });
        this.reveal();
        this.sfx('recall'); this.emit({ type: 'shake', amount: 0.22 });
        this.msg('The scroll snaps you back along your path.', '#9ac0ff');
        break;
      }
    }
    it.qty -= 1;
    if (it.qty <= 0) removeItem(this.run.backpack, uid);
  }

  /**
   * Distinct consumable refs in the pack, in the player's chosen quick-bar
   * order. Saved order wins for refs still carried; anything new appends in
   * backpack order, and anything gone is ignored — so the bar never points at
   * something you no longer have.
   */
  quickRefs(): string[] {
    const present: string[] = [];
    for (const it of this.run.backpack.items) {
      if (it.kind !== 'consumable' || present.includes(it.ref)) continue;
      // Fight Milk rides in the pack as an infusion ingredient, not a drink.
      // It is spent at the forge bench, so it never takes a quick-bar slot.
      if (it.ref === 'fight_milk') continue;
      present.push(it.ref);
    }
    const saved = this.run.quickOrder ?? [];
    const ordered = saved.filter((r) => present.includes(r));
    for (const r of present) if (!ordered.includes(r)) ordered.push(r);
    return ordered;
  }

  /** Move a quick-bar entry from one position to another (drag reorder). */
  moveQuick(from: number, to: number): void {
    const refs = this.quickRefs();
    if (from < 0 || from >= refs.length || to < 0 || to >= refs.length || from === to) return;
    const [moved] = refs.splice(from, 1);
    refs.splice(to, 0, moved);
    this.run.quickOrder = refs;
  }

  /** Quick-slot use: nth distinct consumable in the player's bar order. */
  quickUse(slot: number): void {
    const refs = this.quickRefs();
    const ref = refs[slot];
    if (!ref) return;
    const it = this.run.backpack.items.find((i) => i.kind === 'consumable' && i.ref === ref);
    if (it) this.use(it.uid);
  }

  // -------------------------------------------------------------------------
  // Enemies
  // -------------------------------------------------------------------------

  private occupied(x: number, y: number, self: EnemyState): boolean {
    if (x === this.player.x && y === this.player.y) return true;
    return this.floor.enemies.some((o) => o !== self && o.ai !== 'dead' && !o.lurk && o.x === x && o.y === y);
  }

  private canStep(e: EnemyState, x: number, y: number): boolean {
    return !blocksMove(this.floor, x, y) && !this.occupied(x, y, e) && !stairsAt(this.floor, x, y);
  }

  private stepEnemy(e: EnemyState, x: number, y: number): void {
    const d = dirOf(x - e.x, y - e.y);
    if (d !== null) e.facing = d;
    e.fromX = e.x;
    e.fromY = e.y;
    e.x = x;
    e.y = y;
    e.moveT = 0;
    // Monsters blunder into traps too, which is what makes retreating over one
    // you already found worth doing.
    const trap = trapAt(this.floor, x, y);
    if (trap && trap.armed) this.springTrap(trap, e);
  }

  /** BFS toward a target; returns the first step, cached briefly. */
  private pathStep(e: EnemyState, tx: number, ty: number): [number, number] | null {
    const key = e.id;
    const hit = this.pathCache.get(key);
    if (hit && this.time - hit.t < 0.35 && hit.next && this.canStep(e, hit.next[0], hit.next[1])) return hit.next;
    const f = this.floor;
    const W = f.width;
    const prev = new Map<number, number>();
    const start = e.y * W + e.x;
    const goal = ty * W + tx;
    const q = [start];
    prev.set(start, -1);
    let found = false;
    for (let h = 0; h < q.length && q.length < 1500; h++) {
      const i = q[h];
      if (i === goal) {
        found = true;
        break;
      }
      const x = i % W, y = (i / W) | 0;
      for (const d of DIRS) {
        const nx = x + DX[d], ny = y + DY[d];
        const n = ny * W + nx;
        if (prev.has(n)) continue;
        if (n !== goal && (blocksMove(f, nx, ny) || this.occupied(nx, ny, e))) continue;
        if (Math.abs(nx - e.x) + Math.abs(ny - e.y) > 18) continue;
        prev.set(n, i);
        q.push(n);
      }
    }
    let next: [number, number] | null = null;
    if (found) {
      let i = goal;
      while (prev.get(i) !== start && prev.get(i) !== -1 && prev.get(i) !== undefined) i = prev.get(i)!;
      if (i !== goal || prev.get(goal) === start) next = [i % W, (i / W) | 0];
      if (next && next[0] === tx && next[1] === ty) next = null;
    }
    this.pathCache.set(key, { t: this.time, next });
    return next;
  }

  /**
   * Has the King crossed into a new phase?
   *
   * Checked every tick rather than on the swing that did it, because enemy
   * health falls in five different places — a sprung trap, a chip off a guard,
   * a landed blow and two parry reflections — and a threshold crossed by any of
   * the other four would otherwise go unannounced. The phase he is *in* comes
   * from his health; `e.phase` only remembers how far the fight has been
   * announced, so each turn lands exactly once.
   */
  private checkBossPhase(e: EnemyState): void {
    if (e.ai === 'dead' || e.hp <= 0) return;
    const now = phaseForHp(e.hp / Math.max(1, e.maxHp));
    const announced = e.phase ?? 1;
    if (now <= announced) return;
    // Step through every phase that was crossed, not just the one he landed in.
    // A crit inside a parry window can take two thirds of the bar off in a
    // single blow, and jumping straight to the last phase would mean the room
    // never goes dark and the guard never gets up — the middle of the fight
    // would simply not happen on the runs that hit hardest.
    for (let p = announced + 1; p <= now; p++) this.enterBossPhase(e, p, p === now);
  }

  private enterBossPhase(e: EnemyState, phase: number, announce: boolean): void {
    e.phase = phase;
    const profile = kingPhase(phase);

    // He reels. The beat is the reward for breaking a phase: he cannot act while
    // the room changes around you, which is the same grace the mimic gets when
    // it unfolds and is what keeps a transition from being a free hit on the
    // player. Deliberately NOT a `vuln` window — that belongs to the parry, and
    // handing it out for nothing would cheapen the one thing the last phase is
    // built to teach.
    e.ai = 'recover';
    e.timer = BOSS_PHASE_BEAT;
    e.attackCd = BOSS_PHASE_BEAT + 0.2;
    e.hurtT = 0.3;
    e.guard = 'down';
    e.guardT = BOSS_PHASE_BEAT;
    e.blocks = 0;

    if (phase === 2) {
      // Losing the light and three unseen bolts in the same instant is the one
      // combination here that would be genuinely unfair, so the room holds its
      // breath: whatever he already had in the air goes out with the torches.
      this.projectiles = this.projectiles.filter((pr) => pr.sourceId !== e.def);
      this.snuffThrone();
      this.raiseTheGuard();
    }

    if (!announce) return;
    this.sfx('kingturn', e.x, e.y);
    this.emit({ type: 'shake', amount: 0.6 });
    if (profile.entry) this.msg(profile.entry, '#c080ff');
  }

  /** The tiles of the room the King is standing his last in. */
  private throneRoom(): Room | undefined {
    return this.floor.rooms.find((r) => r.role === 'throne');
  }

  private inRoom(r: Room, x: number, y: number): boolean {
    return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  }

  /** The living throne is a combat boundary even while its entrance is open. */
  private crossesBossBoundary(x0: number, y0: number, x1: number, y1: number): boolean {
    const room = this.throneRoom();
    return !!room && this.bossAlive() && this.inRoom(room, x0, y0) !== this.inRoom(room, x1, y1);
  }

  private protectedByFog(e: EnemyState): boolean {
    return this.crossesBossBoundary(this.player.x, this.player.y, e.x, e.y);
  }

  /** The King, if he still stands on this floor. */
  private bossAlive(): boolean {
    return this.floor.enemies.some((e) => e.def === BOSS_ID && e.ai !== 'dead');
  }

  /** Fog-gate doors on this floor (usually exactly one, at the throne). */
  private bossDoors() {
    return this.floor.doors.filter((d) => isBossDoor(this.floor, d));
  }

  private playerInThrone(): boolean {
    const r = this.throneRoom();
    return !!r && this.inRoom(r, this.player.x, this.player.y);
  }

  /**
   * The fog wall. The moment you step into the throne room with the King
   * alive, every gate slams and seals — no ducking back out to bleed him
   * through the doorway, no bolts through the crack either, since a shut
   * door blocks sight both ways.
   */
  private checkBossSeal(): void {
    if (!this.bossAlive() || !this.playerInThrone()) return;
    const open = this.bossDoors().filter((d) => !d.locked);
    if (!open.length) return;
    for (const g of open) {
      g.open = false;
      g.locked = true;
    }
    this.msg('The fog closes behind you. The King must fall.', '#c0a0ff');
    this.sfx('door');
    this.emit({ type: 'shake', amount: 0.4 });
  }

  /** His death thins the fog: the way out stands open. */
  private unsealBossDoors(): void {
    const shut = this.bossDoors().filter((d) => d.locked || !d.open);
    if (!shut.length) return;
    for (const g of shut) {
      g.locked = false;
      g.open = true;
    }
    this.msg('The fog thins. The way out stands open.', '#c0a0ff');
    this.sfx('door');
  }

  /**
   * He puts the room out.
   *
   * Only the throne room's own sconces: the corridor you came down stays lit,
   * so the way back is still readable and the darkness is somewhere you chose
   * to stand. The renderer rebuilds its lights from `floor.torches` every frame,
   * so dropping them here is the whole effect, and it persists — they do not
   * come back.
   */
  private snuffThrone(): void {
    const room = this.throneRoom();
    if (!room) return;
    const before = this.floor.torches.length;
    this.floor.torches = this.floor.torches.filter((t) => !this.inRoom(room, t.x, t.y));
    if (this.floor.torches.length !== before) this.sfx('snuff');
  }

  /**
   * The guard gets up. Only the ones you actually put down — leave them alive
   * and you simply do not get a second pair, which is a real reason to think
   * about whether to kill them at all.
   */
  private raiseTheGuard(): void {
    const room = this.throneRoom();
    if (!room) return;
    // Only inside the throne room: Hollow Knights are ordinary depth-six
    // monsters, and without the bounds test he would be calling every corpse on
    // the floor. Nearest first and capped, so this cannot become a mob.
    const fallen = this.floor.enemies
      .filter((g) => g.def === 'hollow_knight' && g.ai === 'dead' && this.inRoom(room, g.x, g.y))
      .sort((a, b) => Math.abs(a.x - room.x) + Math.abs(a.y - room.y) - (Math.abs(b.x - room.x) + Math.abs(b.y - room.y)))
      .slice(0, MAX_RAISED_GUARDS);
    for (const g of fallen) {
      const spot = this.freeTileForRise(g.x, g.y);
      g.hp = Math.max(1, Math.round(g.maxHp * RAISED_GUARD_HP));
      g.risen = true;
      g.ai = 'chase';
      g.timer = 0;
      g.deadT = 0;
      g.hurtT = 0.3;
      g.alert = 8;
      g.vuln = 0;
      g.guard = 'down';
      g.guardT = GUARD_DOWN;
      g.blocks = 0;
      g.blockT = 0;
      // They do not come up swinging — the same beat the King gets.
      g.attackCd = BOSS_PHASE_BEAT;
      g.x = g.fromX = spot.x;
      g.y = g.fromY = spot.y;
      g.moveT = 1;
      g.lastSeenX = this.player.x;
      g.lastSeenY = this.player.y;
    }
    if (fallen.length) {
      this.sfx('alert');
      this.msg(fallen.length > 1 ? 'His fallen stand back up.' : 'His fallen stands back up.', '#c080ff');
    }
  }

  /**
   * Where a corpse can stand up. Its own tile if nothing is on it — a knight
   * that rises underneath you can never reach you, because a melee strike wants
   * a distance of exactly one and it would sit at zero swinging forever.
   */
  private freeTileForRise(x: number, y: number): { x: number; y: number } {
    const clear = (tx: number, ty: number) =>
      !blocksMove(this.floor, tx, ty) &&
      !(tx === this.player.x && ty === this.player.y) &&
      !enemyAt(this.floor, tx, ty);
    if (clear(x, y)) return { x, y };
    for (const d of DIRS) {
      const tx = x + DX[d], ty = y + DY[d];
      if (clear(tx, ty)) return { x: tx, y: ty };
    }
    return { x, y };
  }

  private updateEnemies(dt: number): void {
    const f = this.floor;
    const p = this.player;
    for (const e of f.enemies) {
      if (e.ai === 'dead') {
        e.deadT += dt;
        if (e.burstT !== undefined) {
          e.burstT -= dt;
          if (e.burstT <= 0) {
            delete e.burstT;
            this.vengefulBurst(e);
          }
        }
        continue;
      }
      if (this.protectedByFog(e)) continue;
      if (e.lurk) {
        this.updateLurker(e, dt);
        continue;
      }
      const def = this.view(e);
      if (def.behavior === 'boss') this.checkBossPhase(e);
      e.hurtT = Math.max(0, e.hurtT - dt);
      if (!e.scavenged && /^(rat|bat)(_|$)/.test(e.def) && (e.ai === 'idle' || e.ai === 'wander')) {
        const morsel = (f.morsels ?? []).find((m) => m.x === e.x && m.y === e.y);
        if (morsel) {
          e.eating = (e.eating ?? 1) - dt;
          if (e.eating <= 0) {
            f.morsels = (f.morsels ?? []).filter((m) => m !== morsel);
            e.scavenged = true; e.eating = 0;
            e.maxHp = Math.round(e.maxHp * 1.25); e.hp = e.maxHp; e.scavengerAttack = 1.15;
          }
          continue;
        }
      }
      e.attackCd -= dt;
      if (e.strikeT !== undefined) e.strikeT += dt;
      if (e.vuln) e.vuln = Math.max(0, e.vuln - dt);
      if ((e.grabT ?? 0) > 0) {
        e.grabT = e.grabT! - dt;
        if (e.grabT <= 0) {
          delete e.grabT;
          this.mimicBite(e);
        }
        continue;
      }
      if ((e.blockT ?? 0) > 0) {
        e.blockT = Math.max(0, (e.blockT ?? 0) - dt);
        if (e.blockT === 0) e.blocks = 0;
      }
      if (e.moveT < 1) {
        e.moveT = Math.min(1, e.moveT + dt / def.step);
        if (e.moveT < 1) continue;
      }
      const dist = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
      if ((e.blind ?? 0) > 0) {
        e.blind = Math.max(0, (e.blind ?? 0) - dt);
        e.guard = 'down';
        if (this.rng.chance(dt / 0.6)) {
          // A blind thing stumbles, never hunts: it may blunder sideways but
          // never steps closer to you on purpose. Walled in with no sideways
          // step, it stays put.
          const steps = DIRS.map((d) => [e.x + DX[d], e.y + DY[d]] as [number, number])
            .filter(([x, y]) => this.canStep(e, x, y))
            .filter(([x, y]) => Math.abs(x - p.x) + Math.abs(y - p.y) >= dist);
          if (steps.length) { const [x, y] = this.rng.pick(steps); this.stepEnemy(e, x, y); }
        }
        if (e.blind <= 0) {
          if (dist > 2) { e.alert = 0; e.ai = 'idle'; }
          else e.ai = 'chase';
        }
        continue;
      }
      const sees = (this.anim.unseenT > 0 && dist <= 2) || (dist <= def.sight + this.sightPenalty && this.los(e.x, e.y, p.x, p.y));
      if (sees) {
        if (e.alert <= 0 && (e.ai === 'idle' || e.ai === 'wander')) {
          this.sfx('alert', e.x, e.y);
          e.attackCd = Math.max(e.attackCd, 0.3);
        }
        e.alert = 6;
        // A wind-up commits to the tile it aimed at — that's what makes it dodgeable.
        if (e.ai !== 'windup') {
          e.lastSeenX = p.x;
          e.lastSeenY = p.y;
        }
      } else {
        e.alert -= dt;
      }

      // The guard rhythm ticks while the bearer is free to hold it.
      this.updateGuard(e, def, dt, e.alert > 0 && dist <= GUARD_RANGE);

      // A thief with your things in its hands does nothing but run.
      if (e.stolen?.length && e.ai !== 'windup' && e.ai !== 'recover') {
        if (this.runWithLoot(e, def, dist, sees, dt)) continue;
      }

      switch (e.ai) {
        case 'windup':
          e.timer -= dt;
          if (e.timer <= 0) this.enemyStrike(e, def);
          continue;
        case 'recover':
          e.timer -= dt;
          if (e.timer <= 0) e.ai = e.alert > 0 ? 'chase' : 'idle';
          continue;
        case 'flee': {
          if (dist > 7 || !sees) {
            e.ai = 'idle';
            continue;
          }
          const away = DIRS.map((d) => [e.x + DX[d], e.y + DY[d]] as [number, number])
            .filter(([x, y]) => this.canStep(e, x, y))
            .sort((a, b) => Math.abs(b[0] - p.x) + Math.abs(b[1] - p.y) - (Math.abs(a[0] - p.x) + Math.abs(a[1] - p.y)))[0];
          if (away) this.stepEnemy(e, away[0], away[1]);
          continue;
        }
      }

      if (def.burrows && !e.dived && e.hp < e.maxHp * DIVE_AT) {
        this.dive(e, def);
        continue;
      }
      if (def.behavior === 'skittish' && e.hp < e.maxHp * 0.35 && sees && this.rng.chance(0.02)) {
        e.ai = 'flee';
        this.msg(`The ${def.name} tries to flee!`, '#c8c0b0');
        continue;
      }

      if (e.alert > 0) {
        e.ai = 'chase';
        const aligned = (e.x === p.x || e.y === p.y) && sees;
        const ranged = !!def.projectile && (def.behavior === 'ranged' || def.behavior === 'boss');
        if (dist === 1 && e.attackCd <= 0 && (def.behavior !== 'ranged')) {
          this.beginWindup(e, def, p.x, p.y);
          continue;
        }
        if (ranged && aligned && dist >= 2 && dist <= (def.range ?? 4) + 2 && e.attackCd <= 0) {
          this.beginWindup(e, def, p.x, p.y);
          continue;
        }
        if (def.behavior === 'ranged' && dist <= 1) {
          // Back off to shooting range.
          const back = DIRS.map((d) => [e.x + DX[d], e.y + DY[d]] as [number, number]).find(
            ([x, y]) => this.canStep(e, x, y) && Math.abs(x - p.x) + Math.abs(y - p.y) > dist,
          );
          if (back) this.stepEnemy(e, back[0], back[1]);
          else if (e.attackCd <= 0) this.beginWindup(e, def, p.x, p.y);
          continue;
        }
        if (def.behavior === 'ranged' && sees && dist <= (def.range ?? 4)) {
          // Sidestep to line up a shot.
          const line = DIRS.map((d) => [e.x + DX[d], e.y + DY[d]] as [number, number]).find(
            ([x, y]) => this.canStep(e, x, y) && (x === p.x || y === p.y) && this.los(x, y, p.x, p.y),
          );
          if (line) this.stepEnemy(e, line[0], line[1]);
          continue;
        }
        const tx = sees ? p.x : e.lastSeenX;
        const ty = sees ? p.y : e.lastSeenY;
        const next = this.pathStep(e, tx, ty);
        if (next) this.stepEnemy(e, next[0], next[1]);
        else if (!sees && e.x === e.lastSeenX && e.y === e.lastSeenY) e.alert = 0;
        continue;
      }

      // Idle wandering near home.
      e.ai = 'wander';
      e.timer -= dt;
      if (e.timer <= 0) {
        e.timer = this.rng.float(1.2, 3.2);
        const opts = DIRS.map((d) => [e.x + DX[d], e.y + DY[d]] as [number, number]).filter(
          ([x, y]) => this.canStep(e, x, y) && Math.abs(x - e.homeX) + Math.abs(y - e.homeY) <= 3,
        );
        if (opts.length && this.rng.chance(0.6)) {
          const [x, y] = this.rng.pick(opts);
          this.stepEnemy(e, x, y);
        }
      }
    }
  }

  private beginWindup(e: EnemyState, def: EnemyDef, tx: number, ty: number): void {
    const d = dirOf(Math.sign(tx - e.x), Math.sign(ty - e.y));
    if (d !== null) e.facing = d;
    // Swinging means the shield is elsewhere: the guard drops tired.
    if (def.shield) {
      e.guard = 'down';
      e.guardT = Math.max(e.guardT ?? 0, GUARD_DOWN);
      e.blocks = 0;
    }
    e.ai = 'windup';
    e.timer = def.windup;
    e.lastSeenX = tx;
    e.lastSeenY = ty;
  }

  private enemyStrike(e: EnemyState, def: EnemyDef): void {
    e.ai = 'recover';
    e.timer = def.recovery;
    e.attackCd = def.recovery + 0.2;
    // Stamped by the blow itself, so the follow-through is drawn only when
    // there was one. See `enemyPose`.
    e.strikeT = 0;
    const p = this.player;
    const dist = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
    const useRanged = !!def.projectile && (def.behavior === 'ranged' || (def.behavior === 'boss' && dist >= 2));
    if (useRanged) {
      const dx = Math.sign(e.lastSeenX - e.x), dy = Math.sign(e.lastSeenY - e.y);
      if (dx !== 0 && dy !== 0) return;
      const pr = def.projectile!;
      const shots = def.volley ?? [0];
      for (const off of shots) {
        const ox = dy !== 0 ? off : 0, oy = dx !== 0 ? off : 0;
        if (off !== 0 && blocksSight(this.floor, e.x + ox, e.y + oy)) continue;
        this.projectiles.push({
          id: this.projN++, x: e.x + ox + 0.5, y: e.y + oy + 0.5, dx, dy, speed: pr.speed,
          damage: Math.round(def.attack * attackPower(e.power) * (e.scavengerAttack ?? 1) * this.diff.enemyDamage), type: pr.damageType, sprite: pr.sprite, light: pr.light,
          tileX: e.x + ox, tileY: e.y + oy, source: def.name, sourceId: def.id,
        });
      }
      this.sfx(pr.sprite.startsWith('proj_arrow') ? 'shoot' : 'magic', e.x, e.y);
      return;
    }
    // Melee lands only if you're still in the tile it aimed at.
    this.sfx('swing', e.x, e.y);
    if (p.x === e.lastSeenX && p.y === e.lastSeenY && dist === 1) {
      this.damagePlayer(Math.max(1, Math.round(def.attack * attackPower(e.power) * (e.scavengerAttack ?? 1) * this.diff.enemyDamage)), def.damageType, e.x, e.y, def.name, def.id, e);
    } else {
      this.sfx('miss', e.x, e.y);
    }
  }

  private damagePlayer(
    attack: number,
    type: DamageType,
    fromX: number,
    fromY: number,
    source: string,
    sourceId?: string,
    attacker?: EnemyState,
    unavoidable = false,
  ): void {
    const p = this.player;
    // A parry denies the hit outright and leaves the attacker open.
    if (!unavoidable && this.parries(fromX, fromY)) {
      this.parryFlourish(fromX, fromY);
      const traits = this.derived.traits;
      if (traits.parryFeedMax > 0 && this.anim.parryStacks < traits.parryFeedMax) {
        this.anim.parryStacks++;
        this.msg(`The blade drinks it in. ${this.anim.parryStacks} of ${traits.parryFeedMax}.`, '#ffe8a0');
      }
      if (attacker) {
        const def = enemyDef(attacker.def);
        this.anim.parryInvulnT = PARRY_GRACE * this.diff.parryGrace;
        attacker.ai = 'recover';
        // Never shorter than the recovery it would have had anyway.
        attacker.timer = Math.max(attacker.timer, PARRY_STUN);
        attacker.attackCd = Math.max(attacker.attackCd, PARRY_STUN + 0.2);
        attacker.vuln = PARRY_STUN;
        for (const other of this.floor.enemies) {
          if (other === attacker || other.ai === 'dead' || other.lurk) continue;
          if (Math.abs(other.x - p.x) + Math.abs(other.y - p.y) !== 1) continue;
          other.ai = 'recover';
          other.timer = Math.max(other.timer, MELEE_PARRY_SPLASH_STUN);
          other.attackCd = Math.max(other.attackCd, MELEE_PARRY_SPLASH_STUN);
        }
        this.msg(`You turn the ${def.name}'s blow aside. It reels — strike now!`, '#ffe8a0');
        // A shield that answers: the blow it threw, thrown back.
        if (traits.parryReflect > 0) this.reflectOntoAttacker(attacker, Math.round(attack * traits.parryReflect), type);
      } else {
        this.msg('You turn the blow aside.', '#ffe8a0');
      }
      return;
    }
    if (!unavoidable && this.anim.parryInvulnT > 0) return;
    let dmg = enemyHitsPlayer(this.rng, attack, type, this.derived);
    const facingSource = this.facingSource(fromX, fromY);
    let blocked = false;
    // Mid-sip the guard is down by design: the blow lands unblocked, and the
    // heal still lands when the 0.5s commitment completes. Drinking in melee
    // range is supposed to get you hit.
    if (!unavoidable && this.anim.sip === null && this.anim.blockRaise > 0.6 && facingSource) {
      const absorbed = dmg * this.derived.block;
      const cost = absorbed * 1.3;
      if (p.stamina >= cost) {
        p.stamina -= cost;
        dmg = Math.round(dmg - absorbed);
        blocked = true;
        // Blocking grinds the shield down (2 per block, was 1); a parry
        // costs it nothing, which is one more reason to meet the swing
        // instead of hiding behind it.
        if (this.derived.hasShield) this.wear('offhand', 2);
      } else {
        const frac = p.stamina / cost;
        p.stamina = 0;
        dmg = Math.round(dmg - absorbed * frac);
        this.anim.blockRaise = 0;
        this.msg('Your guard breaks!', '#ff9070');
      }
      this.anim.sinceStamina = 0;
      this.sfx('block');
    }
    if (this.anim.recall !== null) {
      this.anim.recall = null;
      this.msg('The recall is broken by the blow.', '#888');
    }
    if (this.anim.retrieving) {
      this.anim.retrieving = null;
      this.msg('The blow scatters your aim; they stop coming.', '#888');
    }
    if (this.anim.chew) {
      const chew = this.anim.chew;
      const morsel = (this.floor.morsels ?? []).find((m) => m.id === chew.id);
      if (morsel) morsel.remaining = Math.max(0, (chew.total - chew.delivered) / this.derived.maxHp);
      this.anim.chew = null;
      this.msg('The blow knocks the morsel from your hands.', '#c8a060');
    }
    if (dmg > 0 && !blocked) this.wearArmour();
    // An unblocked hit empties whatever the blade had banked. Blocking keeps it:
    // the point of the thing is that you have to keep meeting the swing.
    if (dmg > 0 && !blocked && this.anim.parryStacks > 0) {
      this.anim.parryStacks = 0;
      if (this.derived.traits.parryFeedMax > 0) this.msg('The blade goes cold.', '#9a9aa8');
    }
    // An Iron Draught blunts the next blow that gets through, then is spent.
    if (dmg > 0 && this.anim.draught?.kind === 'iron') {
      const cap = Math.round(this.derived.maxHp * (draught(this.state.flask?.infusion)?.wardFrac ?? 0));
      const soaked = Math.min(dmg, cap);
      dmg -= soaked;
      this.anim.draught = null;
      if (soaked > 0) {
        this.emit({ type: 'float', x: p.x, y: p.y, text: `-${soaked}`, color: '#a8c0e0' });
        this.msg(dmg > 0 ? 'The iron takes the worst of it.' : 'The iron takes the blow.', '#a8c0e0');
      }
    }
    p.hp -= dmg;
    // A thief's blow that gets through takes something with it.
    if (attacker && dmg > 0 && !blocked && p.hp > 0 && !attacker.stolen?.length && this.view(attacker).thief) {
      this.pickPocket(attacker);
    }
    if (this.anim.cast) {
      this.anim.cast = null;
      this.msg('The sigil cast is broken by the blow.', '#888');
    }
    if (dmg > (this.state.lifetime.worstHit ?? 0)) this.state.lifetime.worstHit = dmg;
    if (sourceId) recordDamageTaken(this.state.bestiary, sourceId, dmg);
    this.emit({ type: 'hurt', amount: dmg, blocked });
    this.emit({ type: 'shake', amount: blocked ? 0.3 : Math.min(1, dmg / 20) });
    if (dmg > 0 && !blocked) this.sfx('hurt');
    if (p.hp <= 0) {
      p.hp = 0;
      this.run.killedBy = source;
      // Traps have no codex entry, so they file nothing.
      if (sourceId) recordBestiaryDeath(this.state.bestiary, sourceId);
      this.sfx('death');
      this.msg(`You were slain by ${source.startsWith('The ') ? source : 'a ' + source}.`, '#ff5050');
      this.finish('dead');
    }
  }

  private updateProjectiles(dt: number): void {
    const f = this.floor;
    const p = this.player;
    for (const pr of this.projectiles) {
      pr.x += pr.dx * pr.speed * dt;
      pr.y += pr.dy * pr.speed * dt;
      // A shaft on its way back to your hand hits nothing and is stopped by
      // nothing: it steers at you every frame, so it still arrives if you walk
      // while it flies, and it is collected the moment it is close enough.
      // Checked before the tile-crossing early-out, because over a short
      // distance it can arrive without ever leaving the tile it started in.
      if (pr.returning) {
        const ddx = p.x + 0.5 - pr.x, ddy = p.y + 0.5 - pr.y;
        const dist = Math.hypot(ddx, ddy);
        if (dist <= 0.45) {
          pr.speed = 0;
          if (pr.thrownBase) this.collectReturn(pr.thrownBase);
          continue;
        }
        pr.dx = ddx / dist;
        pr.dy = ddy / dist;
        pr.tileX = Math.floor(pr.x);
        pr.tileY = Math.floor(pr.y);
        continue;
      }
      const tx = Math.floor(pr.x), ty = Math.floor(pr.y);
      if (tx === pr.tileX && ty === pr.tileY) continue;
      const previous = { x: pr.tileX, y: pr.tileY };
      pr.tileX = tx;
      pr.tileY = ty;
      if (pr.thrownBase) pr.traveled = (pr.traveled ?? 0) + 1;
      if (blocksSight(f, tx, ty) || this.crossesBossBoundary(previous.x, previous.y, tx, ty)) {
        pr.speed = 0;
        if (pr.thrownBase) this.landThrown(pr.thrownBase, previous.x, previous.y);
        else this.sfx('break', tx, ty);
        continue;
      }
      if (pr.thrownBase) {
        const enemy = enemyAt(f, tx, ty);
        if (enemy) {
          pr.speed = 0;
          this.thrownHit(pr, enemy);
          // The shaft drops where it struck, not on the tile behind. Landing it
          // behind meant a point blank throw fell at your own feet and was
          // collected the same frame, so throwing into something adjacent cost
          // no ammunition at all — the one range at which a thrown weapon is
          // supposed to be a bad idea was the one where it was free.
          this.landThrown(pr.thrownBase, tx, ty);
          continue;
        }
        if ((pr.traveled ?? 0) >= (pr.thrownRange ?? 0)) {
          pr.speed = 0;
          this.landThrown(pr.thrownBase, tx, ty);
        }
        continue;
      }
      // Incoming bolts fly past their own kind; a parried one is yours, and
      // buries itself in the first thing it meets.
      if (pr.reflected) {
        const hit = enemyAt(f, tx, ty);
        if (hit) {
          pr.speed = 0;
          this.reflectedHit(pr, hit);
        }
        continue;
      }
      if (tx === p.x && ty === p.y) {
        if (this.parriesProjectile(tx - pr.dx, ty - pr.dy)) {
          this.reflect(pr);
          continue;
        }
        pr.speed = 0;
        this.damagePlayer(pr.damage, pr.type, tx - pr.dx, ty - pr.dy, pr.source, pr.reflected ? undefined : pr.sourceId);
      }
    }
    this.projectiles = this.projectiles.filter((pr) => pr.speed > 0);
    const receiving = this.anim.retrieving;
    if (receiving && receiving.left <= 0
      && !this.projectiles.some(pr => pr.returning && pr.thrownBase === receiving.base)) {
      this.anim.retrieving = null;
    }
  }

  private throwWeapon(): void {
    const base = this.anim.attackBase;
    const snapshot = this.anim.attackSnapshot;
    const thrown = snapshot?.thrown;
    if (!base || !thrown || (this.run.thrown.held[base] ?? 0) <= 0) return;
    this.run.thrown.held[base]--;
    this.projectiles.push({
      id: this.projN++, x: this.player.x + 0.5, y: this.player.y + 0.5,
      dx: DX[this.player.facing], dy: DY[this.player.facing], speed: thrown.speed,
      damage: this.anim.attackPower * thrown.power, type: snapshot.damageType, sprite: thrown.sprite,
      tileX: this.player.x, tileY: this.player.y, source: 'your throw',
      thrownBase: base, thrownRange: thrown.range, traveled: 0, player: snapshot, weaponUid: this.anim.attackWeaponUid ?? undefined,
    });
    this.sfx('shoot');
  }

  private thrownHit(pr: Projectile, e: EnemyState): void {
    if (this.protectedByFog(e)) return;
    const player = pr.player ?? this.derived;
    const def = this.view(e);
    const reaction = this.guardReaction(e, def);
    if (reaction) {
      this.shieldChip(e, def, 1, pr.damage, player);
      this.wearThrown(pr.weaponUid);
      return;
    }
    const hit = playerHitsEnemy(this.rng, player, pr.damage, def, defensePower(e.power) * this.diff.enemyDefense);
    e.hp -= hit.damage;
    e.hurtT = 0.3;
    e.alert = 8;
    e.lastSeenX = this.player.x;
    e.lastSeenY = this.player.y;
    recordDamageDealt(this.state.bestiary, def.id, hit.damage);
    this.emit({ type: 'float', x: e.x, y: e.y, text: hit.crit ? `${hit.damage}!` : `${hit.damage}`, color: hit.crit ? '#ffe040' : hit.effective === 'weak' ? '#ff9a40' : hit.effective === 'resist' ? '#9a9aa8' : '#ffffff' });
    this.sfx(hit.crit ? 'crit' : 'hit', e.x, e.y);
    if (player.stats.leech > 0) this.heal(Math.max(1, Math.round(hit.damage * player.stats.leech / 100)));
    this.wearThrown(pr.weaponUid);
    if (e.hp <= 0) this.killEnemy(e);
  }

  private landThrown(base: string, x: number, y: number): void {
    const markers = (this.floor.thrown ??= []);
    const marker = markers.find((m) => m.x === x && m.y === y && m.base === base);
    if (marker) marker.n++;
    else markers.push({ x, y, base, n: 1 });
    if (x === this.player.x && y === this.player.y) this.collectThrownHere();
  }

  private wearThrown(uid: string | undefined): void {
    if (!uid) return;
    const equipped = this.state.equipment.thrown;
    if (equipped?.uid === uid) {
      this.wear('thrown');
      return;
    }
    const item = this.run.backpack.items.find((it) => it.uid === uid);
    if (item) wearItem(item);
  }

  private collectThrownHere(): number {
    const base = this.state.equipment.thrown?.ref;
    if (!base || !this.derived.thrown) return 0;
    const markers = (this.floor.thrown ??= []);
    let found = 0;
    this.floor.thrown = markers.filter((m) => {
      if (m.base !== base || m.x !== this.player.x || m.y !== this.player.y) return true;
      found += m.n;
      return false;
    });
    if (found) {
      this.run.thrown.held[base] = (this.run.thrown.held[base] ?? 0) + found;
      // A call in progress counted these before you walked over them. Re-anchor
      // its remainder to what is actually still out there rather than
      // decrementing a snapshot: a snapshot goes stale the moment the floor
      // holds shafts the call never counted, and the counter it shows must
      // stay honest. Nothing is left for it to send home, the call just ends —
      // with no cooldown, since the steps were the price.
      const r = this.anim.retrieving;
      if (r && r.base === base) {
        const remaining = this.retrievableCount(base);
        r.left = remaining;
        if (remaining <= 0) {
          r.t = 0;
          if (!this.projectiles.some(pr => pr.returning && pr.thrownBase === base)) this.anim.retrieving = null;
        }
      }
      this.msg(`You pick up ${found} ${itemBase(base).name.toLowerCase()}.`, '#c8b890');
      this.sfx('pickup');
    }
    return found;
  }

  /** Send a bolt back the way it came, now hostile to whatever shot it. */
  private reflect(pr: Projectile): void {
    const followUp = !this.anim.parryArmed;
    this.parryFlourish(this.player.x, this.player.y);
    this.anim.rangedParryT = followUp ? 0 : PARRY_GRACE * this.diff.parryGrace;
    pr.dx = -pr.dx;
    pr.dy = -pr.dy;
    pr.reflected = true;
    pr.source = 'your own parry';
    // Restart it on your own tile, not the next one along: nudging it forward
    // would mark the adjacent tile as already visited and skip whoever is
    // standing there — which is exactly where the archer's escort tends to be.
    pr.x = this.player.x + 0.5;
    pr.y = this.player.y + 0.5;
    pr.tileX = this.player.x;
    pr.tileY = this.player.y;
    this.msg('You knock the bolt back the way it came.', '#ffe8a0');
  }

  /**
   * A parried melee blow dealt back to whoever threw it. Its own damage and its
   * own damage type, so a creature that shrugs off fire still shrugs it off
   * coming back — the shield returns the blow, it does not translate it.
   */
  /**
   * One tick of a hidden monster. A ceiling dropper waits until you come
   * within `AMBUSH_TRIGGER`, sifts dust for `DROP_SECONDS`, then lands. A
   * buried one does the same with a rumble. A tunnelling burrower travels
   * towards your back first. None of them strike on arrival (see `emerge`).
   */
  private updateLurker(e: EnemyState, dt: number): void {
    const p = this.player;
    const dist = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
    if (e.tunnelling) {
      e.lurkT = (e.lurkT ?? 0) - dt;
      if (e.moveT < 1) {
        e.moveT = Math.min(1, e.moveT + dt / MOUND_STEP);
        return;
      }
      if (e.lurkT <= 0 || dist <= 1) {
        this.emerge(e, true);
        return;
      }
      // Head for the tile at your back. The floor is no obstacle to it, but
      // walls and doors are; it goes greedily, which you can read and turn to.
      const back = { x: p.x - DX[p.facing], y: p.y - DY[p.facing] };
      const step = DIRS.map((d) => ({ x: e.x + DX[d], y: e.y + DY[d] }))
        .filter((t) => !blocksMove(this.floor, t.x, t.y) && !(t.x === p.x && t.y === p.y))
        .sort((a, b) => Math.abs(a.x - back.x) + Math.abs(a.y - back.y) - (Math.abs(b.x - back.x) + Math.abs(b.y - back.y)))[0];
      if (step) {
        e.fromX = e.x; e.fromY = e.y;
        e.x = step.x; e.y = step.y;
        e.moveT = 0;
      }
      return;
    }
    if (e.lurkT === undefined) {
      if (dist > AMBUSH_TRIGGER) return;
      if (e.lurk === 'ceiling') {
        e.lurkT = DROP_SECONDS;
        this.sfx('drip', e.x, e.y);
        this.msg(e.spotted ? 'It lets go of the ceiling!' : 'Dust sifts down from above — something skitters!', '#d0b080');
      } else {
        e.lurkT = SURFACE_SECONDS;
        this.sfx('break', e.x, e.y);
        this.msg('The ground heaves!', '#c8a070');
      }
      return;
    }
    e.lurkT -= dt;
    if (e.lurkT <= 0) this.emerge(e, false);
  }

  /**
   * A lurker comes out onto the floor. Its own tile if that is free, otherwise
   * a free tile beside you — behind you, for a burrower that went looking for
   * your back. **It never strikes on arrival**: it lands in recovery, with a
   * beat before it may start a wind-up, so an ambush costs position and never
   * a free hit.
   */
  private emerge(e: EnemyState, preferBack: boolean): void {
    const p = this.player;
    const def = enemyDef(e.def);
    const open = (x: number, y: number) =>
      !blocksMove(this.floor, x, y) && !(x === p.x && y === p.y) && !enemyAt(this.floor, x, y);
    let spot = open(e.x, e.y) && !preferBack ? { x: e.x, y: e.y } : null;
    if (!spot) {
      const around = DIRS.map((d) => ({ x: p.x + DX[d], y: p.y + DY[d], d }))
        .filter((t) => open(t.x, t.y))
        .sort((a, b) => (preferBack ? (a.d === turnAround(p.facing) ? -1 : 0) - (b.d === turnAround(p.facing) ? -1 : 0) : 0));
      spot = around[0] ?? (open(e.x, e.y) ? { x: e.x, y: e.y } : null);
    }
    if (!spot) {
      // Nowhere to come out: it waits a little longer.
      e.lurkT = 0.3;
      return;
    }
    const was = e.lurk;
    delete e.lurk;
    delete e.lurkT;
    delete e.tunnelling;
    e.x = e.fromX = spot.x;
    e.y = e.fromY = spot.y;
    e.moveT = 1;
    const d = dirOf(Math.sign(p.x - e.x), Math.sign(p.y - e.y));
    if (d !== null) e.facing = d;
    e.ai = 'recover';
    e.timer = AMBUSH_BEAT;
    e.attackCd = Math.max(e.attackCd, AMBUSH_BEAT + 0.2);
    e.alert = 8;
    e.lastSeenX = p.x;
    e.lastSeenY = p.y;
    this.sfx(was === 'ceiling' ? 'plop' : 'break', e.x, e.y);
    this.emit({ type: 'shake', amount: 0.2 });
    const behind = e.x === p.x - DX[p.facing] && e.y === p.y - DY[p.facing];
    this.msg(was === 'ceiling'
      ? `A ${def.name} drops down${behind ? ' behind you' : ''}!`
      : `A ${def.name} bursts from the earth${behind ? ' behind you' : ''}!`, '#e0a070');
  }

  /**
   * A blow on a cracked wall. It wears the weapon like a landed hit and it is
   * loud: everything within `CRACK_NOISE` tiles comes to look, through walls.
   * At `CRACK_BLOWS` the wall goes, for good, and a seam or cache spills.
   */
  private strikeCrack(c: Crack): void {
    const f = this.floor;
    // A small secret, not a rule: the Mining Pick knows where stone gives, and
    // brings any cracked wall down in one. Every other weapon takes CRACK_BLOWS.
    const w = this.state.equipment.weapon;
    const pick = !!w && itemBase(w.ref).weaponClass === 'pick' && !durability(w).broken;
    c.hits = pick ? CRACK_BLOWS - 1 : c.hits;
    c.hits++;
    this.wear('weapon', CRACK_WEAR);
    this.sfx('break', c.x, c.y);
    this.emit({ type: 'shake', amount: 0.2 });
    this.emit({ type: 'crack', id: c.id, hits: c.hits });
    for (const e of f.enemies) {
      if (e.ai === 'dead' || e.lurk || this.protectedByFog(e)) continue;
      if (Math.abs(e.x - c.x) + Math.abs(e.y - c.y) > CRACK_NOISE) continue;
      e.alert = Math.max(e.alert, 6);
      e.lastSeenX = this.player.x;
      e.lastSeenY = this.player.y;
    }
    if (c.hits < CRACK_BLOWS) {
      this.msg(c.hits === 1 ? 'The cracked stone shifts. The sound carries.' : 'Dust pours from the crack.', '#c8b090');
      return;
    }
    c.broken = true;
    f.tiles[c.y * f.width + c.x] = FLOOR;
    if (pick) this.msg('The pick finds the fault line. The wall comes down in one.', '#e8d8a0');
    this.reveal();
    const rng = createRng(hashString(`crack:${f.seed}:${c.id}`));
    if (c.kind === 'seam') {
      const ore = materialForDepth(rng, this.run.depth, ['metal']);
      this.dropLoot(c.x, c.y, [makeMaterial(ore.id, rng.int(SEAM_ORE[0], SEAM_ORE[1]))], 0);
      this.msg(`The wall gives way. Ore spills from the seam: ${ore.name}.`, '#e8d8a0');
    } else if (c.kind === 'cache') {
      const idBelow = metaLevel(this.state.meta, 'appraiser') >= 2 ? Rarity.Epic : undefined;
      // Three loud blows and the wear on your blade: it pays like a chest,
      // and never nothing.
      const loot = rollContainerLoot(rng, this.run.depth, this.derived.find, 'chest', idBelow, this.state.recipeRanks, this.seenUniques, this.difficultyId);
      this.dropLoot(c.x, c.y, loot.items, Math.max(loot.gold, CACHE_MIN_GOLD(this.run.depth)));
      this.msg('The wall gives way onto a sealed niche. Someone hid something here.', '#e8d8a0');
    } else {
      this.msg('The wall gives way. A way through!', '#e8d8a0');
    }
  }

  /** Struck where it hides: dragged out early, reeling, open to double damage. */
  private knockOut(e: EnemyState): void {
    const def = enemyDef(e.def);
    const was = e.lurk;
    delete e.lurk;
    delete e.lurkT;
    delete e.tunnelling;
    e.moveT = 1;
    e.fromX = e.x; e.fromY = e.y;
    e.ai = 'recover';
    e.timer = KNOCKOUT_STUN;
    e.vuln = KNOCKOUT_STUN;
    e.attackCd = Math.max(e.attackCd, KNOCKOUT_STUN + 0.2);
    e.alert = 8;
    e.hurtT = 0.3;
    e.lastSeenX = this.player.x;
    e.lastSeenY = this.player.y;
    this.sfx('hit', e.x, e.y);
    this.emit({ type: 'shake', amount: 0.25 });
    this.msg(was === 'ceiling' ? `You knock the ${def.name} off the ceiling!` : `You drag the ${def.name} out of the earth!`, '#ffe8a0');
  }

  /** A burrower, badly hurt, goes under: a mound heading for your back. */
  private dive(e: EnemyState, def: EnemyDef): void {
    e.dived = true;
    e.lurk = 'buried';
    e.tunnelling = true;
    e.lurkT = this.rng.float(BURROW_MIN, BURROW_MAX);
    e.moveT = 1;
    e.ai = 'idle';
    e.guard = 'down';
    this.sfx('break', e.x, e.y);
    this.msg(`The ${def.name} dives into the earth!`, '#c8a070');
  }

  /**
   * A thief lifts one thing from your pack: a piece of gear whole, or half a
   * stack. Equipped gear is never at risk — only what you are carrying home,
   * which is the thing this whole game is about.
   */
  private pickPocket(e: EnemyState): void {
    const pack = this.run.backpack.items.filter((it) => it.kind !== 'lore');
    if (!pack.length) return;
    const target = this.rng.pick(pack);
    const taken = takeQty(this.run.backpack, target.uid, target.qty > 1 ? Math.ceil(target.qty / 2) : 1);
    if (!taken) return;
    e.stolen = [taken];
    e.stolenT = 0;
    e.trailN = 0;
    e.trailDrops = 0;
    e.ai = 'flee';
    e.alert = Math.max(e.alert, 6);
    this.emit({ type: 'float', x: this.player.x, y: this.player.y, text: 'Stolen!', color: '#e8c060' });
    this.sfx('gold', e.x, e.y);
    this.msg(`The ${this.view(e).name} snatches your ${itemName(taken)} and runs!`, '#e8c060');
  }

  /**
   * One tick of a thief running with your things. Returns true when it has
   * acted. It is meant to be a chase you can win, not a vanishing act:
   *
   * - **Laden**: carrying makes it slower (`THIEF_LADEN`, via `enemyView`).
   * - **Clumsy**: after a step it sometimes stops to clutch the loot
   *   (`THIEF_FUMBLE_CHANCE` for `THIEF_FUMBLE` seconds).
   * - **Panicked, not clever**: it takes any step that is not closer to you,
   *   preferring to keep running straight, so it bolts down dead ends.
   * - **Goes to ground**: out of sight it stops running and creeps a tile only
   *   every `THIEF_CREEP` seconds, still glowing where it hides.
   * - **Leaves a trail**: every few steps a coin or two spills from its purse.
   *
   * It gets clean away after `THIEF_ESCAPE` seconds out of your sight, taking
   * what it stole. Cornered and in reach, it fights.
   */
  private runWithLoot(e: EnemyState, def: EnemyDef, dist: number, sees: boolean, dt: number): boolean {
    const p = this.player;
    e.stolenT = sees ? 0 : (e.stolenT ?? 0) + dt;
    if (e.stolenT >= THIEF_ESCAPE) {
      const lost = e.stolen!.map(itemName).join(', ');
      e.ai = 'dead';
      e.hp = 0;
      e.deadT = 99;
      delete e.stolen;
      delete e.stolenT;
      this.msg(`Somewhere in the dark, the ${def.name} gets away with your ${lost}.`, '#c89060');
      return true;
    }
    e.ai = 'flee';
    if ((e.pauseT ?? 0) > 0) {
      e.pauseT = e.pauseT! - dt;
      return true;
    }
    if (sees) { e.lastSeenX = p.x; e.lastSeenY = p.y; }
    if (!sees) {
      e.pauseT = THIEF_CREEP;
      // Creep one tile at most, then wait again.
    }
    const fromX = sees ? p.x : e.lastSeenX, fromY = sees ? p.y : e.lastSeenY;
    const here = Math.abs(e.x - fromX) + Math.abs(e.y - fromY);
    const options = DIRS.map((d) => ({ d, x: e.x + DX[d], y: e.y + DY[d] }))
      .filter((t) => this.canStep(e, t.x, t.y) && Math.abs(t.x - fromX) + Math.abs(t.y - fromY) >= here);
    if (options.length) {
      // Keep running the way it was going, if it can; otherwise any way that
      // is not towards you. No lookahead: a dead end is as good as a door.
      const pick = options.find((t) => t.d === e.facing && this.rng.chance(0.75)) ?? this.rng.pick(options);
      const fromTileX = e.x, fromTileY = e.y;
      this.stepEnemy(e, pick.x, pick.y);
      e.trailN = (e.trailN ?? 0) + 1;
      if (e.trailN % THIEF_TRAIL_EVERY === 0 && (e.trailDrops ?? 0) < THIEF_TRAIL_MAX) {
        e.trailDrops = (e.trailDrops ?? 0) + 1;
        this.dropLoot(fromTileX, fromTileY, [], this.rng.int(1, 3));
        if (e.trailDrops === 1 && sees) this.msg(`Coins spill from the ${def.name}'s purse as it runs.`, '#e8c060');
      }
      if (sees && this.rng.chance(THIEF_FUMBLE_CHANCE)) {
        e.pauseT = THIEF_FUMBLE;
        this.msg(`The ${def.name} fumbles its prize!`, '#e8c060');
      }
      return true;
    }
    if (dist === 1 && e.attackCd <= 0) {
      this.beginWindup(e, def, p.x, p.y);
      return true;
    }
    return true;
  }

  /**
   * A Vengeful corpse goes off: its own tile and the four beside it. It is a
   * blow like any other from that tile — facing it, you can block or parry it;
   * standing on the body, you cannot. Monsters caught in it take it raw, the
   * way they take a trap, which makes killing one beside its friends a tactic.
   */
  private vengefulBurst(e: EnemyState): void {
    const def = enemyDef(e.def);
    const attack = Math.max(1, Math.round(def.attack * attackPower(e.power) * VENGEFUL_DAMAGE_MULT * this.diff.enemyDamage));
    const inBlast = (x: number, y: number) => Math.abs(x - e.x) + Math.abs(y - e.y) <= 1;
    this.sfx('lava_burst', e.x, e.y);
    this.emit({ type: 'float', x: e.x, y: e.y, text: 'Burst!', color: '#c070ff' });
    for (const other of this.floor.enemies) {
      if (other === e || other.ai === 'dead' || other.lurk || !inBlast(other.x, other.y)) continue;
      const odef = enemyDef(other.def);
      const dealt = Math.max(1, Math.round(def.attack * attackPower(e.power) * VENGEFUL_DAMAGE_MULT * (odef.resist[def.damageType] ?? 1)));
      other.hp -= dealt;
      other.hurtT = 0.3;
      this.emit({ type: 'float', x: other.x, y: other.y, text: `${dealt}`, color: '#c070ff' });
      if (other.hp <= 0) this.killEnemy(other);
    }
    if (inBlast(this.player.x, this.player.y)) {
      this.msg(`The Vengeful ${def.name}'s corpse bursts!`, '#c070ff');
      this.emit({ type: 'shake', amount: 0.5 });
      this.damagePlayer(attack, def.damageType, e.x, e.y, `Vengeful ${def.name}`, def.id);
    } else {
      this.msg('The corpse bursts harmlessly behind you.', '#9a80b0');
    }
  }

  private reflectOntoAttacker(e: EnemyState, attack: number, type: DamageType): void {
    if (this.protectedByFog(e)) return;
    const def = enemyDef(e.def);
    const mult = def.resist[type] ?? 1;
    const damage = Math.max(mult > 0 ? 1 : 0, Math.round(attack * mult));
    if (damage <= 0) return;
    e.hp -= damage;
    e.hurtT = 0.3;
    recordDamageDealt(this.state.bestiary, def.id, damage);
    this.emit({ type: 'float', x: e.x, y: e.y, text: `${damage}!`, color: '#ffe8a0' });
    this.sfx('hit', e.x, e.y);
    this.msg(`The shield answers for you.`, '#ffe8a0');
    if (e.hp <= 0) this.killEnemy(e);
  }

  /** A reflected bolt landing on a monster: its own damage, its own element. */
  private reflectedHit(pr: Projectile, e: EnemyState): void {
    if (this.protectedByFog(e)) return;
    const def = enemyDef(e.def);
    const mult = def.resist[pr.type] ?? 1;
    const damage = Math.max(mult > 0 ? 1 : 0, Math.round(pr.damage * mult));
    e.hp -= damage;
    e.hurtT = 0.3;
    e.alert = Math.max(e.alert, 8);
    e.lastSeenX = this.player.x;
    e.lastSeenY = this.player.y;
    const color = mult >= 1.4 ? '#ff9a40' : mult <= 0.7 ? '#9a9aa8' : '#ffe8a0';
    this.emit({ type: 'float', x: e.x, y: e.y, text: `${damage}`, color });
    this.sfx('hit', e.x, e.y);
    if (mult >= 1.4) this.msg(`Its own ${pr.type} burns it.`, '#ff9a40');
    if (e.hp <= 0) this.killEnemy(e);
  }

  /** True while a raised guard can still turn a blow aside — the renderer's tell. */
  get parryWindow(): boolean {
    return (this.anim.parryArmed && this.anim.blockT <= PARRY_WINDOW) || this.anim.rangedParryT > 0;
  }

  facingName(): string {
    return DIR_NAMES[this.player.facing];
  }

  /** Living enemies the player can currently see (for the map). */
  visibleEnemies(): Set<string> {
    const out = new Set<string>();
    const p = this.player;
    for (const e of this.floor.enemies) {
      if (e.ai === 'dead' || e.lurk) continue;
      if (Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= 8 && this.los(p.x, p.y, e.x, e.y)) out.add(e.id);
    }
    return out;
  }

  /** Remaining free backpack slots (for the HUD). */
  get freeSlots(): number {
    return this.run.backpack.capacity - this.run.backpack.items.length;
  }

  /** Carried light after temporary sigil effects. */
  get playerLightRadius(): number {
    return this.anim.snuffT > 0 ? 2.5 : lightRadius(this.state.meta) + this.derived.traits.light;
  }

  /** Base item info for the viewmodel. */
  weaponArt(): { id: string; materialId?: string } {
    // Casting holds the sigil up in front of you. It is the only tell that a
    // cast is happening at all from inside the view, and the lit frame in the
    // back half is what makes the moment it lands readable — without it a
    // sigil was a key that spent stamina and nothing more.
    const casting = this.anim.cast;
    if (casting) {
      const def = findSigil(casting.id);
      const total = def?.cast ?? 1;
      return { id: casting.t <= total * 0.45 ? 'vm_sigil_lit' : 'vm_sigil' };
    }
    // A throw shows no viewmodel of its own. The shaft leaves the player and
    // becomes a projectile; drawing a fistful of javelins for the length of the
    // wind-up put a second pair of hands in the frame beside the ones already
    // holding your weapon, which is not how anybody throws anything.
    const w = this.state.equipment.weapon;
    if (!w) return { id: 'vm_fist' };
    return { id: viewmodelFor(itemBase(w.ref)), materialId: w.materialId };
  }
}
