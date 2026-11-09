import { Rng, createRng, hashString } from '../core/rng';
import { gold } from '../core/format';
import { Dir, DIR_NAMES, DIRS, DX, DY, dirOf, turnAround, turnLeft, turnRight } from '../core/dir';
import { DamageType, ELEMENTS, Element, EnemyDef, EquipSlot, EQUIP_SLOTS, Item, SwingProfile } from '../types';
import { GameState, RunState } from '../state/game-state';
import { addItem, canFit, findItem, freeSlots, removeItem, roomFor, takeQty } from '../state/inventory';
import {
  THIEF_BOLT, THIEF_CREEP, THIEF_ESCAPE, THIEF_FUMBLE, THIEF_FUMBLE_CHANCE, THIEF_TRAIL_EVERY, THIEF_TRAIL_MAX,
  VENGEFUL_DAMAGE_MULT, VENGEFUL_FUSE,
} from '../data/elites';
import { CACHE_MIN_GOLD, CRACK_BLOWS, CRACK_NOISE, CRACK_WEAR, Crack, SEAM_ORE } from '../data/walls';
import {
  BULWARK_MULT, BULWARK_SOAK, BULWARK_WINDOW, EXECUTION_REFUND_MULT, KINDLING_AT, KINDLING_SPREAD, LAST_FLASK_MULT,
  COUNTERCHARM_CHARGES, RETRIEVAL_MULT, RIPOSTE_MULT, RIPOSTE_WINDOW,
} from '../data/properties';
import { AttackMove, COMBO_BEAT, FEINT_AT, FEINT_HOLD, chooseMove, meleeReach, moveById } from '../data/attacks';
import { quirkDef, quirkTimeScale } from '../data/quirks';
import { applyQuirk } from '../systems/quirks';
import { burningAt, chill, freezeFlood, ignite, oilBarrelAt, placeSurfaces, reachable, spillOil, splitsNothing, surfaceAt, surfaceKindAt, tickSurfaces } from '../systems/surfaces';
import {
  BURST_TICKS, FIRE_MONSTER_BASE, FIRE_MONSTER_PER_DEPTH, FIRE_PLAYER_BASE, FIRE_PLAYER_PER_DEPTH, FIRE_TICK, FLOOD_REACH,
  FREEZE_SECONDS, PLAYER_FREEZE_SECONDS, PLAYER_SLIP_SECONDS, SLIP_SECONDS, SPORE_BLIND, SPORE_BURST_TICKS, Surface,
  VENT_FLAMES, VENT_PERIOD_MAX, VENT_PERIOD_MIN, VENT_TICKS,
} from '../data/surfaces';
import { FORK_DEPTH, ROADS, ROAD_DEPTHS } from '../data/routes';
import { SHADE_ID, placeShade } from '../systems/grave';
import { LIGHTLESS_LIGHT, SEAL_FIND, sealDifficulty, sealFloorMods } from '../data/seals';
import {
  HOARDER_REACH, HOARDER_SHY, LIEUTENANTS, LIEUTENANT_MIN_DISTANCE, LieutenantId, QUARTERMASTER_MIN_GOBLINS, RALLY_DAMAGE,
  ROUT_SECONDS, isGoblin, lieutenantChance,
} from '../data/lieutenants';
import {
  BURROWS_NOISE_MULT, COLLAPSE_BASE, COLLAPSE_PER_DEPTH, COLLAPSE_STUN, LAWS, OSSUARY_RISE_HP, OSSUARY_STIR, OSSUARY_STIR_AFTER,
  ROOT_CACHE_LURE, lawFor,
} from '../data/laws';
import {
  DUELIST_KILLS, HUNTER_DEPTHS, HUNTER_MARKS, HUNTER_SIGHT, KINGSBANE_DAMAGE, OATHS, PILGRIM_IDOL_CURSE, PILGRIM_PRAYERS,
  SILENCE_NOISE, SILENCE_SIGHT, UNBROKEN_DEPTH, UNBROKEN_WEAR,
} from '../data/oaths';
import { runOath } from '../systems/oaths';
import { eligibleTraits } from '../data/elites';
import { RAISE_BEAT, RAISE_CHANNEL, RAISE_COOLDOWN, RAISE_HP, RAISE_LIMIT, RAISE_REACH, SHATTER_OVERKILL } from '../data/necromancy';
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
  promoteElite,
  crackAt,
  generateFloor,
  inBounds,
  inRoom,
  isBossDoor,
  isVessel,
  portalAt,
  shrineKind,
  VESSELS,
  propAt,
  secretAt,
  shrinePityFor,
  stairsAt,
  stairsFront,
  tileAt,
  Trap,
  TrapKind,
  trapAt,
} from '../systems/dungeon';
import { BOSS_ID, ENEMIES, enemyDef, enemyView, kingPhase, phaseForHp } from '../data/enemies';
import { consumable, findConsumable, itemBase, viewmodelFor } from '../data/items';
import { biomeForFloor, FINAL_DEPTH } from '../data/biomes';
import { PlayerDerived, derivePlayer, spellView, thrownView } from '../systems/player';
import { DifficultyId, DifficultyDef, difficultyOf } from '../data/difficulty';
import { enemyHitsPlayer, playerHitsEnemy, staminaPower } from '../systems/combat';
import { ContainerTier, LootRoll, durability, identify, isIdentified, itemName, makeMaterial, materialForDepth, rollContainerLoot, rollEnemyLoot, uniqueOf, wearItem } from '../systems/items';
import { nameRelic } from '../systems/relics';
import { recordDepth, recordKill } from '../systems/contracts';
import {
  bestiaryEntry,
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
import { BURN_SECONDS, BURN_SHARE, CHILL_SECONDS, ConduitSpellDef, HEX_SECONDS, WEAVE_REGROW, WEAVE_SECONDS, WEAVE_SHARE, conduitSpell, findConduitSpell } from '../data/conduit-spells';
import { RITES, RITE_CARVING_DEPTH, RITE_KING_KNOWN, RITE_MILESTONES, ROAD_RITES, RiteDef, RiteId, findRite, rite, riteFloorChance } from '../data/rites';
import { RiteGrade, TracePoint, recogniseRite } from '../systems/rite-draw';
import { loadedSpells, makeTome, unknownConduitSpells } from '../systems/conduits';
import { CHEW_SECONDS, DREGS_FRACTION, FLASK_POTENCY, MORSEL_HEAL, MORSEL_ROT_SECONDS, SIP_BUFFER_SECONDS, SIP_SECONDS, flaskMax, morselChance } from '../systems/healing';
import { findMaterial } from '../data/materials';
import { Draught, KINDLE_SECONDS, MARROW_SECONDS, WARD_SECONDS, draught } from '../systems/infusion';
import { addStats } from '../types';
import { clamp, manhattan } from '../core/math';
import * as Projectiles from './projectiles';
import * as Hazards from './hazards';
import * as Boss from './boss';
import { SHADOW_STEP_EVERY } from './boss';
import * as Spells from './spells';
import * as Sigils from './sigils';
import * as Thrown from './thrown';
import * as Combat from './combat';
import * as EnemyAi from './enemy-ai';
import * as Features from './features';

// ---------------------------------------------------------------------------
// Events the world emits for the renderer / UI / audio to react to.
// ---------------------------------------------------------------------------

export type WorldEvent =
  | { type: 'msg'; text: string; color?: string }
  | { type: 'sfx'; name: SfxName; x?: number; y?: number }
  | { type: 'hurt'; amount: number; blocked: boolean }
  | { type: 'float'; x: number; y: number; text: string; color: string }
  | { type: 'shake'; amount: number }
  | { type: 'rite'; rite: string; grade: RiteGrade; points: TracePoint[] }
  | { type: 'sigil'; r: number; g: number; b: number; strength: number }
  | { type: 'loot'; pickupId: string }
  | { type: 'floor' }
  | { type: 'end'; outcome: 'dead' | 'extracted' }
  | { type: 'secret'; x: number; y: number }
  | { type: 'crack'; id: string; hits: number }
  | { type: 'fork' }
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
  /** Monsters a Retrieval shaft has already cut on its way home. */
  hitIds?: string[];
  thrownRange?: number;
  traveled?: number;
  player?: PlayerDerived;
  weaponUid?: string;
  /** A battle spell from your conduit: it flies like a throw and lands nowhere. */
  spell?: string;
}

/**
 * A hitscan spell's mark, drawn where it struck and gone in a moment: Smite's
 * streak of light, Hex's puff of violet smoke (also when a hex wears off).
 * `miss` is the same mark at the end of the line when nothing was there.
 * Never saved; the renderer reads them and the world ages them out.
 */
export interface SpellFx {
  id: number;
  /** A spell's mark, or a surface's: a spore cloud, a burst of fire. */
  kind: 'smite' | 'poof' | 'spores' | 'blast' | 'meteor' | 'frost';
  x: number;
  y: number;
  /** Seconds since it appeared. */
  t: number;
  miss?: boolean;
  /** A rolled Meteor hit waiting for its falling star to land; never saved. */
  meteor?: { target: EnemyState; damage: number; crit: boolean };
  weak?: boolean;
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
  /** The battle spell this wind-up releases, if it is a cast rather than a swing or throw. */
  attackSpell: string | null;
  /** Weave: a landed spell's element riding on your next blow, and for how long. */
  weave: { t: number; element: Element; amount: number } | null;
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
  /** The Horn's charge: consecutive blows landed without one landing on you. */
  chargeStacks: number;
  sinceStamina: number;
  /** Throttles the winded cue so a held attack button can't spam it. */
  windedCd: number;
  recall: number | null;
  cast: { id: SigilId; t: number } | null;
  snuffT: number;
  unseenT: number;
  /** Riposte: seconds left in which the next swing is free and harder, and whether the swing in flight is one. */
  riposteT: number;
  riposteSwing: boolean;
  /** Bulwark: seconds left in which the next landed strike is charged. */
  bulwarkT: number;
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
export const PARRY_WINDOW = 0.22;
const PARRY_COOLDOWN = 0.75;
/**
 * An offhand conduit parries on a tighter window: it absorbs nothing, so the
 * timing has to be the defense. Multiplies the window above (after difficulty).
 */
export const CONDUIT_PARRY_WINDOW = 0.6;
/** Longest a touch may stay undecided between block and walk (s); see World.guardPending. */
const GUARD_PENDING_MAX = 0.5;
/**
 * A rite being traced: the world runs at this fraction of its speed while
 * the trace is open — a dramatic beat, not a free pause. Tracing is the
 * only thing you can do meanwhile: everything else waits for the release.
 */
export const RITE_SLOWMO = 0.15;
/** What it costs to finish a trace, win or lose: the stamina half of the price. */
export const RITE_STAMINA = 25;
export const RITE_CHARGE_COST = 2;
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
export const PARRY_GRACE = 0.75;
/** Normal's mending: seconds unhurt before it starts, and share of max health per second. */
const REST_DELAY = 5;
const REST_RATE = 0.02;

export const PARRY_VULN_MULT = 2;


export const GUARD_DOWN = 1.6;

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
export const RETRIEVE_PER_SHAFT = 0.75;



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
    sfx: 'alert',
    spotted: 'A ward is scratched into the stone here.',
    hit: 'A ward shrieks!',
    disarmed: 'You scuff the ward out.',
  },
};

/**
 * A run-long boon or bane. `apply` folds it into the derived stats; the depth
 * is the one the run is at, so a D6 blessing feels like a D6 blessing. Effects
 * with no `apply` are read where they matter instead.
 */
interface RunBoon {
  name: string;
  text: string;
  apply?: (d: PlayerDerived, depth: number) => void;
}

export const BLESSINGS: Record<string, RunBoon> = {
  fortune: { name: 'Fortune', text: '+40 loot find this run, more the deeper you pray.', apply: (d, depth) => { d.find += 40 + 5 * Math.max(0, depth - 2); } },
  fury: { name: 'Fury', text: '+30% damage this run.', apply: (d) => { d.attack = Math.round(d.attack * 1.3); } },
  ward: { name: 'Warding', text: '+6 defense this run, more the deeper you pray.', apply: (d, depth) => { d.stats.defense += 6 + Math.floor(depth / 2); } },
  vitality: { name: 'Vitality', text: '+20% maximum health this run.', apply: (d) => { d.maxHp = Math.round(d.maxHp * 1.2); } },
};

/**
 * The other half of the bargain. A curse lasts the run like a blessing does,
 * and the two are independent — you can carry both. A Font of Mending lifts
 * one, which is what makes finding a font worth something once you are cursed.
 */
export const CURSES: Record<string, RunBoon> = {
  frailty: { name: 'Frailty', text: '−20% maximum health this run.', apply: (d) => { d.maxHp = Math.max(1, Math.round(d.maxHp * 0.8)); } },
  leaden: { name: 'Leaden Limbs', text: '−15 speed this run.', apply: (d) => { d.stats.speed -= 15; } },
  dulled: { name: 'Dulled Edge', text: '−25% damage this run.', apply: (d) => { d.attack = Math.max(1, Math.round(d.attack * 0.75)); } },
  // Read in sightPenalty (+3).
  hunted: { name: 'Hunted', text: 'Monsters see you three tiles further this run.' },
  // Read in wear (+1).
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

/**
 * A spell tome's chance in a chest: a vault or secret room's is a real
 * prospect, an ordinary chest's grows from nothing on depth 1 to 5% at depth 5.
 */
export function tomeChance(tier: string, depth: number): number {
  return tier === 'vault' || tier === 'secret' ? 0.18 : 0.05 * clamp((depth - 1) / 4, 0, 1);
}

export class World {
  readonly state: GameState;
  readonly run: RunState;
  rng: Rng;
  flavorRng: Rng;
  derived!: PlayerDerived;
  projectiles: Projectile[] = [];
  /** Hitscan spell marks on screen right now. See `SpellFx`. */
  spellFx: SpellFx[] = [];
  /**
   * A rite trace in progress: screen-normalised points (0..1 across the
   * view) for the overlay to draw, and which rite is being traced. Null
   * when no trace is open. The world runs slowed while one is (`RITE_SLOWMO`).
   */
  riteDraw: { rite: string | null; points: TracePoint[] } | null = null;
  /** The King's own actions on cooldown, by enemy id. Never saved: a reload finds them ready. */
  kingCd = new Map<string, { step: number; pitch: number }>();
  /** Burning pitch waiting to catch. Never saved: a reload finds it lying unlit. */
  pitchFuses: { x: number; y: number; t: number }[] = [];
  events: WorldEvent[] = [];
  anim: PlayerAnim;
  held = new Set<Action | 'block'>();
  /**
   * When a touch that might be a block landed (world time), while it can
   * still turn out to be a walk. See guardPending.
   */
  private guardPendingAt: number | null = null;
  /** The parry cooldown left when that touch landed, so the window is judged as of then. */
  private guardPendingCd = 0;
  /** A blow settled a pending touch into a guard; a drag afterwards still takes it back down. */
  private guardFromTouch = false;
  private queued: Action | null = null;
  projN = 0;
  pathCache = new Map<string, { t: number; next: [number, number] | null }>();
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
      attackBase: null, attackSpell: null, weave: null, attackWeaponUid: null, attackSnapshot: null,
      blockRaise: 0, blockT: Infinity, parryArmed: false, parryCd: 0,
      rangedParryT: 0, parryInvulnT: 0, stunT: 0, steps: 0, parryStacks: 0, chargeStacks: 0,
      sinceStamina: 10, windedCd: 0, recall: null, cast: null, snuffT: 0, unseenT: 0, riposteT: 0, riposteSwing: false, bulwarkT: 0, ward: null, transition: null,
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
    const base = difficultyOf(this.run.difficulty ?? this.state.difficulty);
    const kingsbane = !!runOath(this.run, 'kingsbane');
    if (!this.run.seals?.length && !kingsbane) return base;
    // Sealed or sworn: the multipliers over the snapshot, built once per delve.
    if (this.sealedDiff?.base !== base) {
      const sealed = sealDifficulty(base, this.run.seals);
      this.sealedDiff = { base, def: kingsbane ? { ...sealed, enemyDamage: sealed.enemyDamage * KINGSBANE_DAMAGE } : sealed };
    }
    return this.sealedDiff.def;
  }
  private sealedDiff: { base: DifficultyDef; def: DifficultyDef } | null = null;

  /** Loot find for every roll: your gear's, plus the Ashen Seals' bonus. */
  get lootFind(): number {
    return this.derived.find + SEAL_FIND * (this.run.seals?.length ?? 0);
  }

  /** The raw id behind `diff`, for passing into loot and generation calls. */
  get difficultyId(): DifficultyId {
    return this.diff.id;
  }

  /** Stand the player on a tile, facing a way, with no step or turn left to animate. */
  placePlayer(x: number, y: number, facing: Dir): void {
    this.player.x = x;
    this.player.y = y;
    this.player.facing = facing;
    const yaw = facing * (Math.PI / 2);
    Object.assign(this.anim, { fromX: x, fromY: y, moveT: 1, yaw, yawFrom: yaw, yawTo: yaw, turnT: 1 });
  }

  refreshDerived(): void {
    this.derived = derivePlayer(this.state.equipment, this.state.meta, this.difficultyId);
    // Blessing first, then curse: the rounding depends on the order.
    if (this.run.blessing) BLESSINGS[this.run.blessing]?.apply?.(this.derived, this.run.depth);
    if (this.run.curse) CURSES[this.run.curse]?.apply?.(this.derived, this.run.depth);
    for (const id of this.run.tonics ?? []) TONICS[id]?.apply(this.derived);
    // A tonic in the flask works as if drunk, for as long as it stays infused.
    const infused = findConsumable(this.state.flask?.infusion ?? '')?.effect;
    if (infused?.type === 'tonic') TONICS[infused.tonicId]?.apply(this.derived);
    // A kindled blade carries its gem's catalyst stat. Elemental stats deal
    // damage through the ELEMENTS loop in combat, so they must NOT also land
    // in attack — that dealt every gem twice.
    if (this.anim?.draught?.kind === 'kindled') {
      const kindle = draught(this.state.flask?.infusion)?.kindle;
      if (kindle) addStats(this.derived.stats, kindle);
    }
    this.player.hp = Math.min(this.player.hp, this.derived.maxHp);
    this.player.stamina = Math.min(this.player.stamina, this.derived.maxStamina);
    Thrown.ensureThrownStock(this);
    Spells.ensureConduit(this);
  }

  /** The spells your conduit can cast right now, in cycling order. */
  conduitSpells(): ConduitSpellDef[] {
    const c = this.derived.conduit;
    return c ? loadedSpells(this.state, c.slots).map(conduitSpell) : [];
  }

  /** The selected spell, kept in range of whatever is loaded. */
  selectedSpell(): ConduitSpellDef | null {
    const spells = this.conduitSpells();
    if (!spells.length || !this.run.conduit) return null;
    const sel = ((this.run.conduit.sel % spells.length) + spells.length) % spells.length;
    return spells[sel];
  }

  /**
   * Whether the selected spell can be paid for now: the pool covers it, or a
   * blood-cast relic will take the shortfall in health without the last point.
   */
  spellReady(): boolean {
    const spell = this.selectedSpell();
    const pool = this.run.conduit;
    if (!spell || !pool) return false;
    const blood = Spells.bloodPrice(this, spell.charges - pool.charges);
    return blood === 0 || (blood > 0 && blood < this.player.hp);
  }

  /** Cycle to the next loaded spell. Free, and allowed mid-anything but death. */
  nextSpell(): boolean {
    const spells = this.conduitSpells();
    if (!spells.length || !this.run.conduit) {
      this.msg(this.derived.conduit ? 'No spells loaded. Load them at the forge\'s Spells bench.' : 'No conduit in your offhand.', '#888');
      return false;
    }
    if (spells.length === 1) {
      this.msg(`${spells[0].name} is the only spell loaded.`, '#888');
      return false;
    }
    this.run.conduit.sel = (this.run.conduit.sel + 1) % spells.length;
    const next = spells[this.run.conduit.sel];
    this.msg(`${next.name} readied.`, next.color);
    this.sfx('ui');
    return true;
  }

  /**
   * Every drop of healing in the game goes through here, which is what lets one
   * suit of armour halve all of it at once. Returns what was actually restored.
   * Difficulty mends faster on Normal; Hard multiplies by exactly 1.
   */
  heal(amount: number, source?: 'food' | 'leech'): number {
    // Last Flask: with the flask dry, food and leech carry you.
    const lastFlask = source && this.derived.traits.lastFlask && (this.run.flask?.charges ?? 1) <= 0 ? LAST_FLASK_MULT : 1;
    const scaled = Math.round(amount * lastFlask * this.derived.traits.healing * this.diff.playerHealing);
    const healed = Math.min(Math.max(0, scaled), this.derived.maxHp - this.player.hp);
    this.player.hp += healed;
    const overflow = Math.max(0, scaled - healed);
    if (overflow > 0) {
      const flask = (this.run.flask ??= { charges: flaskMax(this.state.flask?.shards ?? 0, this.diff.flaskBonus), dregs: 0 });
      const max = flaskMax(this.state.flask?.shards ?? 0, this.diff.flaskBonus);
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
  wear(slot: EquipSlot, amount = 1): void {
    // Normal: gear does not wear at all.
    if (!this.diff.gearWears) return;
    const it = this.state.equipment[slot];
    if (this.run.curse === 'brittle') amount += 1;
    const oath = runOath(this.run, 'unbroken');
    if (oath) amount *= UNBROKEN_WEAR;
    const crossed = wearItem(it, amount);
    if (crossed === 'none' || !it) return;
    const name = itemName(it);
    if (crossed === 'warn') this.msg(`Your ${name} is close to failing.`, '#e8c060');
    else {
      this.msg(`Your ${name} breaks!`, '#ff7070');
      this.sfx('break');
      this.emit({ type: 'shake', amount: 0.3 });
      if (oath && oath.status === 'active') {
        oath.status = 'broken';
        this.msg('Your oath breaks with it. Unbroken is lost.', OATHS.unbroken.color);
      }
    }
    this.refreshDerived();
  }

  /**
   * Normal's slow mending. After REST_DELAY seconds without losing health,
   * with nothing on the floor hunting you, health creeps back up to
   * `restHeal` of the maximum. Any lost health, from any source, restarts
   * the wait. It never tops you up past the line, and never fights for you.
   */
  private restHeal(dt: number): void {
    const p = this.player;
    if (p.hp < this.restLastHp) this.restWait = 0;
    else this.restWait += dt;
    const cap = Math.round(this.derived.maxHp * this.diff.restHeal);
    const hunted = this.floor.enemies.some((e) => e.ai !== 'dead' && !e.lurk && e.alert > 0);
    if (!hunted && this.restWait >= REST_DELAY && p.hp > 0 && p.hp < cap) {
      // Health stays whole: the mend builds up here and lands a point at a
      // time. It answers to half_healing like every other heal, but not to
      // Normal's playerHealing, since this rate is already Normal's own knob.
      this.restMend += this.derived.maxHp * REST_RATE * dt * this.derived.traits.healing;
      const whole = Math.floor(this.restMend);
      if (whole > 0) {
        this.restMend -= whole;
        p.hp = Math.min(cap, p.hp + whole);
      }
    } else {
      this.restMend = 0;
    }
    this.restLastHp = p.hp;
  }
  private restWait = 0;
  /** Rest mending not yet a whole point of health. */
  private restMend = 0;
  private restLastHp = Infinity;

  /** Armour wears where you were actually hit: one worn piece takes the scuff. */
  wearArmour(): void {
    const worn = (['body', 'head', 'hands'] as EquipSlot[]).filter((s) => {
      const it = this.state.equipment[s];
      return it && !durability(it).broken;
    });
    // 2 per unblocked hit (was 1): armour is a consumable now, not furniture.
    if (worn.length) this.wear(this.rng.pick(worn), 2);
  }

  /** A swing that hit nothing still dulls the edge, slowly: 1 wear per 3 whiffs. */
  wearWhiff(): void {
    this.whiffs += 1;
    if (this.whiffs >= 3) {
      this.whiffs = 0;
      this.wear('weapon', 1);
    }
  }

  /** Extra tiles of sight the floor has on you, from the Hunted curse. */
  get sightPenalty(): number {
    return (this.run.curse === 'hunted' ? 3 : 0) + (runOath(this.run, 'hunter') ? HUNTER_SIGHT : 0) - (runOath(this.run, 'silence') ? SILENCE_SIGHT : 0) - this.derived.traits.unseen - (this.anim?.unseenT > 0 ? 99 : 0);
  }

  emit(e: WorldEvent): void {
    this.events.push(e);
  }

  /**
   * Take `dealt` off a monster: the flinch, and the number floating off it.
   * Deciding whether that killed it stays with the caller, because what gets
   * said first — and when `killEnemy` rolls its loot — differs by source.
   */
  hurt(e: EnemyState, dealt: number, text: string, color: string): void {
    e.hp -= dealt;
    e.hurtT = 0.3;
    this.emit({ type: 'float', x: e.x, y: e.y, text, color });
  }

  msg(text: string, color?: string): void {
    this.emit({ type: 'msg', text, color });
  }

  sfx(name: SfxName, x?: number, y?: number): void {
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
    // A trace holds your hands: drawing is the only thing you can do
    // meanwhile, so a walk pressed mid-trace waits for the release.
    if (this.riteDraw) return;
    this.held.add(a);
    this.queued = a;
  }

  release(a: Action | 'block'): void {
    this.held.delete(a);
  }

  setBlock(on: boolean): void {
    if (on && this.riteDraw) return;
    if (on) this.confirmGuard();
    else this.guardPendingAt = null;
    this.guardFromTouch = false;
    if (on) this.held.add('block');
    else this.held.delete('block');
  }

  /**
   * A guard that may not be one yet. The left half of a phone screen both
   * blocks (tap or hold) and walks (drag), and a finger can't say which it
   * means until it moves or lifts. Raising the shield on touch made every
   * walk a parry attempt, and waiting to see would make every parry late.
   *
   * So the touch is held here, stamped with when it landed, and nothing
   * shows or costs anything. If the finger drags, `guardPending(false)`
   * forgets it. If it taps or holds still, `setBlock(true)` raises the guard
   * backdated to the touch. If a blow arrives first, `parries` settles it
   * the same way before judging the blow. Either way the parry window runs
   * from the moment the finger landed, exactly as if the shield had gone
   * up then.
   */
  guardPending(on: boolean): void {
    if (!on) {
      this.guardPendingAt = null;
      if (this.guardFromTouch) {
        this.guardFromTouch = false;
        this.held.delete('block');
      }
      return;
    }
    if (this.guardPendingAt !== null || this.held.has('block')) return;
    this.guardPendingAt = this.time;
    this.guardPendingCd = this.anim.parryCd;
  }

  /** Turn a pending touch into the guard it was, raised when the finger landed. */
  confirmGuard(): void {
    if (this.guardPendingAt === null) return;
    const since = this.time - this.guardPendingAt;
    this.guardPendingAt = null;
    // A real touch settles within a tap (see touch.ts); anything older is a
    // leftover from a finger the page never heard lift, not a guard.
    if (since > GUARD_PENDING_MAX) return;
    this.guardFromTouch = true;
    this.held.add('block');
    const a = this.anim;
    // The same conditions the update loop checks before raising a guard;
    // if any fails, the held block rises later by the usual path.
    if (a.blockT !== Infinity || a.attack !== 'idle' || a.cast || a.stunT > 0 || a.sip !== null || Combat.brokenGuardGear(this)) return;
    a.blockT = since;
    a.parryArmed = this.guardPendingCd <= 0;
    if (a.parryArmed) a.parryCd = Math.max(0, (a.ward ? PARRY_COOLDOWN * 0.6 : PARRY_COOLDOWN) - since);
    a.blockRaise = clamp(since / 0.12, 0, 1);
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
    const flask = (this.run.flask ??= { charges: flaskMax(this.state.flask?.shards ?? 0, this.diff.flaskBonus), dregs: 0 });
    if (this.riteDraw) return false;
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
    // The Cane reaches the sip and the step as well as the swing: what it
    // sells is doing *everything* a little sooner, which is the only way a
    // weapon with a cane's Attack is ever worth a weapon slot.
    this.anim.sip = (draught(this.state.flask?.infusion)?.sipSeconds ?? SIP_SECONDS) * this.derived.traits.haste;
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
    // A strange floor may run the whole dungeon fast. Scaling the clock here —
    // once, before anything reads it — means the speed-up reaches the player,
    // the monsters, the shafts in flight, the torches and the run timer
    // together, rather than being sprinkled over whichever systems remembered
    // to ask. Nothing hits harder on a fast floor; it only arrives sooner.
    dt *= quirkTimeScale(this.floor.quirk);
    // A trace holds the world at a crawl: the beat lands, and the monsters
    // you are drawing around barely move. Everything else reads the same
    // dt, so the slowdown reaches the player, the monsters and the shafts
    // together — including the run clock, which is the honest price of it.
    if (this.riteDraw) dt *= RITE_SLOWMO;
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
    const fresh = (m: { droppedAt: number }) => this.run.stats.time - m.droppedAt < MORSEL_ROT_SECONDS;
    if (!this.floor.morsels.every(fresh)) this.floor.morsels = this.floor.morsels.filter(fresh);

    this.run.thrown ??= { held: {}, retrieveCd: 0 };
    this.run.thrown.retrieveCd = Math.max(0, (this.run.thrown.retrieveCd ?? 0) - dt);
    a.snuffT = Math.max(0, a.snuffT - dt);
    a.riposteT = Math.max(0, a.riposteT - dt);
    a.bulwarkT = Math.max(0, a.bulwarkT - dt);
    a.unseenT = Math.max(0, a.unseenT - dt);
    if (a.ward) {
      a.ward.t -= dt;
      if (a.ward.t <= 0 || a.ward.x !== this.player.x || a.ward.y !== this.player.y) a.ward = null;
    }
    if (this.run.sigil && this.run.sigil.cd > 0) {
      const hunted = this.floor.enemies.some((e) => e.ai !== 'dead' && e.alert > 0 && manhattan(e.x, e.y, this.player.x, this.player.y) <= 8);
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
    const brokenGuard = wantGuard ? Combat.brokenGuardGear(this) : null;
    const wantBlock = wantGuard && !brokenGuard;
    // A Wand or Rod guards nothing, so it only flicks up for the parry: it
    // rises while the window is open, then lowers even while held. A tap
    // flashes it; holding keeps nothing up. The fall is deliberately slower
    // than a shield's, so the flick reads instead of twitching.
    const parryOnly = this.derived.conduitHand === 'offhand';
    const flickWindow = PARRY_WINDOW * this.diff.parryWindow * CONDUIT_PARRY_WINDOW * (a.ward ? 2 : 1);
    const wantRaise = wantBlock && (!parryOnly || a.blockT <= flickWindow);
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
    a.blockRaise = clamp(a.blockRaise + (wantRaise ? dt : -dt) / (wantRaise ? 0.12 : parryOnly ? 0.3 : 0.12), 0, 1);

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
        Combat.resolvePlayerAttack(this);
        a.attack = 'recover';
        a.attackT = 0;
        a.attackDur = a.attackRecovery;
      } else if (a.attack === 'recover' && a.attackT >= a.attackDur) {
        a.attack = 'idle';
        // The belt only holds the viewmodel for the length of the throw. Left
        // set, one javelin put shafts in your hands for the rest of the delve
        // and your sword was never seen again.
        a.attackThrow = false;
        a.attackSpell = null;
      }
    }

    if (a.cast) {
      a.cast.t -= dt;
      if (a.cast.t <= 0) {
        const id = a.cast.id;
        a.cast = null;
        Sigils.resolveSigil(this, id);
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
          const level = clamp(this.state.flask?.potency ?? 0, 0, 4);
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
        this.heal(portion, 'food');
        a.chew.delivered += portion;
      }
      if (a.chew.left <= 0) {
        const id = a.chew.id;
        a.chew = null;
        this.floor.morsels = (this.floor.morsels ?? []).filter((m) => m.id !== id);
        this.sfx('drink');
      }
    }

    // Stamina recovers; health never does on its own (flask, food, shrines and
    // leech only) — except on Normal, which mends you slowly while nothing hunts you.
    if (this.diff.restHeal > 0) this.restHeal(dt);
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

    Boss.checkBossSeal(this);
    Spells.updateConduit(this, dt);
    Hazards.updateAfflictions(this, dt);
    Boss.updatePitch(this, dt);
    Hazards.updateSurfaces(this, dt);
    Thrown.updateRetrieve(this, dt);
    EnemyAi.updateEnemies(this, dt);
    Projectiles.updateProjectiles(this, dt);
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
    this.anim.moveDur = STEP_TIME * (act === 'back' ? 1.25 : 1) * (encumbered ? 1.2 : 1) * this.derived.traits.haste;
  }

  /** Called when a step completes. */
  private arrive(): void {
    this.trail.push({ x: this.player.x, y: this.player.y, facing: this.player.facing, time: this.run.stats.time });
    this.trail = this.trail.filter((p) => this.run.stats.time - p.time <= 2.1).slice(-5);
    const p = this.player;
    this.anim.steps++;
    this.reveal();
    Boss.checkBossSeal(this);
    const f = this.floor;
    Thrown.collectThrownHere(this);
    const trap = trapAt(f, p.x, p.y);
    if (trap && trap.armed) {
      this.springTrap(trap, null);
      if (this.run.outcome !== 'active') return;
    }
    if (surfaceKindAt(f, p.x, p.y) === 'spores') Hazards.sporePuff(this, p.x, p.y);
    const s = stairsAt(f, p.x, p.y);
    this.sfx(biomeForFloor(f).flooded && !s ? 'splash' : 'step');
    if (s) {
      if (!s.down && this.run.depth === 1) {
        this.msg('You climb back into the daylight.', '#e8d8a0');
        this.finish('extracted');
        return;
      }
      // The fork: the first time down from depth 2, the road is chosen first.
      if (s.down && this.forkPending()) {
        this.emit({ type: 'fork' });
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
      this.emit({ type: 'float', x: pk.x, y: pk.y, text: `+${gold(pk.gold)}`, color: '#ffd24a' });
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
    // Said on the way out, while the floor you are leaving is still `this.floor`.
    const leaving = quirkDef(this.floor.quirk);
    if (leaving) this.msg(leaving.parting, leaving.color);
    // A floor transition cannot erase a charge that was still in flight.
    for (const pr of this.projectiles) {
      if (!pr.thrownBase) continue;
      // One already flying home is yours: it goes into the stock rather than
      // being dropped on the floor you are walking off, which would lose it.
      if (pr.returning) Thrown.collectReturn(this, pr.thrownBase);
      else Thrown.landThrown(this, pr.thrownBase, pr.tileX, pr.tileY);
    }
    this.retrieve(false);
    run.depth += dir === 'down' ? 1 : -1;
    const fresh = !run.floors[run.depth - 1];
    if (fresh) {
      // Pity guarantees: ≥1 shrine in depths 1–3, ≥2 in 4–6. Natural rolls
      // cover most runs; the force only bites on a drought.
      const force = shrinePityFor(run.floors, run.depth);
      const road = run.road && ROAD_DEPTHS.includes(run.depth) ? run.road : undefined;
      run.floors[run.depth - 1] = generateFloor(run.seed, run.depth, this.difficultyId, force, road, sealFloorMods(run.seals));
      // Dressed after generation and **before** the passes that follow, which
      // is deliberate and load-bearing rather than incidental. The lieutenant
      // pass then reads the floor it is actually going to stand on: a
      // Forbidden Pasture has no goblins, so it correctly cannot produce a
      // Goblin Quartermaster with nothing to command, and gets the Hoarder or
      // nothing. Your Shade is placed afterwards and so stays your Shade
      // rather than becoming a cow, which is also what you want.
      applyQuirk(run.floors[run.depth - 1]!, run.seed, this.difficultyId);
      placeSurfaces(run.floors[run.depth - 1]!, run.seed);
      Features.placeHunterMark(this, run.floors[run.depth - 1]!);
      Features.placeRiteCarving(this, run.floors[run.depth - 1]!);
      Features.placeLieutenant(this, run.floors[run.depth - 1]!);
      if (!run.shadePlaced && placeShade(this.state, run.floors[run.depth - 1]!, run.seed, this.difficultyId)) {
        run.shadePlaced = true;
        this.msg('Something that wears your shape waits on this floor, holding what you lost.', '#9ab8ff');
      }
    }
    // Unbroken is kept the moment you stand on its depth with everything whole.
    const unbroken = runOath(run, 'unbroken');
    if (unbroken && unbroken.status === 'active' && run.depth >= UNBROKEN_DEPTH) {
      unbroken.status = 'kept';
      this.msg(`Depth ${UNBROKEN_DEPTH}, and nothing broken. The oath is kept: now bring it home.`, OATHS.unbroken.color);
    }
    const f = this.floor;
    const arrive = f.stairs.find((s) => s.down === (dir === 'up'))!;
    const spot = stairsFront(arrive);
    this.placePlayer(spot.x, spot.y, spot.facing);
    this.projectiles = [];
    this.spellFx = [];
    this.pitchFuses = [];
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
    const quirk = quirkDef(f.quirk);
    const biome = biomeForFloor(f);
    // A strange floor announces itself instead of its biome. The biome is still
    // underneath it — the walls are the walls — but naming it would bury the
    // one thing the player needs to notice.
    this.msg(`Depth ${run.depth} — ${quirk ? quirk.name : biome.name}`, quirk ? quirk.color : '#d8c8a8');
    // Once, on the floor's first visit — same rule as a biome law's arrival
    // line below. Walking back up and down again re-announces the floor by
    // name, which is enough; the whole paragraph again is not.
    if (quirk && fresh) this.msg(quirk.arrival, quirk.color);
    const law = lawFor(biomeForFloor(f));
    if (law && fresh && !quirk) this.msg(law.arrival, law.color);
    if (run.depth === FINAL_DEPTH && dir === 'down') this.msg('The air is thick with ash. Something waits below the throne.', '#c080ff');
    this.emit({ type: 'floor' });
  }

  /** Whether the stair down from here forks and no road has been taken yet. */
  forkPending(): boolean {
    const run = this.run;
    return run.depth === FORK_DEPTH && !!run.roads?.length && !run.road && !run.floors[FORK_DEPTH];
  }

  /**
   * Take one of the two roads at the fork and go down it. The other is sealed
   * for the rest of the delve. Refused unless standing on the forking stair.
   */
  chooseRoad(biome: string): boolean {
    const run = this.run;
    const s = stairsAt(this.floor, this.player.x, this.player.y);
    if (!s?.down || !this.forkPending() || !run.roads!.includes(biome)) return false;
    run.road = biome;
    const other = run.roads!.find((b) => b !== biome);
    this.msg(`You take ${ROADS[biome].name}.${other ? ` ${ROADS[other].name} is sealed behind you.` : ''}`, ROADS[biome].color);
    this.anim.transition = { t: 0, dir: 'down', done: false };
    this.sfx('stairs');
    return true;
  }

  /** Debug/playtest hook: jump a floor without walking to the stairs. */
  changeFloorForTest(dir: 'down' | 'up'): void {
    this.changeFloor(dir);
  }

  finish(outcome: 'dead' | 'extracted'): void {
    if (this.run.outcome !== 'active') return;
    this.riteDraw = null; // an open trace ends with the run, unpaid
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
      if (manhattan(t.x, t.y, p.x, p.y) > 1 && blocksSight(f, t.x, t.y)) continue;
      trap.found = true;
      this.msg(TRAPS[trap.kind].spotted, '#e0c060');
      this.sfx('ui');
    }
  }

  /**
   * Set a trap off. `victim` is the monster that stood on it, or null for you —
   * monsters blunder into them too, which is the whole reason to back through
   * one you have already found.
   */
  springTrap(trap: Trap, victim: EnemyState | null): void {
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
        if (manhattan(e.x, e.y, trap.x, trap.y) > EnemyAi.noise(this, 12)) continue;
        e.alert = Math.max(e.alert, 10);
        e.lastSeenX = trap.x;
        e.lastSeenY = trap.y;
        woken++;
      }
      if (!victim) {
        EnemyAi.breakSilence(this, 'The ward shrieks');
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
      this.hurt(victim, dealt, `${dealt}`, '#ffb060');
      const vdef = enemyDef(victim.def);
      if (victim.hp <= 0) {
        this.msg(`The ${vdef.name} blunders into ${def.source}.`, '#e0c060');
        Combat.killEnemy(this, victim);
      }
      return;
    }
    this.msg(def.hit, '#ff7070');
    Combat.damagePlayer(this, Math.max(1, Math.round(damage * this.diff.trapDamage)), def.damageType, trap.x, trap.y, def.source);
  }

  /** Mark tiles near and in view as explored (automap fog). */
  reveal(): void {
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

  /** Grid line of sight (Bresenham). `inclusive` lets the target itself be opaque. */
  los(x0: number, y0: number, x1: number, y1: number, inclusive = false): boolean {
    const f = this.floor;
    if (Boss.crossesBossBoundary(this, x0, y0, x1, y1)) return false;
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
    if (this.busy || this.riteDraw || a.attack !== 'idle' || a.stunT > 0 || a.cast) return;
    // A swing has to be paid for in full. This used to clamp at zero and land
    // anyway at staminaPower's 40% floor, so a spent player could attack for
    // free forever. Gating on "any stamina at all" is not enough either: the
    // trickle of regen at the tail of each recovery is always a sliver above
    // zero, which kept the free swings coming. How tired you are still shows
    // in the damage, through staminaPower — it just is not free any more.
    const profile: SwingProfile = this.derived.swing;
    // Riposte: the swing after a parry is free.
    a.riposteSwing = this.derived.traits.riposte && a.riposteT > 0;
    if (a.riposteSwing) a.riposteT = 0;
    const cost = a.riposteSwing ? 0 : profile.staminaCost;
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
    Sigils.rockAndStone(this);
    Spells.breakChannels(this);
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
    if (this.busy || this.riteDraw || a.attack !== 'idle' || a.stunT > 0 || a.cast) return false;
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
    const throwing = thrownView(this.derived);
    a.attackSnapshot = {
      ...throwing,
      // thrownView's stats, not the player's: they carry the belt's own
      // elements and leech, which belong to this throw.
      stats: { ...throwing.stats },
      traits: { ...this.derived.traits },
      swing: { ...this.derived.swing },
    };
    a.attackRecovery = thrown.recovery;
    a.attackDur = thrown.windup;
    a.blockRaise = 0;
    Spells.breakChannels(this);
    return true;
  }

  /**
   * Cast the selected battle spell from the conduit in your offhand.
   *
   * It runs through the same wind-up and recovery a throw does, so it cannot
   * be stacked on a swing, and it costs stamina from the bar you fight with
   * as well as charges from the conduit's pool. Every refusal says why.
   */
  castSpell(): boolean {
    const a = this.anim;
    if (this.busy || this.riteDraw || a.attack !== 'idle' || a.stunT > 0 || a.cast) return false;
    const conduit = this.derived.conduit;
    if (!conduit) {
      this.msg('No conduit in your offhand to cast with.', '#888');
      return false;
    }
    const spell = this.selectedSpell();
    const pool = this.run.conduit;
    if (!spell || !pool) {
      this.msg('No spells loaded. Load them at the forge\'s Spells bench.', '#888');
      return false;
    }
    // Dr. Mantis Toboggan's Rod casts on credit: what the pool lacks is
    // taken in health, but never the last point.
    const blood = Spells.bloodPrice(this, spell.charges - pool.charges);
    if (blood < 0 || blood >= this.player.hp) {
      if (blood > 0) this.msg('The rod wants more of you than you have left.', '#c04050');
      else {
        const left = Math.ceil(conduit.regrow - pool.regrow);
        this.msg(`Your conduit is spent — a charge returns in ${left}s.`, '#9a8fd8');
      }
      return false;
    }
    if (this.player.stamina < spell.stamina) {
      if (a.windedCd <= 0) {
        a.windedCd = 1.6;
        this.sfx('winded');
      }
      return false;
    }
    if (blood > 0) {
      this.player.hp -= blood;
      this.emit({ type: 'float', x: this.player.x, y: this.player.y, text: `-${blood}`, color: '#c04050' });
      this.sfx('hurt');
    }
    a.attackPower = staminaPower(this.player.stamina, this.derived.maxStamina);
    this.player.stamina = Math.max(0, this.player.stamina - spell.stamina);
    pool.charges = Math.max(0, pool.charges - spell.charges);
    a.sinceStamina = 0;
    a.attack = 'windup';
    a.attackT = 0;
    a.attackThrow = false;
    a.attackSpell = spell.id;
    a.attackBase = null;
    a.attackWeaponUid = (this.derived.conduitHand === 'weapon' ? this.state.equipment.weapon : this.state.equipment.offhand)?.uid ?? null;
    a.attackSnapshot = spellView(this.derived, spell);
    a.attackRecovery = spell.recovery;
    a.attackDur = spell.windup;
    a.blockRaise = 0;
    this.sfx('magic');
    Spells.breakChannels(this);
    return true;
  }

  // -------------------------------------------------------------------------
  // Rites
  // -------------------------------------------------------------------------

  /** The rites you know, in the order the tablet lists them. */
  knownRites(): RiteDef[] {
    const known = this.state.ritesKnown ?? [];
    return RITES.filter((r) => known.includes(r.id));
  }

  /**
   * Whether the trace input may open right now. A rite needs a conduit with
   * two charges to burn, breath, and free hands. Every refusal says why,
   * like a cast's. With no id, any rite you know will do: the drawing
   * decides which one it was.
   */
  riteReady(id?: string): boolean {
    if (id ? !findRite(id) : false) return false;
    if (id ? !(this.state.ritesKnown ?? []).includes(id) : !this.knownRites().length) {
      this.msg(id ? 'You know no such rite. Its carving is still out there.' : 'You know no rite yet. Their carvings are still out there.', '#888');
      return false;
    }
    if (!this.riteAvailable(id)) {
      const pool = this.run.conduit;
      if (!this.derived.conduit || !pool || pool.charges < RITE_CHARGE_COST) {
        this.msg(`A rite needs ${RITE_CHARGE_COST} conduit charges. They recover between casts.`, '#9a8fd8');
      } else if (this.player.stamina < RITE_STAMINA) {
        this.msg(`Not enough breath for a rite — ${RITE_STAMINA} needed.`, '#ff9070');
      } else if (!this.riteDraw) {
        this.msg('Your hands are busy — the rite waits for them.', '#888');
      }
      return false;
    }
    return true;
  }

  /** The same check with nothing to say: for buttons deciding whether to show. */
  riteAvailable(id?: string): boolean {
    if (id ? !findRite(id) || !(this.state.ritesKnown ?? []).includes(id) : !this.knownRites().length) return false;
    // Mid-stride is fine: the step finishes in the slowed world, and no new
    // one starts until the release (see beginRiteDraw).
    if (this.riteDraw || this.busy || this.anim.attack !== 'idle' || this.anim.cast || this.anim.stunT > 0) return false;
    const pool = this.run.conduit;
    if (!this.derived.conduit || !pool || pool.charges < RITE_CHARGE_COST) return false;
    if (this.player.stamina < RITE_STAMINA) return false;
    return true;
  }

  /**
   * Open the trace: the world slows and the overlay draws what follows.
   * Hands and feet stop until the release, so opening one mid-stride is
   * safe — the step you were taking is simply forgotten. An id pins the
   * trace to that one rite (the lab, and tests); without one, the mark is
   * read against every rite you know when it closes.
   */
  beginRiteDraw(id?: string): boolean {
    if (this.riteDraw || !this.riteReady(id)) return false;
    this.riteDraw = { rite: id ?? null, points: [] };
    this.held.clear();
    this.setBlock(false);
    Spells.breakChannels(this);
    this.sfx('sigil');
    return true;
  }

  /** One sampled point of the trace, in 0..1 across the view. */
  addRitePoint(x: number, y: number): void {
    const draw = this.riteDraw;
    if (!draw || !Number.isFinite(x) || !Number.isFinite(y)) return;
    // Thin long strokes instead of silently cutting off their final legs. In
    // place: the trace's fire knows a stroke by its array, and a new array
    // would read as a new stroke and wipe it mid-draw.
    const pts = draw.points;
    if (pts.length >= 1024) {
      let keep = 0;
      for (let i = 0; i < pts.length; i++) if (i % 2 === 0 || i === pts.length - 1) pts[keep++] = pts[i];
      pts.length = keep;
    }
    const last = draw.points[draw.points.length - 1];
    if (last && Math.hypot(x - last.x, y - last.y) < 0.004) return;
    draw.points.push({ x, y });
  }

  /** Drop an open trace unpaid: menus, pauses and mode changes take it, never the rite. */
  cancelRiteDraw(): void {
    this.riteDraw = null;
  }

  /** The rites an open trace is read against: the pinned one, else all you know. */
  riteCandidates(draw: { rite: string | null } | null = this.riteDraw): RiteDef[] {
    if (!draw) return [];
    const pinned = findRite(draw.rite);
    return pinned ? [pinned] : this.knownRites();
  }

  /**
   * Close the trace and pay for it. The stamina and two charges burn
   * whatever the trace grades — a botch backfires on top, it never refunds.
   */
  endRiteDraw(): boolean {
    const draw = this.riteDraw;
    this.riteDraw = null;
    if (!draw || draw.points.length === 0) return false;
    // A run that ended mid-trace (killed while the world was slowed) casts
    // nothing: the trace is dropped unpaid, and a botch cannot lift the dead.
    if (this.run.outcome !== 'active' || this.player.hp <= 0) return false;
    const read = recogniseRite(draw.points, this.riteCandidates(draw));
    if (!read) return false;
    const pool = this.run.conduit;
    if (!pool || pool.charges < RITE_CHARGE_COST) return false;
    this.player.stamina = Math.max(0, this.player.stamina - RITE_STAMINA);
    this.anim.sinceStamina = 0;
    const charges = RITE_CHARGE_COST;
    pool.charges -= charges;
    pool.regrow = 0;
    const { def, grade } = read;
    this.events.push({ type: 'rite', rite: def.id, grade, points: draw.points.map(p => ({ ...p })) });
    if (grade === 'botch') {
      this.msg(`The ${def.name} turns in your hands!`, '#ff6a50');
      Spells.botchedRite(this, def);
      return true;
    }
    if (def.id === 'glacial_tomb') Spells.castGlacialTomb(this, def, grade);
    else if (def.id === 'judgement') Spells.castJudgement(this, def, grade, charges);
    else if (def.id === 'penguining') Spells.castPenguining(this, def, grade);
    else Spells.castMeteor(this, def, grade, charges);
    return true;
  }

  /** Seconds banked toward fire's next bite, and since the last word about it. */
  fireTick = 0;
  surfaceMsgCd = 0;

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
    const count = Thrown.retrievableCount(this, base);
    if (!count) {
      this.msg(`No ${itemBase(base).name.toLowerCase()} left to retrieve.`, '#888');
      return false;
    }
    a.retrieving = { base, left: count, t: RETRIEVE_PER_SHAFT };
    this.msg(`You raise your hand. ${count} ${itemBase(base).name.toLowerCase()} to retrieve.`, '#c8b890');
    return true;
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
    const floor = Thrown.thrownOnFloors(this, base);
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
    if (this.riteDraw) return false;
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
   * A walkable tile next to (x, y) — never the tile itself, since something is
   * about to be put there that would cover a loot pile. Falls back to (x, y).
   */
  freeTileNear(x: number, y: number): { x: number; y: number } {
    const f = this.floor;
    const ok = (tx: number, ty: number) =>
      !blocksMove(f, tx, ty) && !portalAt(f, tx, ty);
    for (const d of DIRS) {
      const tx = x + DX[d], ty = y + DY[d];
      if (ok(tx, ty)) return { x: tx, y: ty };
    }
    return { x, y };
  }

  /** Bespoke legendaries this playthrough has turned up, oldest first. */
  get seenUniques(): string[] {
    return (this.state.lifetime.uniquesSeen ??= []);
  }

  /** Gear below this rarity drops identified: the Appraiser's second rank. */
  get identifyBelow(): Rarity | undefined {
    return metaLevel(this.state.meta, 'appraiser') >= 2 ? Rarity.Epic : undefined;
  }

  /** A container's loot, rolled with this run's depth, find and unlocks. */
  containerLoot(rng: Rng, tier: ContainerTier): LootRoll {
    return rollContainerLoot(rng, this.run.depth, this.lootFind, tier, this.identifyBelow, this.state.recipeRanks, this.seenUniques, this.difficultyId);
  }

  /** Relics this playthrough has identified, which is what opens a codex entry. */
  private get knownUniques(): string[] {
    return (this.state.lifetime.uniquesKnown ??= []);
  }

  /**
   * A spell tome, rolled where sigil stones roll but on its own `tome:` stream,
   * so adding tomes moved no chest's existing contents. Never one you know or
   * are already carrying anywhere, the same rule as a stone.
   */
  rollTome(stream: string, chance: number): Item | null {
    const carried = [
      ...this.state.stash.items,
      ...this.state.loadout.items,
      ...this.run.backpack.items,
      ...this.run.floors.flatMap((f) => f?.pickups.flatMap((p) => p.items) ?? []),
    ].filter((i) => i.kind === 'tome').map((i) => i.ref);
    const unknown = unknownConduitSpells(this.state.spellbook ?? [], carried);
    if (!unknown.length) return null;
    const rng = createRng(hashString(`tome:${this.run.seed}:${this.run.depth}:${stream}`));
    return rng.chance(chance) ? makeTome(rng.pick(unknown)) : null;
  }

  rollSigil(stream: string, chance: number): Item | null {
    const carried = [
      ...this.state.stash.items,
      ...this.state.loadout.items,
      ...this.run.backpack.items,
      ...this.run.floors.flatMap((f) => f?.pickups.flatMap((p) => p.items) ?? []),
    ].filter((i) => i.kind === 'sigil').map((i) => i.ref);
    // Temper mends worn gear, and on Normal nothing wears: it never drops there.
    const unknown = unknownSigils(this.state.spells ?? [], carried).filter((id) => this.diff.gearWears || id !== 'temper');
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

  dropLoot(x: number, y: number, items: Item[], gold: number): Pickup | null {
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
    const loot = this.containerLoot(this.propRng(p), tier);
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
      // Where nothing wears, a blow dents nothing either: it spills coin instead.
      const gear = this.diff.gearWears ? loot.items.filter((it) => it.kind === 'equipment' && durability(it).wears && durability(it).cur > 0) : [];
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
  shatterInChest(p: Prop): void {
    const heavy = this.derived.twoHanded || this.derived.damageType === 'blunt';
    const struck = createRng(hashString(`chest-strike:${this.floor.seed}:${p.id}:${this.chestBlows++}`));
    p.shattered = (p.shattered ?? 0) + (heavy && struck.chance(CHEST_SHATTER_HEAVY_EXTRA) ? 2 : 1);
  }

  /** Iron on iron carries: anything near enough comes to see what it was. */
  chestClang(p: Prop): void {
    let woken = 0;
    for (const e of this.floor.enemies) {
      if (e.ai === 'dead' || Boss.protectedByFog(this, e)) continue;
      if (manhattan(e.x, e.y, p.x, p.y) > EnemyAi.noise(this, CHEST_CLANG_RADIUS)) continue;
      if (e.alert <= 0) woken++;
      e.alert = Math.max(e.alert, 6);
      e.lastSeenX = this.player.x;
      e.lastSeenY = this.player.y;
    }
    if (woken) this.msg('The clang echoes down the halls. Something heard it.', '#ff9070');
  }

  /** Swap a disguised chest for the mimic inside it, holding the chest's reward. */
  wakeMimic(p: Prop, rise: number): EnemyState {
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

  /**
   * The held bite of a mimic you opened: nothing refuses it but armour.
   *
   * The first bite a save ever takes never kills, on any difficulty. Nothing
   * can be answered once the lid is up, so a death there teaches nothing; a
   * bite that leaves you on 1 health and names the tells teaches the chest.
   * "Ever" is the codex's worst hit from a mimic, so it needs no save field.
   */
  mimicBite(e: EnemyState): void {
    const def = Combat.view(this, e);
    this.sfx('swing', e.x, e.y);
    e.strikeT = 0;
    const was = bestiaryEntry(this.state.bestiary, def.id);
    const first = was.worstHit === 0 && was.deaths === 0;
    Combat.damagePlayer(this, 
      Math.max(1, Math.round(def.attack * MIMIC_BITE * attackPower(e.power) * this.diff.enemyDamage * this.diff.mimicBite)),
      def.damageType, e.x, e.y, def.name, def.id, e, true, this.diff.mimicMercy || first,
    );
    if (this.run.outcome !== 'active') return;
    this.msg('It chews, then spits you out. Get up!', '#ff9070');
    if (first) this.msg('That was no chest. A mimic breathes when you watch it, and shows two pale points in its lid seam; strike a chest you doubt before you open it.', '#ffd080');
  }

  /** In a mimic's jaws: every other action waits for the bite. */
  private get grabbed(): boolean {
    return this.floor.enemies.some((e) => (e.grabT ?? 0) > 0 && e.ai !== 'dead');
  }

  breakProp(p: Prop): void {
    if (p.oil) {
      Hazards.spillBarrel(this, p);
      return;
    }
    p.used = true;
    this.sfx('break', p.x, p.y);
    // Burrows: the crack of old roots is a lure. What hears it comes to the
    // cache, not to you — so break it and be somewhere else.
    if (p.kind === 'root_cache' && biomeForFloor(this.floor).law === 'noise') {
      let drawn = 0;
      for (const e of this.floor.enemies) {
        if (e.ai === 'dead' || e.lurk || manhattan(e.x, e.y, p.x, p.y) > ROOT_CACHE_LURE) continue;
        e.alert = Math.max(e.alert, 8);
        e.lastSeenX = p.x;
        e.lastSeenY = p.y;
        drawn++;
      }
      this.msg(drawn ? 'The roots crack like a shot. Something skitters towards the sound.' : 'The roots crack like a shot. Nothing answers.', LAWS.noise.color);
    }
    const loot = this.containerLoot(this.propRng(p), 'urn');
    this.dropLoot(p.x, p.y, loot.items, loot.gold);
  }

  /** What [F] would do right now, for the prompt. */
  interactionHint(): string | null {
    if (this.busy) return null;
    const f = this.floor;
    const t = this.frontTile();
    const door = doorAt(f, t.x, t.y);
    if (door) {
      if (isBossDoor(f, door) && door.locked && Boss.bossAlive(this)) return 'Sealed by fog';
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
      if (p.kind === 'carving') return 'Study the carving';
      if (p.kind === 'shrine') {
        // A stone that has already taken coin names its rising price and how
        // many offerings it has left, so the second and third are decisions.
        if (shrineKind(p) === 'coffer' && (p.offerings ?? 0) > 0) {
          const made = p.offerings ?? 0;
          return `${SHRINE_PROMPT.coffer(this.offeringCost(made))} (${COFFER_MAX_OFFERINGS - made} of ${COFFER_MAX_OFFERINGS} left)`;
        }
        return SHRINE_PROMPT[shrineKind(p)](this.offeringCost(p.offerings ?? 0));
      }
      if (isVessel(p)) return `Smash ${VESSELS[p.kind].label}`;
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
      const dist = manhattan(e.x, e.y, p.x, p.y);
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
    const spot = clear(front) ? front : this.freeTileNear(this.player.x, this.player.y);
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
    return this.portalNear('town_portal');
  }

  /** The boss's exit portal, if you are standing on it or facing it. */
  private portalHere(): Prop | undefined {
    return this.portalNear('portal');
  }

  private portalNear(kind: 'portal' | 'town_portal'): Prop | undefined {
    const t = this.frontTile();
    return portalAt(this.floor, t.x, t.y, kind) ?? portalAt(this.floor, this.player.x, this.player.y, kind);
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
    if (this.busy || this.moving || this.grabbed || this.riteDraw) return;
    const f = this.floor;
    const t = this.frontTile();

    const door = doorAt(f, t.x, t.y);
    if (door) {
      if (isBossDoor(f, door) && door.locked && Boss.bossAlive(this)) {
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
      if (isVessel(p)) {
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
          tier === 'vault' || tier === 'secret' ? 0.22 : 0.03 * clamp((this.run.depth - 1) / 4, 0, 1),
        );
        if (sigilDrop) loot.items.push(sigilDrop);
        const tomeDrop = this.rollTome(`chest:${p.id}`, tomeChance(tier, this.run.depth));
        if (tomeDrop) loot.items.push(tomeDrop);
        let pk = this.dropLoot(p.x, p.y, loot.items, 0);
        if ((tier === 'vault' || tier === 'secret') && (this.state.flask?.shards ?? 0) < 3 && createRng(hashString(`flask-shard:${f.seed}:${p.id}`)).chance(0.04)) {
          pk ??= { id: `shard_${p.id}`, x: p.x, y: p.y, items: [], gold: 0 };
          pk.flaskShard = true;
          if (!f.pickups.includes(pk)) f.pickups.push(pk);
        }
        if (loot.gold) {
          this.run.gold += loot.gold;
          this.run.stats.goldFound += loot.gold;
          this.emit({ type: 'float', x: p.x, y: p.y, text: `+${gold(loot.gold)}`, color: '#ffd24a' });
          this.sfx('gold');
        }
        if (pk) this.emit({ type: 'loot', pickupId: pk.id });
        else this.msg('The chest is empty.', '#888');
        return;
      }
      if (p.kind === 'shrine') {
        p.used = true;
        this.pray(p);
        // A refused prayer (too poor, too hurt) puts the shrine back unused.
        const pilgrim = runOath(this.run, 'pilgrim');
        if (p.used && pilgrim) {
          pilgrim.prayers = (pilgrim.prayers ?? 0) + 1;
          if (pilgrim.prayers === PILGRIM_PRAYERS) this.msg(`${PILGRIM_PRAYERS} shrines. The Pilgrim's oath is met: now bring it home.`, OATHS.pilgrim.color);
        }
        return;
      }
      if (p.kind === 'carving') {
        Features.studyCarving(this, p);
        return;
      }
    }

    const portal = this.portalHere();
    const town = this.townPortalHere();
    if (portal || town) {
      // No slipping out of the throne fight through a town portal: the fog
      // holds you until the King falls. His own exit portal only exists
      // after that, so it is never blocked.
      if (town && Boss.playerInThrone(this) && Boss.bossAlive(this)) {
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
      flask.charges = Math.min(flaskMax(this.state.flask?.shards ?? 0, this.diff.flaskBonus), flask.charges + 1);
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
    switch (shrineKind(p)) {
      // The safe one. A large mend and it washes off a curse — which is what
      // makes a font worth crossing a floor for once an idol has marked you.
      case 'font': {
        // Blood Price's Frailty is sworn, not suffered: the water leaves it.
        const sworn = !!runOath(this.run, 'blood_price') && this.run.curse === 'frailty';
        const lifted = sworn ? null : this.run.curse;
        if (!sworn) this.run.curse = null;
        if (sworn) this.msg('The water will not touch a sworn price. Frailty stays.', OATHS.blood_price.color);
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
        // A Pilgrim's idol is crueller: it curses far more often than it gives.
        if (this.rng.chance(runOath(this.run, 'pilgrim') ? 1 - PILGRIM_IDOL_CURSE : 0.65)) {
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
        this.emit({ type: 'float', x: p.x, y: p.y, text: `+${gold(prize)}`, color: '#ffd24a' });
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
  trialKill(id: string): void {
    const trial = this.run.trial;
    if (!trial) return;
    trial.ids = trial.ids.filter((t) => t !== id);
    if (trial.ids.length > 0) return;
    this.run.trial = null;
    const prize = 60 + 40 * this.run.depth;
    this.dropLoot(this.player.x, this.player.y, [], prize);
    this.emit({ type: 'float', x: this.player.x, y: this.player.y, text: `+${gold(prize)}`, color: '#ffd24a' });
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
      this.run.flask.charges = Math.min(flaskMax(this.state.flask.shards, this.diff.flaskBonus), this.run.flask.charges + 1);
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
        // Fight Milk stopped being drunk when the flask took over healing. A
        // bottle the flask can take is a forge infusion now; drinking it would
        // bypass the potency trade the infusion charges for. Legacy delves that
        // already drank keep their run.tonics effect until that run ends.
        if (draught(it.ref)) {
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
        if (Boss.playerInThrone(this) && Boss.bossAlive(this)) {
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
        if (enemyDef(target.def).behavior === 'boss') {
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
        this.placePlayer(dest.x, dest.y, dest.facing);
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
      // An infusion ingredient (Fight Milk) rides in the pack, not as a drink.
      // It is spent at the forge bench, so it never takes a quick-bar slot.
      if (draught(it.ref)) continue;
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

  /**
   * What is under your feet that you cannot look down at: pitch about to
   * catch, or fire already biting. The HUD shows it the way it shows
   * Threshold's ground, as light coming up off the bottom of the frame.
   */
  underfoot(): 'pitch' | 'fire' | null {
    const p = this.player;
    if (burningAt(this.floor, p.x, p.y)) return 'fire';
    return this.pitchFuses.some((fz) => fz.x === p.x && fz.y === p.y) ? 'pitch' : null;
  }

  fogWarned = false;

  /** Monsters winding up or mid-flurry this frame, for `DifficultyDef.maxAttackers`. */
  committed = 0;

  /** True while a raised guard can still turn a blow aside — the renderer's tell. */
  get parryWindow(): boolean {
    const base = PARRY_WINDOW * this.diff.parryWindow * (this.derived.conduitHand === 'offhand' ? CONDUIT_PARRY_WINDOW : 1);
    return (this.anim.parryArmed && this.anim.blockT <= base) || this.anim.rangedParryT > 0;
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
      if (manhattan(e.x, e.y, p.x, p.y) <= 8 && this.los(p.x, p.y, e.x, e.y)) out.add(e.id);
    }
    return out;
  }

  /** Remaining free backpack slots (for the HUD). */
  get freeSlots(): number {
    return freeSlots(this.run.backpack);
  }

  /** Carried light after temporary sigil effects. */
  get playerLightRadius(): number {
    if (this.anim.snuffT > 0) return 2.5;
    const lightless = this.run.seals?.includes('lightless') ? LIGHTLESS_LIGHT : 0;
    return Math.max(2.5, lightRadius(this.state.meta) + this.derived.traits.light - lightless);
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
    // A Stave casts from the weapon hand, so its stone lights there, for the
    // back half of the wind-up and the release, as a wand's does in the other.
    const a = this.anim;
    const c = this.derived.conduit;
    if (c && this.derived.conduitHand === 'weapon' && a.attackSpell
      && (a.attack === 'recover' || (a.attack === 'windup' && a.attackT > a.attackDur * 0.5))) {
      return { id: c.castViewmodel, materialId: w.materialId };
    }
    return { id: viewmodelFor(itemBase(w.ref)), materialId: w.materialId };
  }
}

export { PITCH_EVERY, PITCH_FUSE, SHADOW_STEP_EVERY, SHADOW_STEP_SECONDS } from './boss';

export { GLACIAL_TOMB_SECONDS, GLACIAL_TOMB_SIGHT_SECONDS, JUDGEMENT_POWER_PER_CHARGE, JUDGEMENT_SPARE_HP, METEOR_FALL_SECONDS, METEOR_POWER_PER_CHARGE, RITE_BOTCH_FREEZE, RITE_SIGHT, SPELL_FX_SECONDS, judgementEnds } from './spells';
