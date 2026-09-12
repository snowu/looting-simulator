import { Rng, createRng, hashString } from '../core/rng';
import { Dir, DIR_NAMES, DIRS, DX, DY, dirOf, turnAround, turnLeft, turnRight } from '../core/dir';
import { DamageType, EnemyDef, EquipSlot, Item } from '../types';
import { GameState, RunState } from '../state/game-state';
import { addItem, canFit, findItem, removeItem, roomFor } from '../state/inventory';
import {
  EnemyState,
  Floor,
  FLOOR,
  Pickup,
  Prop,
  ShrineKind,
  blocksMove,
  blocksSight,
  createEnemy,
  doorAt,
  enemyAt,
  generateFloor,
  propAt,
  secretAt,
  stairsAt,
  stairsFront,
  Trap,
  TrapKind,
  trapAt,
} from '../systems/dungeon';
import { enemyDef } from '../data/enemies';
import { consumable, itemBase } from '../data/items';
import { biomeForDepth, FINAL_DEPTH } from '../data/biomes';
import { PlayerDerived, derivePlayer } from '../systems/player';
import { enemyHitsPlayer, playerHitsEnemy, staminaPower } from '../systems/combat';
import { durability, identify, itemName, makeMaterial, rollContainerLoot, rollEnemyLoot, wearItem } from '../systems/items';
import { recordDepth, recordKill } from '../systems/contracts';
import { metaLevel } from '../systems/meta';
import { Rarity } from '../types';
import type { SfxName } from '../audio/sfx';

// ---------------------------------------------------------------------------
// Events the world emits for the renderer / UI / audio to react to.
// ---------------------------------------------------------------------------

export type WorldEvent =
  | { type: 'msg'; text: string; color?: string }
  | { type: 'sfx'; name: SfxName; x?: number; y?: number }
  | { type: 'hurt'; amount: number; blocked: boolean }
  | { type: 'float'; x: number; y: number; text: string; color: string }
  | { type: 'shake'; amount: number }
  | { type: 'loot'; pickupId: string }
  | { type: 'floor' }
  | { type: 'end'; outcome: 'dead' | 'extracted' }
  | { type: 'secret'; x: number; y: number }
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
  /** Parried back at them: now it hits monsters instead of passing through. */
  reflected?: boolean;
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
  blockRaise: number;
  /** Seconds the guard has been up, or Infinity while it is down. */
  blockT: number;
  /** Whether this particular raise got a parry window (it was off cooldown). */
  parryArmed: boolean;
  /** Time until another parry window can open, so mashing block isn't a parry. */
  parryCd: number;
  steps: number;
  sinceStamina: number;
  /** Throttles the winded cue so a held attack button can't spam it. */
  windedCd: number;
  recall: number | null;
  transition: { t: number; dir: 'down' | 'up'; done: boolean } | null;
}

const STEP_TIME = 0.24;
const TURN_TIME = 0.17;
/** Pause between repeated turns while a turn is held, so you can stop where you want. */
const TURN_REPEAT = 0.16;
const STAMINA_REGEN = 34;
const STAMINA_DELAY = 0.5;

/**
 * Parry. Raising the guard opens a short window; a hit that lands inside it is
 * denied outright rather than absorbed. The cooldown is what stops mashing the
 * block key from being a permanent parry — at best you get one attempt per
 * PARRY_COOLDOWN, so it has to be timed against the wind-up you can see.
 */
const PARRY_WINDOW = 0.22;
const PARRY_COOLDOWN = 0.75;
/** How long a parried melee attacker is left open, and how much harder it takes hits. */
const PARRY_STUN = 1;
const PARRY_VULN_MULT = 2;

/** Compact button label for an interaction hint. */
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
  fortune: { name: 'Fortune', text: '+30% loot find this run.' },
  fury: { name: 'Fury', text: '+25% damage this run.' },
  ward: { name: 'Warding', text: '+5 defense this run.' },
};

/**
 * The other half of the bargain. A curse lasts the run like a blessing does,
 * and the two are independent — you can carry both. A Font of Mending lifts
 * one, which is what makes finding a font worth something once you are cursed.
 */
export const CURSES: Record<string, { name: string; text: string }> = {
  frailty: { name: 'Frailty', text: '−15% maximum health this run.' },
  leaden: { name: 'Leaden Limbs', text: '−12 speed this run.' },
  dulled: { name: 'Dulled Edge', text: '−20% damage this run.' },
  hunted: { name: 'Hunted', text: 'Monsters see you two tiles further this run.' },
};

/** What [F] says at each shrine, so you know what you are touching. */
export const SHRINE_PROMPT: Record<ShrineKind, (cost: number) => string> = {
  font: () => 'Drink at the font',
  idol: () => 'Pray at the hollow idol',
  coffer: (cost) => `Offer ${cost} gold at the stone`,
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
      attack: 'idle', attackT: 0, attackDur: 0, attackPower: 1, blockRaise: 0, blockT: Infinity, parryArmed: false, parryCd: 0, steps: 0,
      sinceStamina: 10, windedCd: 0, recall: null, transition: null,
    };
    this.reveal();
  }

  get floor(): Floor {
    return this.run.floors[this.run.depth - 1]!;
  }

  get player() {
    return this.run.player;
  }

  refreshDerived(): void {
    this.derived = derivePlayer(this.state.equipment, this.state.meta);
    if (this.run.blessing === 'fury') this.derived.attack = Math.round(this.derived.attack * 1.25);
    if (this.run.blessing === 'fortune') this.derived.find += 30;
    if (this.run.blessing === 'ward') this.derived.stats.defense += 5;
    if (this.run.curse === 'frailty') this.derived.maxHp = Math.max(1, Math.round(this.derived.maxHp * 0.85));
    if (this.run.curse === 'leaden') this.derived.stats.speed -= 12;
    if (this.run.curse === 'dulled') this.derived.attack = Math.max(1, Math.round(this.derived.attack * 0.8));
    this.player.hp = Math.min(this.player.hp, this.derived.maxHp);
    this.player.stamina = Math.min(this.player.stamina, this.derived.maxStamina);
  }

  /**
   * Wear a piece of equipment and say something only when it crosses a line:
   * once when it is nearly gone, once when it goes. A message per swing would
   * be noise, and noise is how a player learns to stop reading the log.
   */
  private wear(slot: EquipSlot, amount = 1): void {
    const it = this.state.equipment[slot];
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
    if (worn.length) this.wear(this.rng.pick(worn));
  }

  /** Extra tiles of sight the floor has on you, from the Hunted curse. */
  private get sightPenalty(): number {
    return this.run.curse === 'hunted' ? 2 : 0;
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
    return this.run.outcome !== 'active' || !!this.anim.transition;
  }

  get moving(): boolean {
    return this.anim.moveT < 1 || this.anim.turnT < 1;
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
    const wantBlock = this.held.has('block') && a.attack === 'idle';
    a.parryCd = Math.max(0, a.parryCd - dt);
    if (wantBlock) {
      if (a.blockT === Infinity) {
        // Rising edge: this raise gets a window only if we're off cooldown.
        a.blockT = 0;
        a.parryArmed = a.parryCd <= 0;
        if (a.parryArmed) a.parryCd = PARRY_COOLDOWN;
      } else {
        a.blockT += dt;
      }
    } else {
      a.blockT = Infinity;
      a.parryArmed = false;
    }
    a.blockRaise = Math.max(0, Math.min(1, a.blockRaise + (wantBlock ? dt : -dt) / 0.12));

    // Next movement, from the queue or held keys.
    if (!this.moving && a.transition === null) {
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
        a.attackDur = this.derived.swing.recovery;
      } else if (a.attack === 'recover' && a.attackT >= a.attackDur) {
        a.attack = 'idle';
      }
    }

    // Stamina recovers; health never does on its own (potions, shrines, leech only).
    a.windedCd = Math.max(0, a.windedCd - dt);
    a.sinceStamina += dt;
    if (a.sinceStamina > STAMINA_DELAY && a.attack === 'idle') {
      const rate = a.blockRaise > 0.5 ? STAMINA_REGEN * 0.3 : STAMINA_REGEN;
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
    const p = this.player;
    this.anim.steps++;
    this.sfx('step');
    this.reveal();
    const f = this.floor;
    const trap = trapAt(f, p.x, p.y);
    if (trap && trap.armed) {
      this.springTrap(trap, null);
      if (this.run.outcome !== 'active') return;
    }
    const s = stairsAt(f, p.x, p.y);
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
    this.floor.pickups = this.floor.pickups.filter((q) => q.items.length > 0 || q.gold > 0 || q.keyId);
  }

  // -------------------------------------------------------------------------
  // Floors
  // -------------------------------------------------------------------------

  private changeFloor(dir: 'down' | 'up'): void {
    const run = this.run;
    run.depth += dir === 'down' ? 1 : -1;
    if (!run.floors[run.depth - 1]) run.floors[run.depth - 1] = generateFloor(run.seed, run.depth);
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
    if (dir === 'down' && run.depth > run.stats.deepest) {
      run.stats.deepest = run.depth;
      recordDepth(this.state.contracts, run.depth);
    }
    this.reveal();
    const biome = biomeForDepth(run.depth);
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
    return 2 + (metaLevel(this.state.meta, 'lantern') > 0 ? 1 : 0);
  }

  /**
   * Notice the seam in the flagstones on the tile in front of you. Only the
   * tile you are about to step onto and the ones beside you, so a corridor
   * taken at a run is a corridor taken blind.
   */
  private spotTraps(): void {
    const f = this.floor;
    if (!f.traps?.length) return;
    const p = this.player;
    const look: { x: number; y: number }[] = [];
    for (let d = 1; d <= this.lookAhead; d++) look.push(this.frontTile(d));
    for (const d of DIRS) look.push({ x: p.x + DX[d], y: p.y + DY[d] });
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
    this.damagePlayer(damage, def.damageType, trap.x, trap.y, def.source);
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
    if (!a.parryArmed || a.blockT > PARRY_WINDOW) return false;
    return this.facingSource(fromX, fromY);
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
    if (this.busy || a.attack !== 'idle') return;
    // A swing has to be paid for in full. This used to clamp at zero and land
    // anyway at staminaPower's 40% floor, so a spent player could attack for
    // free forever. Gating on "any stamina at all" is not enough either: the
    // trickle of regen at the tail of each recovery is always a sliver above
    // zero, which kept the free swings coming. How tired you are still shows
    // in the damage, through staminaPower — it just is not free any more.
    const cost = this.derived.swing.staminaCost;
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
    a.attackDur = this.derived.swing.windup;
    a.blockRaise = 0;
    this.rockAndStone();
    if (a.recall !== null) {
      a.recall = null;
      this.msg('The recall fizzles.', '#888');
    }
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
    this.sfx('swing');
    for (let d = 1; d <= this.derived.swing.reach; d++) {
      const t = this.frontTile(d);
      const e = enemyAt(f, t.x, t.y);
      if (e) {
        this.hitEnemy(e);
        return;
      }
      const p = propAt(f, t.x, t.y);
      if (p && d === 1 && (p.kind === 'urn' || p.kind === 'barrel') && !p.used) {
        this.breakProp(p);
        return;
      }
      if (blocksSight(f, t.x, t.y)) break;
    }
    this.sfx('miss');
  }

  private hitEnemy(e: EnemyState): void {
    this.wear('weapon');
    const def = enemyDef(e.def);
    const hit = playerHitsEnemy(this.rng, this.derived, this.anim.attackPower, def);
    // Everything you land while the parry opening lasts hits twice as hard.
    const exposed = !!e.vuln && e.vuln > 0;
    if (exposed) hit.damage = Math.round(hit.damage * PARRY_VULN_MULT);
    e.hp -= hit.damage;
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
      const heal = Math.max(1, Math.round((hit.damage * this.derived.stats.leech) / 100));
      this.player.hp = Math.min(this.derived.maxHp, this.player.hp + heal);
    }
    // Lighter foes are staggered out of their wind-up.
    if (e.ai === 'windup' && def.hp < 40 && def.behavior !== 'boss') {
      e.ai = 'recover';
      e.timer = 0.5;
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: EnemyState): void {
    const def = enemyDef(e.def);
    e.hp = 0;
    e.ai = 'dead';
    e.deadT = 0;
    this.run.stats.kills++;
    recordKill(this.state.contracts, def.id);
    this.sfx('enemyDie', e.x, e.y);
    const idBelow = metaLevel(this.state.meta, 'appraiser') >= 2 ? Rarity.Epic : undefined;
    const loot = e.mimicTier && e.mimicPropId
      ? rollContainerLoot(createRng(hashString(`${this.floor.seed}:${e.mimicPropId}`)), this.run.depth, this.derived.find, e.mimicTier, idBelow, this.state.recipeRanks)
      : rollEnemyLoot(this.rng, def, this.run.depth, this.derived.find, idBelow, this.state.recipeRanks);
    if (def.behavior === 'boss') {
      // The portal opens where the king fell, so his hoard goes beside it —
      // dropped on the same tile it would be unreachable behind the portal.
      const spot = this.freeTileNear(e.x, e.y, true);
      this.dropLoot(spot.x, spot.y, loot.items, loot.gold);
      this.run.stats.bossKilled = true;
      this.msg('The Ashen King crumbles to cinders. A portal tears open.', '#c080ff');
      this.floor.props.push({ id: `portal${this.time}`, kind: 'portal', x: e.x, y: e.y, used: false, tier: 'none', blocking: false, mimic: false });
    } else {
      this.dropLoot(e.x, e.y, loot.items, loot.gold);
      this.msg(`${def.name} slain.`, '#c8c0b0');
    }
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

  private breakProp(p: Prop): void {
    p.used = true;
    this.sfx('break', p.x, p.y);
    const idBelow = metaLevel(this.state.meta, 'appraiser') >= 2 ? Rarity.Epic : undefined;
    const loot = rollContainerLoot(this.propRng(p), this.run.depth, this.derived.find, 'urn', idBelow, this.state.recipeRanks);
    this.dropLoot(p.x, p.y, loot.items, loot.gold);
  }

  /** What [F] would do right now, for the prompt. */
  interactionHint(): string | null {
    if (this.busy) return null;
    const f = this.floor;
    const t = this.frontTile();
    const door = doorAt(f, t.x, t.y);
    if (door) {
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
      if (p.kind === 'shrine') return SHRINE_PROMPT[p.shrine ?? 'font'](this.offeringCost());
      if (p.kind === 'urn' || p.kind === 'barrel') return `Smash ${p.kind}`;
    }
    // A pile sharing the portal's tile wins the prompt, so loot that ended up
    // under a portal (as boss drops used to) can still be picked up.
    const portal = this.portalHere();
    if (portal) return this.pickupNear() ? 'Search' : 'Step through the portal';
    if (this.townPortalHere()) return this.pickupNear() ? 'Search' : 'Step through to Bleakmere';
    const s = stairsAt(f, t.x, t.y);
    if (s) return s.down ? `Descend to depth ${this.run.depth + 1}` : this.run.depth === 1 ? 'Leave the dungeon' : `Climb to depth ${this.run.depth - 1}`;
    if (this.pickupNear()) return 'Search';
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
      if (blocksSight(f, t.x, t.y)) break;
    }
    const hint = this.interactionHint();
    if (!hint || hint.startsWith('Smash') || hint === 'Close door') return { kind: 'attack', label: '' };
    // A pile underfoot must never steal the swing: killing the first of two
    // monsters drops loot on your tile, and on touch that turned every tap
    // into the loot window instead of a hit on the second one. Doors, stairs
    // and portals still win, since running is a legitimate answer to a fight.
    if (hint === 'Search' && this.threatNear()) return { kind: 'attack', label: '' };
    return { kind: 'interact', label: shortLabel(hint) };
  }

  /** Something alive and interested, close enough that you are still in a fight. */
  private threatNear(): boolean {
    const p = this.player;
    for (const e of this.floor.enemies) {
      if (e.ai === 'dead') continue;
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
      f.pickups.find((p) => p.x === this.player.x && p.y === this.player.y && p.items.length) ??
      f.pickups.find((p) => p.x === t.x && p.y === t.y && p.items.length && !blocksSight(f, t.x, t.y))
    );
  }

  interact(): void {
    if (this.busy || this.moving) return;
    const f = this.floor;
    const t = this.frontTile();

    const door = doorAt(f, t.x, t.y);
    if (door) {
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
      if (p.kind === 'urn' || p.kind === 'barrel') {
        this.breakProp(p);
        return;
      }
      if (p.kind === 'chest') {
        const tier = p.tier === 'none' ? 'chest' : p.tier;
        if (p.mimic) {
          f.props = f.props.filter((q) => q !== p);
          const mimic = createEnemy(enemyDef('mimic'), p.x, p.y, turnAround(this.player.facing), `mimic:${p.id}`, this.run.depth);
          mimic.ai = 'recover';
          mimic.timer = 0.65;
          mimic.alert = 6;
          mimic.lastSeenX = this.player.x;
          mimic.lastSeenY = this.player.y;
          mimic.mimicTier = tier;
          mimic.mimicPropId = p.id;
          f.enemies.push(mimic);
          this.sfx('alert', p.x, p.y);
          this.emit({ type: 'shake', amount: 0.35 });
          this.msg('The chest sprouts legs and splits into a hungry grin!', '#e8c080');
          return;
        }
        p.used = true;
        this.sfx('chest', p.x, p.y);
        const idBelow = metaLevel(this.state.meta, 'appraiser') >= 2 ? Rarity.Epic : undefined;
        const loot = rollContainerLoot(this.propRng(p), this.run.depth, this.derived.find, tier, idBelow, this.state.recipeRanks);
        const pk = this.dropLoot(p.x, p.y, loot.items, 0);
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
      this.press('forward');
      return;
    }

    const pk = this.pickupNear();
    if (pk) this.emit({ type: 'loot', pickupId: pk.id });
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
  offeringCost(): number {
    return 30 + 25 * this.run.depth;
  }

  private restore(): void {
    this.player.hp = this.derived.maxHp;
    this.player.stamina = this.derived.maxStamina;
  }

  private grantBlessing(): boolean {
    if (this.run.blessing) return false;
    const id = this.rng.pick(Object.keys(BLESSINGS));
    this.run.blessing = id;
    this.refreshDerived();
    this.msg(`Blessing of ${BLESSINGS[id].name}: ${BLESSINGS[id].text}`, '#a0c8ff');
    return true;
  }

  private pray(p: Prop): void {
    this.sfx('magic');
    switch (p.shrine ?? 'font') {
      // The safe one. Restores you outright, and washes off a curse — which is
      // what makes a font worth crossing a floor for once an idol has marked you.
      case 'font': {
        const lifted = this.run.curse;
        this.run.curse = null;
        this.refreshDerived();
        this.restore();
        if (lifted) this.msg(`The water runs black and clears. ${CURSES[lifted].name} is washed away.`, '#a0c8ff');
        else this.msg('Cold clean water. You are whole again.', '#a0c8ff');
        return;
      }

      // The gamble. Six times in ten it gives; the rest of the time it takes,
      // and what it takes lasts the rest of the run.
      case 'idol': {
        if (this.rng.chance(0.6)) {
          this.restore();
          if (!this.grantBlessing()) this.msg('The idol is satisfied. You are restored.', '#a0c8ff');
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

      // The honest one: a fixed price for a certain thing.
      case 'coffer': {
        const cost = this.offeringCost();
        if (this.run.gold < cost) {
          // Not consumed — come back with the coin.
          p.used = false;
          this.msg(`The bowl is empty and stays empty. It wants ${cost} gold.`, '#c8a060');
          this.sfx('locked', p.x, p.y);
          return;
        }
        this.run.gold -= cost;
        this.restore();
        if (!this.grantBlessing()) this.msg('The coin vanishes. You are restored.', '#e8c060');
        this.sfx('gold');
        return;
      }
    }
  }

  /** Move items from a pickup into the backpack. Returns how many stacks moved. */
  take(pickupId: string, uid?: string): number {
    const pk = this.floor.pickups.find((p) => p.id === pickupId);
    if (!pk) return 0;
    let moved = 0;
    for (const it of [...pk.items]) {
      if (uid && it.uid !== uid) continue;
      const before = it.qty;
      const left = addItem(this.run.backpack, it);
      if (left < before) moved++;
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

  drop(uid: string): void {
    const it = removeItem(this.run.backpack, uid);
    if (!it) return;
    this.dropLoot(this.player.x, this.player.y, [it], 0);
    this.sfx('ui');
  }

  use(uid: string): void {
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
        this.player.hp = Math.min(this.derived.maxHp, this.player.hp + Math.round(this.derived.maxHp * e.fraction));
        this.sfx('drink');
        break;
      case 'stamina':
        this.player.stamina = this.derived.maxStamina;
        this.sfx('drink');
        break;
      case 'identify': {
        const target = this.run.backpack.items.find((i) => i.kind === 'equipment' && i.identified === false);
        if (!target) {
          this.msg('Nothing in your pack needs identifying.', '#888');
          return;
        }
        identify(target);
        this.msg(`It is: ${itemName(target)}.`, '#c8b8ff');
        this.sfx('magic');
        break;
      }
      case 'recall':
        if (this.anim.recall !== null) return;
        this.anim.recall = e.seconds;
        this.msg(
          this.run.portal ? 'You read the scroll. The old portal will collapse...' : 'You read the scroll. Stand still...',
          '#9ac0ff',
        );
        this.sfx('magic');
        break;
    }
    it.qty -= 1;
    if (it.qty <= 0) removeItem(this.run.backpack, uid);
  }

  /** Quick-slot use: nth distinct consumable in the pack. */
  quickUse(slot: number): void {
    const seen: string[] = [];
    for (const it of this.run.backpack.items) {
      if (it.kind !== 'consumable' || seen.includes(it.ref)) continue;
      seen.push(it.ref);
      if (seen.length - 1 === slot) {
        this.use(it.uid);
        return;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Enemies
  // -------------------------------------------------------------------------

  private occupied(x: number, y: number, self: EnemyState): boolean {
    if (x === this.player.x && y === this.player.y) return true;
    return this.floor.enemies.some((o) => o !== self && o.ai !== 'dead' && o.x === x && o.y === y);
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

  private updateEnemies(dt: number): void {
    const f = this.floor;
    const p = this.player;
    for (const e of f.enemies) {
      if (e.ai === 'dead') {
        e.deadT += dt;
        continue;
      }
      const def = enemyDef(e.def);
      e.hurtT = Math.max(0, e.hurtT - dt);
      e.attackCd -= dt;
      if (e.vuln) e.vuln = Math.max(0, e.vuln - dt);
      if (e.moveT < 1) {
        e.moveT = Math.min(1, e.moveT + dt / def.step);
        if (e.moveT < 1) continue;
      }
      const dist = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
      const sees = dist <= def.sight + this.sightPenalty && this.los(e.x, e.y, p.x, p.y);
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
    e.ai = 'windup';
    e.timer = def.windup;
    e.lastSeenX = tx;
    e.lastSeenY = ty;
  }

  private enemyStrike(e: EnemyState, def: EnemyDef): void {
    e.ai = 'recover';
    e.timer = def.recovery;
    e.attackCd = def.recovery + 0.2;
    const p = this.player;
    const dist = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
    const useRanged = !!def.projectile && (def.behavior === 'ranged' || (def.behavior === 'boss' && dist >= 2));
    if (useRanged) {
      const dx = Math.sign(e.lastSeenX - e.x), dy = Math.sign(e.lastSeenY - e.y);
      if (dx !== 0 && dy !== 0) return;
      const pr = def.projectile!;
      const shots = def.behavior === 'boss' ? [0, -1, 1] : [0];
      for (const off of shots) {
        const ox = dy !== 0 ? off : 0, oy = dx !== 0 ? off : 0;
        if (off !== 0 && blocksSight(this.floor, e.x + ox, e.y + oy)) continue;
        this.projectiles.push({
          id: this.projN++, x: e.x + ox + 0.5, y: e.y + oy + 0.5, dx, dy, speed: pr.speed,
          damage: Math.round(def.attack * e.power), type: pr.damageType, sprite: pr.sprite, light: pr.light,
          tileX: e.x + ox, tileY: e.y + oy, source: def.name,
        });
      }
      this.sfx(pr.sprite === 'proj_arrow' ? 'shoot' : 'magic', e.x, e.y);
      return;
    }
    // Melee lands only if you're still in the tile it aimed at.
    this.sfx('swing', e.x, e.y);
    if (p.x === e.lastSeenX && p.y === e.lastSeenY && dist === 1) {
      this.damagePlayer(Math.round(def.attack * e.power), def.damageType, e.x, e.y, def.name, e);
    } else {
      this.sfx('miss', e.x, e.y);
    }
  }

  private damagePlayer(attack: number, type: DamageType, fromX: number, fromY: number, source: string, attacker?: EnemyState): void {
    const p = this.player;
    // A parry denies the hit outright and leaves the attacker open.
    if (this.parries(fromX, fromY)) {
      this.parryFlourish(fromX, fromY);
      if (attacker) {
        const def = enemyDef(attacker.def);
        attacker.ai = 'recover';
        // Never shorter than the recovery it would have had anyway.
        attacker.timer = Math.max(attacker.timer, PARRY_STUN);
        attacker.attackCd = Math.max(attacker.attackCd, PARRY_STUN + 0.2);
        attacker.vuln = PARRY_STUN;
        this.msg(`You turn the ${def.name}'s blow aside. It reels — strike now!`, '#ffe8a0');
      } else {
        this.msg('You turn the blow aside.', '#ffe8a0');
      }
      return;
    }
    let dmg = enemyHitsPlayer(this.rng, attack, type, this.derived);
    const facingSource = this.facingSource(fromX, fromY);
    let blocked = false;
    if (this.anim.blockRaise > 0.6 && facingSource) {
      const absorbed = dmg * this.derived.block;
      const cost = absorbed * 1.3;
      if (p.stamina >= cost) {
        p.stamina -= cost;
        dmg = Math.round(dmg - absorbed);
        blocked = true;
        // Blocking grinds the shield down; a parry costs it nothing, which is
        // one more reason to meet the swing instead of hiding behind it.
        if (this.derived.hasShield) this.wear('offhand');
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
    if (dmg > 0 && !blocked) this.wearArmour();
    p.hp -= dmg;
    this.emit({ type: 'hurt', amount: dmg, blocked });
    this.emit({ type: 'shake', amount: blocked ? 0.3 : Math.min(1, dmg / 20) });
    if (dmg > 0 && !blocked) this.sfx('hurt');
    if (p.hp <= 0) {
      p.hp = 0;
      this.run.killedBy = source;
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
      const tx = Math.floor(pr.x), ty = Math.floor(pr.y);
      if (tx === pr.tileX && ty === pr.tileY) continue;
      pr.tileX = tx;
      pr.tileY = ty;
      if (blocksSight(f, tx, ty)) {
        pr.speed = 0;
        this.sfx('break', tx, ty);
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
        if (this.parries(tx - pr.dx, ty - pr.dy)) {
          this.reflect(pr);
          continue;
        }
        pr.speed = 0;
        this.damagePlayer(pr.damage, pr.type, tx - pr.dx, ty - pr.dy, pr.source);
      }
    }
    this.projectiles = this.projectiles.filter((pr) => pr.speed > 0);
  }

  /** Send a bolt back the way it came, now hostile to whatever shot it. */
  private reflect(pr: Projectile): void {
    this.parryFlourish(this.player.x, this.player.y);
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

  /** A reflected bolt landing on a monster: its own damage, its own element. */
  private reflectedHit(pr: Projectile, e: EnemyState): void {
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
    return this.anim.parryArmed && this.anim.blockT <= PARRY_WINDOW;
  }

  facingName(): string {
    return DIR_NAMES[this.player.facing];
  }

  /** Living enemies the player can currently see (for the map). */
  visibleEnemies(): Set<string> {
    const out = new Set<string>();
    const p = this.player;
    for (const e of this.floor.enemies) {
      if (e.ai === 'dead') continue;
      if (Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= 8 && this.los(p.x, p.y, e.x, e.y)) out.add(e.id);
    }
    return out;
  }

  /** Remaining free backpack slots (for the HUD). */
  get freeSlots(): number {
    return this.run.backpack.capacity - this.run.backpack.items.length;
  }

  /** Base item info for the viewmodel. */
  weaponArt(): { id: string; materialId?: string } {
    const w = this.state.equipment.weapon;
    if (!w) return { id: 'vm_fist' };
    const cls = itemBase(w.ref).weaponClass;
    const id = cls === 'axe' ? 'vm_axe' : cls === 'pick' ? 'vm_pick' : cls === 'blunt' ? 'vm_blunt' : cls === 'spear' ? 'vm_spear' : 'vm_blade';
    return { id, materialId: w.materialId };
  }
}
