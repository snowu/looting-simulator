/*
 * Headless playtest harness.
 *
 * docs/NEXT.md asks for this before any balance knob is touched: "Balance work
 * without numbers is vibes." It plays N seeded runs with one scripted policy and
 * reports distributions, so two builds can be compared rather than argued about.
 *
 * The bot is not a good player. It is a *consistent* one, which is the only
 * property that makes a before/after number mean anything. It sees the whole
 * floor (no exploration model), walks straight at what it wants, fights what
 * gets in the way, and goes home when it is hurt or full.
 */
import { createRng, Rng } from '../src/core/rng';
import { DIRS, DX, DY, Dir } from '../src/core/dir';
import { newGame } from '../src/state/game-state';
import { DifficultyId } from '../src/data/difficulty';
import { GameState } from '../src/state/game-state';
import { startRun, endRun, syncLoadout } from '../src/systems/run';
import { addItem, removeItem } from '../src/state/inventory';
import { World, WorldEvent } from '../src/world/world';
import { Floor, EnemyState, blocksMove, propAt, doorAt, tileAt, inBounds, FLOOR } from '../src/systems/dungeon';
import { enemyDef, BOSS_ID } from '../src/data/enemies';
import { FINAL_DEPTH } from '../src/data/biomes';
import { itemValue } from '../src/systems/items';
import { Item, Rarity, RARITY_ORDER } from '../src/types';
import { derivePlayer, Equipment } from '../src/systems/player';
import { MetaLevels, META_UPGRADES } from '../src/systems/meta';
import { durability } from '../src/systems/items';

const DT = 1 / 60;

export interface Policy {
  /** Probability of timing a real parry when an adjacent enemy winds up. */
  parrySkill: number;
  /** Drink below this fraction of max health. */
  drinkAt: number;
  /** Turn back for the stairs up below this fraction of max health. */
  fleeAt: number;
  /** Deepest floor this bot will try for. */
  targetDepth: number;
  /** Real seconds of sim allowed per floor before it gives up and moves on. */
  floorBudget: number;
  /** Loot urns as well as chests. */
  lootUrns: boolean;
  /** Seek the Ashen King on depth six before leaving. */
  fightBoss?: boolean;
  /** Collects a line per decision. Debugging only — it is very noisy. */
  trace?: string[];
}

export const DEFAULT_POLICY: Policy = {
  parrySkill: 0.35,
  drinkAt: 0.5,
  fleeAt: 0.22,
  targetDepth: 6,
  floorBudget: 300,
  lootUrns: true,
};

export interface RunReport {
  seed: number;
  outcome: 'dead' | 'extracted' | 'timeout';
  depth: number;
  deepest: number;
  bossKilled: boolean;
  killedBy?: string;
  kills: number;
  time: number;
  gold: number;
  renown: number;
  itemsKept: number;
  valueKept: number;
  damageTaken: Record<string, number>;
  sips: number;
  morselsEaten: number;
  morselsRotted: number;
  parries: number;
  hitsTaken: number;
  blockedHits: number;
  trapsSprung: number;
  /** What the pack was carrying when it was dropped. Only a death loses anything. */
  itemsLost: number;
  valueLost: number;
  /** Most backpack slots occupied at any point, against the pack's capacity. */
  peakSlots: number;
  capacity: number;
  brokenAtEnd: number;
  perFloor: FloorReport[];
}

export interface FloorReport {
  depth: number;
  time: number;
  kills: number;
  enemies: number;
  containersLooted: number;
  containersTotal: number;
  items: number;
  hpLost: number;
  hpFracAtExit: number;
  /** Morsels whose chew started, and the share of max health they carried. */
  morsels: number;
  food: number;
}

// --- navigation --------------------------------------------------------------

/**
 * Passability for *planning*. `blocksMove` is the truth for a step that is
 * happening now, and it counts a shut door as a wall — correct in the sim, and
 * useless to a planner, which needs to know that the door is a door and can be
 * opened. Locked doors stay closed to the planner until the key is in hand.
 */
function passable(f: Floor, x: number, y: number, keys: string[]): boolean {
  if (!inBounds(f, x, y)) return false;
  if (tileAt(f, x, y) !== FLOOR) return false;
  const d = doorAt(f, x, y);
  if (d && !d.open && d.locked && !(d.keyId && keys.includes(d.keyId))) return false;
  const p = propAt(f, x, y);
  // Urns and barrels are smashed through; chests and shrines are walked around.
  if (p && p.blocking && p.kind !== 'urn' && p.kind !== 'barrel' && p.kind !== 'root_cache') return false;
  return true;
}

function bfsFrom(f: Floor, sx: number, sy: number, keys: string[] = []): Int32Array {
  const W = f.width, H = f.height;
  const dist = new Int32Array(W * H).fill(-1);
  const q = [sy * W + sx];
  dist[sy * W + sx] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = (i / W) | 0;
    for (const d of DIRS) {
      const nx = x + DX[d], ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (dist[n] >= 0) continue;
      if (!passable(f, nx, ny, keys)) continue;
      dist[n] = dist[i] + 1;
      q.push(n);
    }
  }
  return dist;
}

/** First step of a shortest path from the player toward (tx,ty), or null. */
function stepToward(f: Floor, px: number, py: number, tx: number, ty: number, keys: string[] = []): [number, number] | null {
  const W = f.width;
  const dist = bfsFrom(f, tx, ty, keys);
  if (dist[py * W + px] <= 0) return null;
  let best: [number, number] | null = null;
  let bestD = dist[py * W + px];
  for (const d of DIRS) {
    const nx = px + DX[d], ny = py + DY[d];
    const n = ny * W + nx;
    if (n < 0 || n >= dist.length || dist[n] < 0) continue;
    if (dist[n] < bestD) { bestD = dist[n]; best = [nx, ny]; }
  }
  return best;
}

function dirTo(px: number, py: number, tx: number, ty: number): Dir | null {
  for (const d of DIRS) if (px + DX[d] === tx && py + DY[d] === ty) return d;
  return null;
}

// --- the bot -----------------------------------------------------------------

class Bot {
  private floorStart = 0;
  private lastHp: number;
  private blockedUntil = 0;
  private parryFor: string | null = null;
  private stuck = 0;
  private leaving = false;
  /** Piles the pack had no room for. Walked past, never edited. */
  private skipped = new Set<string>();
  private killsAtFloorStart = 0;
  private lastPos = '';
  report: RunReport;
  private floorRep!: FloorReport;
  private containersAtStart = 0;
  private knownMorsels = new Map<number, Set<string>>();

  constructor(private w: World, private policy: Policy, seed: number, private rng: Rng) {
    this.lastHp = w.player.hp;
    this.report = {
      seed, outcome: 'timeout', depth: 1, deepest: 1, bossKilled: false, kills: 0, time: 0, gold: 0, renown: 0,
      itemsKept: 0, valueKept: 0, damageTaken: {}, sips: 0, morselsEaten: 0, morselsRotted: 0, parries: 0, hitsTaken: 0,
      blockedHits: 0, trapsSprung: 0, itemsLost: 0, valueLost: 0,
      peakSlots: 0, capacity: w.run.backpack.capacity, brokenAtEnd: 0, perFloor: [],
    };
    this.beginFloor();
  }

  private beginFloor(): void {
    const f = this.w.floor;
    this.floorStart = this.w.run.stats.time;
    this.killsAtFloorStart = this.w.run.stats.kills;
    this.containersAtStart = f.props.filter((p) => p.tier !== 'none').length;
    // A floor gets one report per run, however many times it is walked through.
    // Climbing out through five floors used to file five more reports, which is
    // how a 24-run sample claimed forty-eight visits to depth 1.
    const existing = this.report.perFloor.find((r) => r.depth === this.w.run.depth);
    if (existing) { this.floorRep = existing; return; }
    this.floorRep = {
      depth: this.w.run.depth, time: 0, kills: 0, enemies: f.enemies.length,
      containersLooted: 0, containersTotal: this.containersAtStart,
      items: 0, hpLost: 0, hpFracAtExit: 1, morsels: 0, food: 0,
    };
    this.report.perFloor.push(this.floorRep);
  }

  private endFloor(): void {
    this.floorRep.time += this.w.run.stats.time - this.floorStart;
    this.floorRep.kills += this.w.run.stats.kills - this.killsAtFloorStart;
    this.floorRep.hpFracAtExit = this.w.player.hp / this.w.derived.maxHp;
    this.floorStart = this.w.run.stats.time;
    this.killsAtFloorStart = this.w.run.stats.kills;
    const f = this.w.floor;
    this.floorRep.containersLooted = Math.max(
      this.floorRep.containersLooted,
      this.floorRep.containersTotal - f.props.filter((p) => p.tier !== 'none' && !p.used).length,
    );
  }

  /**
   * Read the frame's events. Damage is attributed here rather than by diffing
   * health, because only the events know whether a blow was blocked, parried,
   * or came out of the floor.
   */
  observe(events: WorldEvent[]): void {
    const r = this.report;
    // A trap can trigger without hurting the player (alarms and monster traps).
    // Attribution applies only to the following hurt in this event batch.
    let pendingPlayerTrap = false;
    for (const e of events) {
      switch (e.type) {
        case 'hurt':
          this.report.damageTaken[pendingPlayerTrap ? 'trap' : 'monster'] =
            (this.report.damageTaken[pendingPlayerTrap ? 'trap' : 'monster'] ?? 0) + e.amount;
          if (e.blocked) r.blockedHits++;
          pendingPlayerTrap = false;
          break;
        case 'trap':
          r.trapsSprung++;
          pendingPlayerTrap = e.kind !== 'alarm' &&
            e.x === this.w.player.x && e.y === this.w.player.y;
          break;
        case 'float':
          if (e.text === 'Parry!') r.parries++;
          break;
      }
    }
  }

  /** Live enemies that can reach us, nearest first. */
  private threats(): EnemyState[] {
    const p = this.w.player;
    return this.w.floor.enemies
      .filter((e) => e.ai !== 'dead' && e.hp > 0)
      .map((e) => ({ e, d: Math.abs(e.x - p.x) + Math.abs(e.y - p.y) }))
      .filter((t) => t.d <= 8 && this.w.los(t.e.x, t.e.y, p.x, p.y))
      .sort((a, b) => a.d - b.d)
      .map((t) => t.e);
  }

  private eat(): boolean {
    const morsel = this.w.morselNear();
    if (!morsel || !this.w.eatMorsel()) return false;
    this.report.morselsEaten++;
    this.floorRep.morsels++;
    this.floorRep.food += morsel.remaining;
    return true;
  }

  private hasHeal(): boolean {
    return (this.w.run.flask?.charges ?? 0) > 0;
  }

  /** One decision tick. Returns false when the run is over. */
  step(): boolean {
    const w = this.w;
    if (w.run.outcome !== 'active') return false;
    const p = w.player;
    const d = w.derived;

    // Account for damage taken since last tick.
    if (p.hp < this.lastHp) {
      this.floorRep.hpLost += this.lastHp - p.hp;
      this.report.hitsTaken++;
    }
    this.lastHp = p.hp;

    // The bot restates its whole intent every decision, so nothing may be left
    // held from the last one. A held key repeats on its own between decisions,
    // which is how a human plays and exactly not how a scripted policy should:
    // one decision has to mean one step, or the bot walks until it hits a wall.
    w.held.clear();
    if (w.run.backpack.items.length > this.report.peakSlots) this.report.peakSlots = w.run.backpack.items.length;
    if (w.busy || w.moving) return true;

    const hpFrac = p.hp / d.maxHp;
    const morsels = new Set((w.floor.morsels ?? []).map((m) => m.id));
    const known = this.knownMorsels.get(w.run.depth) ?? new Set<string>();
    for (const id of [...known]) if (!morsels.has(id)) { this.report.morselsRotted++; known.delete(id); }
    for (const id of morsels) known.add(id);
    this.knownMorsels.set(w.run.depth, known);

    // 1. Drink when hurt.
    if (hpFrac < this.policy.drinkAt && (!(w.floor.morsels ?? []).length || this.threats().length > 0)) {
      if (this.hasHeal()) {
        if (w.sipFlask()) this.report.sips++;
        return true;
      }
    }

    // 2. Fight what is next to us.
    const threats = this.threats();
    const adjacent = threats.filter((e) => Math.abs(e.x - p.x) + Math.abs(e.y - p.y) === 1);
    if (adjacent.length) {
      const e = adjacent[0];
      const facing = dirTo(p.x, p.y, e.x, e.y);
      if (facing !== null && facing !== p.facing) {
        this.turnTo(facing);
        return true;
      }
      // Parry or block an incoming swing.
      if (e.ai === 'windup') {
        if (this.parryFor !== e.id) {
          this.parryFor = e.id;
          // Decide once per wind-up whether this bot gets the timing right.
          this.blockedUntil = this.rng.chance(this.policy.parrySkill) ? -1 : w.time + 0.6;
          if (this.blockedUntil === -1) w.setBlock(false);
          else w.setBlock(true);
        }
        // Held intent is cleared every decision, so the guard has to be
        // restated every tick too: a plain block held for one frame was never
        // up long enough to absorb anything, and every report read "blocked 0".
        if (this.blockedUntil === -1) { if (e.timer <= 0.10) w.setBlock(true); }
        else w.setBlock(true);
        return true;
      }
      this.parryFor = null;
      w.setBlock(false);
      if (p.stamina >= d.swing.staminaCost) w.attack();
      return true;
    }
    w.setBlock(false);
    this.parryFor = null;

    // Between fights, walk back to food instead of spending a flask charge.
    if (!threats.length && hpFrac < 0.98 && (w.floor.morsels ?? []).length) {
      const near = w.morselNear();
      if (near) {
        // Only a chew that actually started counts. Counting presses logged
        // hundreds of meals a run whenever a door or a pile took the press.
        if (this.eat()) known.delete(near.id);
        return true;
      }
      const food = [...(w.floor.morsels ?? [])].sort((a, b) =>
        Math.abs(a.x - p.x) + Math.abs(a.y - p.y) - (Math.abs(b.x - p.x) + Math.abs(b.y - p.y)),
      )[0];
      return this.navigate(food.x, food.y);
    }

    // 3. Ranged attackers: close on them.
    // 4. Objectives.
    const target = this.pickTarget(hpFrac);
    this.trace(target ? `goal ${target[0]},${target[1]}` : 'goal none');
    if (!target) {
      // Nothing left to do on this floor: descend, or leave if this was the last.
      return this.transition(hpFrac);
    }
    return this.navigate(target[0], target[1]);
  }

  /** Where the bot wants to be standing next. */
  private pickTarget(hpFrac: number): [number, number] | null {
    const w = this.w;
    const f = w.floor;
    const p = w.player;
    const overBudget = w.run.stats.time - this.floorStart > this.policy.floorBudget;
    // Fleeing is a commitment. Re-deciding it every frame made the bot climb
    // one flight, notice it was no longer on the floor that scared it, and go
    // straight back down — for the rest of the run.
    if (hpFrac < this.policy.fleeAt && !this.hasHeal()) this.leaving = true;
    const hurt = this.leaving;
    const full = w.run.backpack.items.length >= w.run.backpack.capacity;

    // The King is the one fight the run harness otherwise never measures: the
    // bot reaches depth six and turns straight round. FINAL_DEPTH and BOSS_ID
    // rather than 6 and 'ashen_king', so moving the throne room moves this too.
    if (!hurt && this.policy.fightBoss && w.run.depth >= FINAL_DEPTH && !w.run.stats.bossKilled) {
      const boss = f.enemies.find((e) => e.def === BOSS_ID && e.ai !== 'dead');
      if (boss) return this.tileBeside(boss.x, boss.y);
    }
    if (!overBudget && !hurt) {
      // Kill anything that has noticed us first — leaving archers alive behind
      // is how a consistent policy stops being consistent.
      const hunting = f.enemies.filter((e) => e.ai !== 'dead' && e.hp > 0 && e.alert > 0);
      if (hunting.length) {
        const near = hunting
          .map((e) => ({ e, d: Math.abs(e.x - p.x) + Math.abs(e.y - p.y) }))
          .sort((a, b) => a.d - b.d)[0];
        if (near.d <= 10) return this.tileBeside(near.e.x, near.e.y);
      }
      if (!full) {
        // Loose loot, then containers, nearest first.
        const spots: [number, number, number][] = [];
        for (const pk of f.pickups) {
          if (!pk.items.length && !pk.gold) continue;
          if (this.skipped.has(pk.id)) continue;
          spots.push([pk.x, pk.y, 0]);
        }
        for (const pr of f.props) {
          if (pr.used || pr.tier === 'none') continue;
          if (pr.tier === 'urn' && !this.policy.lootUrns) continue;
          spots.push([pr.x, pr.y, 1]);
        }
        if (spots.length) {
          const dist = bfsFrom(f, p.x, p.y, this.keys());
          let best: [number, number] | null = null;
          let bestD = Infinity;
          for (const [x, y, kind] of spots) {
            // Containers are blocking, so aim at the tile in front of them.
            const cands: [number, number][] = kind === 0 ? [[x, y]] : DIRS.map((dd) => [x + DX[dd], y + DY[dd]] as [number, number]);
            for (const [cx2, cy2] of cands) {
              const i = cy2 * f.width + cx2;
              if (i < 0 || i >= dist.length || dist[i] < 0) continue;
              if (dist[i] < bestD) { bestD = dist[i]; best = [cx2, cy2]; }
            }
          }
          if (best) return best;
        }
      }
    }
    return null;
  }

  private keys(): string[] { return this.w.run.keys; }

  private trace(msg: string): void {
    const t = this.policy.trace;
    if (!t || t.length > 60000) return;
    const p = this.w.player;
    t.push(`${this.w.run.stats.time.toFixed(1)}s d${this.w.run.depth} @${p.x},${p.y} f${p.facing} hp${Math.round(p.hp)} :: ${msg}`);
  }

  private tileBeside(x: number, y: number): [number, number] {
    const f = this.w.floor;
    for (const d of DIRS) {
      const nx = x + DX[d], ny = y + DY[d];
      if (!blocksMove(f, nx, ny)) return [nx, ny];
    }
    return [x, y];
  }

  /** Down the stairs, or out through the entrance when we are done. */
  private transition(hpFrac: number): boolean {
    const w = this.w;
    const f = w.floor;
    const p = w.player;
    // Nothing left to do and nowhere deeper to go: the delve is over, so walk
    // out. Without this the bot climbs off the bottom floor, finds the one
    // above it already emptied, and goes straight back down — for ever.
    if (w.run.depth >= this.policy.targetDepth &&
        (!this.policy.fightBoss || w.run.stats.bossKilled)) this.leaving = true;
    const goDown = !this.leaving && w.run.depth < this.policy.targetDepth;
    const s = f.stairs.find((st) => st.down === goDown);
    if (!s) { this.finish('extracted'); return false; }
    // Stairs are used from the tile in front of them, facing in — the same as
    // every other interaction. Standing *on* them does nothing.
    const face = dirTo(p.x, p.y, s.x, s.y);
    if (face !== null) {
      if (face !== p.facing) { this.turnTo(face); return true; }
      this.endFloor();
      const was = w.run.depth;
      // Taking the stairs only *queues* a step onto them; the step has to land,
      // and then the fade has to play, before the floor is a different floor.
      // Watching `anim.transition` right after interact() sees nothing at all,
      // which is how the old harness filed three reports for depth 1.
      w.interact();
      for (let i = 0; i < 240 && w.run.depth === was && w.run.outcome === 'active'; i++) {
        // The stair below depth 2 forks: the bot takes the first road offered.
        if (goDown && w.forkPending()) w.chooseRoad(w.run.roads![0]);
        w.update(DT);
      }
      if (w.run.outcome !== 'active') { this.collect(); return false; }
      if (w.run.depth === was) { this.trace('stairs did not take'); return this.giveUp(); }
      this.beginFloor();
      this.lastHp = w.player.hp;
      return true;
    }
    const stand = this.tileBeside(s.x, s.y);
    return this.navigate(stand[0], stand[1]);
  }

  private navigate(tx: number, ty: number): boolean {
    const w = this.w;
    const p = w.player;
    const key = `${p.x},${p.y},${tx},${ty}`;
    if (key === this.lastPos) {
      if (++this.stuck > 240) { this.stuck = 0; this.trace(`stuck heading ${tx},${ty}`); return this.giveUp(); }
    } else { this.lastPos = key; this.stuck = 0; }

    if (p.x === tx && p.y === ty) {
      const morsel = w.morselNear();
      if (morsel && !this.threats().length && this.eat()) {
        this.knownMorsels.get(w.run.depth)?.delete(morsel.id);
        return true;
      }
      // Standing where we wanted. Face whatever we came for, then use the same
      // one-button path the touch controls use: urns and barrels are *smashed*,
      // not opened, and contextAction is the code that already knows that.
      for (const d of DIRS) {
        const pr = propAt(w.floor, p.x + DX[d], p.y + DY[d]);
        if (pr && !pr.used && pr.tier !== 'none') {
          if (d !== p.facing) { this.turnTo(d); return true; }
          break;
        }
      }
      // Piles are taken, not "interacted with": interact() only opens the loot
      // window for a human, and the bot has to do what the player then does.
      const pile = w.pickupNear();
      if (pile && (pile.items.length || pile.gold) && !this.skipped.has(pile.id)) {
        const moved = w.take(pile.id);
        this.floorRep.items += moved;
        // A pile the pack cannot hold is remembered and walked past. The old
        // version emptied it instead, which quietly rewrote the floor to make
        // the bot's life easier and made "items left behind" unmeasurable.
        if (!moved && pile.items.length) this.skipped.add(pile.id);
        if (moved) return true;
      }
      // Only act on the thing we came for. The old version fell through to
      // `interactionHint()`, which answers for whatever happens to be in front
      // — so arriving beside an open door meant closing it, every tick, until
      // the stuck counter fired. Stairs are handled by transition() and fights
      // by the adjacent-enemy branch; arriving here is always about loot.
      const front = propAt(w.floor, p.x + DX[p.facing], p.y + DY[p.facing]);
      if (front && !front.used && front.tier !== 'none') {
        const act = w.contextAction();
        if (act.kind === 'attack') {
          if (p.stamina >= w.derived.swing.staminaCost) w.attack();
          else this.stuck++;
        } else {
          w.interact();
        }
        return true;
      }
      this.trace('arrived, nothing to loot');
      this.stuck += 30;
      return true;
    }
    const next = stepToward(w.floor, p.x, p.y, tx, ty, this.keys());
    if (!next) { this.trace(`no path to ${tx},${ty}`); return this.giveUp(); }
    const d = dirTo(p.x, p.y, next[0], next[1]);
    if (d === null) { this.trace('bad step'); return this.giveUp(); }
    // A nearby enemy can make the bot turn toward it every other tick. If that
    // repeatedly cancels route movement, use the same strafe/back controls a
    // player has to leave the tile without first turning away from the threat.
    if (this.stuck > 4 && d !== p.facing && !doorAt(w.floor, next[0], next[1])
      && !propAt(w.floor, next[0], next[1])) {
      const relative = (d - p.facing + 4) % 4;
      w.press(relative === 2 ? 'back' : relative === 1 ? 'right' : 'left');
      return true;
    }
    if (d !== p.facing) { this.turnTo(d); return true; }
    // A closed door in the way: open it.
    const door = w.floor.doors.find((dd) => dd.x === next[0] && dd.y === next[1] && !dd.open);
    if (door) { w.interact(); return true; }
    // Planning routes through urns and barrels, because a player walks through
    // them — by breaking them. Movement still refuses, so the step has to
    // become a swing or the bot stands there until the stuck counter fires.
    const block = propAt(w.floor, next[0], next[1]);
    if (block && !block.used && (block.kind === 'urn' || block.kind === 'barrel' || block.kind === 'root_cache')) {
      if (p.stamina >= w.derived.swing.staminaCost) w.attack();
      else this.stuck++;
      return true;
    }
    w.press('forward');
    return true;
  }

  private turnTo(d: Dir): void {
    const p = this.w.player;
    const left = (p.facing + 3) % 4;
    this.w.press(left === d ? 'turnLeft' : 'turnRight');
  }

  /** Nothing reachable: head for the exit, or end the run if that fails too. */
  private giveUp(): boolean {
    const w = this.w;
    const up = w.floor.stairs.find((s) => !s.down);
    if (up && (w.player.x !== up.x || w.player.y !== up.y)) {
      const next = stepToward(w.floor, w.player.x, w.player.y, up.x, up.y, this.keys());
      if (next) {
        const d = dirTo(w.player.x, w.player.y, next[0], next[1]);
        if (d !== null) {
          if (d !== w.player.facing) this.turnTo(d);
          else w.press('forward');
          return true;
        }
      }
    }
    this.finish('extracted');
    return false;
  }

  /** Give up where we stand. Only reachable when the floor cannot be walked. */
  private finish(outcome: 'dead' | 'extracted'): void {
    const w = this.w;
    if (w.run.outcome === 'active') w.run.outcome = outcome;
    this.collect();
  }

  private collected = false;

  /**
   * Close the books, exactly once.
   *
   * Settlement goes through the real `endRun`, so what this reports as banked
   * is what the town actually receives: the pack is kept or lost by the same
   * rule the game uses, the Soul Pouch applies, and renown is the number the
   * player would see on the results screen. Adding up the backpack by hand
   * reported carried loot as profit, which is not the same thing at all — a
   * death is the case where those two numbers diverge completely.
   */
  collect(outcome?: 'timeout'): void {
    if (this.collected) return;
    this.collected = true;
    const w = this.w;
    if (outcome === 'timeout') {
      // A timeout is a failure of the bot, not a result of the game. Settling
      // it through endRun would bank the pack as a successful extraction and
      // quietly fold a harness bug into the balance numbers, so it is recorded
      // and left unsettled instead. summarise() says so, loudly.
      this.endFloor();
      const r = this.report;
      r.outcome = 'timeout';
      r.depth = w.run.depth;
      r.deepest = w.run.stats.deepest;
      r.kills = w.run.stats.kills;
      r.time = w.run.stats.time;
      return;
    }
    this.endFloor();
    const r = this.report;
    r.depth = w.run.depth;
    r.deepest = w.run.stats.deepest;
    r.bossKilled = w.run.stats.bossKilled;
    r.kills = w.run.stats.kills;
    r.time = w.run.stats.time;
    r.killedBy = w.run.killedBy;
    const died = w.run.outcome === 'dead';
    r.outcome = died ? 'dead' : 'extracted';
    for (const slot of ['weapon', 'offhand', 'body', 'head', 'hands'] as const) {
      const it = w.state.equipment[slot];
      if (it && durability(it).broken) r.brokenAtEnd++;
    }
    const summary = endRun(w.state, died ? 'dead' : 'extracted');
    r.gold = summary.gold;
    r.renown = summary.renown;
    for (const it of summary.items) { r.itemsKept += it.qty; r.valueKept += itemValue(it) * it.qty; }
    for (const it of summary.lost) { r.itemsLost += it.qty; r.valueLost += itemValue(it) * it.qty; }
  }
}

// --- driver ------------------------------------------------------------------

export interface PlaytestOpts {
  runs: number;
  policy?: Partial<Policy>;
  seed?: number;
  /** Called with the fresh GameState before the run starts. */
  prepare?: (s: GameState, run: number) => void;
  /** The save's difficulty. Hard when absent, like every save before difficulty levels. */
  difficulty?: DifficultyId;
}

/**
 * A character who has already played. The bot always starts from `newGame`, so
 * without this every report is a first delve, and a first delve never reaches
 * the floors where the difficulty complaint actually lives.
 */
export function geared(equipment: () => Equipment, meta: MetaLevels = {}): (s: GameState) => void {
  return (s) => {
    s.equipment = equipment();
    s.meta = { ...meta };
  };
}

/** Roughly where the renown tree sits after a dozen successful delves. */
export const MID_META: MetaLevels = { toughness: 3, endurance: 2, pack_mule: 1, lantern: 1 };
export const DEEP_META: MetaLevels = { toughness: 5, endurance: 3, pack_mule: 3, lantern: 3, treasure_sense: 2 };

export function playOneRun(seed: number, policy: Policy, prepare?: (s: GameState) => void, difficulty: DifficultyId = 'hard'): RunReport {
  const state = newGame(createRng(seed));
  state.difficulty = difficulty;
  // newGame draws a random save id, and the day's roads at the fork are seeded
  // from it. Fix it, or two runs of the harness take different roads and stop
  // being comparable.
  state.saveId = `bot-${seed}`;
  prepare?.(state);
  packLoadout(state);
  startRun(state, seed);
  const w = new World(state);
  const bot = new Bot(w, policy, seed, createRng(seed ^ 0xa5a5a5));
  const maxTicks = 60 * 60 * 45; // 45 sim-minutes, hard stop
  let ticks = 0;
  while (w.run.outcome === 'active' && ticks++ < maxTicks) {
    if (!bot.step()) break;
    w.update(DT);
    bot.observe(w.drainEvents());
  }
  if (w.run.outcome === 'active') bot.collect('timeout');
  else bot.collect();
  return bot.report;
}

/**
 * Move the consumables out of the stash and into the pack before setting off.
 * Nobody leaves the healing draughts at home, and a bot that did was reporting
 * a difficulty nobody would actually play.
 */
function packLoadout(state: GameState): void {
  const pack = syncLoadout(state);
  for (const it of [...state.stash.items]) {
    if (it.kind !== 'consumable') continue;
    const moved = removeItem(state.stash, it.uid);
    if (!moved) continue;
    const left = addItem(pack, moved);
    if (left > 0) addItem(state.stash, { ...moved, qty: left });
  }
}

export function playtest(opts: PlaytestOpts): RunReport[] {
  const policy = { ...DEFAULT_POLICY, ...(opts.policy ?? {}) };
  const out: RunReport[] = [];
  for (let i = 0; i < opts.runs; i++) {
    const seed = (opts.seed ?? 1000) + i * 7919;
    out.push(playOneRun(seed, policy, opts.prepare ? (s) => opts.prepare!(s, i) : undefined, opts.difficulty));
  }
  return out;
}

// --- reporting ---------------------------------------------------------------

/** Renown to buy every upgrade to its last level — the yardstick for "slow". */
const META_TREE_COST = META_UPGRADES.reduce((sum, u) => sum + u.costs.reduce((a, b) => a + b, 0), 0);

function pct(n: number, of: number): string { return of ? `${((n / of) * 100).toFixed(0)}%` : '—'; }
function avg(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }

export function summarise(reports: RunReport[], label: string): string {
  const L: string[] = [];
  const n = reports.length;
  L.push(`=== ${label} (${n} runs) ===`);
  const deaths = reports.filter((r) => r.outcome === 'dead');
  const timeouts = reports.filter((r) => r.outcome === 'timeout');
  if (timeouts.length) {
    L.push(`!! ${timeouts.length} of ${n} runs TIMED OUT (seeds ${timeouts.map((r) => r.seed).join(', ')}) — the bot got stuck, not the player. These are unsettled`);
    L.push('!! and excluded from banked/renown figures. Treat this whole block as a failed measurement.');
  }
  L.push(`outcome: ${pct(deaths.length, n)} dead, ${pct(n - deaths.length - timeouts.length, n)} out, ${pct(timeouts.length, n)} timeout`);
  L.push(`deepest: avg ${avg(reports.map((r) => r.deepest)).toFixed(2)}  ` +
    [1, 2, 3, 4, 5, 6].map((d) => `D${d}:${pct(reports.filter((r) => r.deepest >= d).length, n)}`).join(' '));
  const deathDepth = [1, 2, 3, 4, 5, 6].map((d) => `D${d}:${deaths.filter((r) => r.deepest === d).length}`).join(' ');
  L.push(`deaths by depth: ${deathDepth}`);
  L.push(`Ashen King slain: ${reports.filter((r) => r.bossKilled).length}/${n}`);
  const killers = new Map<string, number>();
  for (const r of deaths) killers.set(r.killedBy ?? '?', (killers.get(r.killedBy ?? '?') ?? 0) + 1);
  L.push(`killed by: ${[...killers].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} x${v}`).join(', ') || '—'}`);
  L.push(`run time: avg ${avg(reports.map((r) => r.time)).toFixed(0)}s  kills: ${avg(reports.map((r) => r.kills)).toFixed(1)}  sips: ${avg(reports.map((r) => r.sips)).toFixed(1)}  morsels: ${avg(reports.map((r) => r.morselsEaten)).toFixed(1)} eaten / ${avg(reports.map((r) => r.morselsRotted)).toFixed(1)} rotted  hits taken: ${avg(reports.map((r) => r.hitsTaken)).toFixed(1)}`);
  L.push(`damage taken: monsters ${avg(reports.map((r) => r.damageTaken.monster ?? 0)).toFixed(0)}, traps ${avg(reports.map((r) => r.damageTaken.trap ?? 0)).toFixed(0)} (${avg(reports.map((r) => r.trapsSprung)).toFixed(1)} sprung)  parries ${avg(reports.map((r) => r.parries)).toFixed(1)}  blocked ${avg(reports.map((r) => r.blockedHits)).toFixed(1)}`);
  // Banked means settled through endRun(): what the town actually received,
  // after a death has taken the pack off you.
  L.push(`banked: ${avg(reports.map((r) => r.gold)).toFixed(0)}g + ${avg(reports.map((r) => r.itemsKept)).toFixed(1)} items worth ${avg(reports.map((r) => r.valueKept)).toFixed(0)}g   lost to deaths: ${avg(reports.map((r) => r.itemsLost)).toFixed(1)} items worth ${avg(reports.map((r) => r.valueLost)).toFixed(0)}g`);
  const renown = avg(reports.map((r) => r.renown));
  const hours = avg(reports.map((r) => r.time)) / 3600;
  L.push(`renown: ${renown.toFixed(1)}/run, ${hours > 0 ? (renown / hours).toFixed(0) : '—'}/sim-hour (whole tree costs ${META_TREE_COST})   broken gear at end: ${avg(reports.map((r) => r.brokenAtEnd)).toFixed(2)}`);
  // Gold *out* is not modelled: the bot never visits town, so it never pays a
  // smith, an appraiser or a merchant. Banked is income, not profit.
  L.push(`pack: peaked at ${avg(reports.map((r) => r.peakSlots)).toFixed(1)} of ${avg(reports.map((r) => r.capacity)).toFixed(0)} slots; ${pct(reports.filter((r) => r.peakSlots >= r.capacity).length, n)} of runs filled it`);
  L.push('note: income only — the bot never goes to town, so repairs, identification and restocking are unpriced.');
  L.push('per floor:');
  for (let d = 1; d <= 6; d++) {
    const fs = reports.flatMap((r) => r.perFloor.filter((f) => f.depth === d));
    if (!fs.length) continue;
    L.push(`  D${d} n=${String(fs.length).padStart(3)} time=${avg(fs.map((f) => f.time)).toFixed(0)}s kills=${avg(fs.map((f) => f.kills)).toFixed(1)}/${avg(fs.map((f) => f.enemies)).toFixed(1)} looted=${avg(fs.map((f) => f.containersLooted)).toFixed(1)}/${avg(fs.map((f) => f.containersTotal)).toFixed(1)} items=${avg(fs.map((f) => f.items)).toFixed(1)} hpLost=${avg(fs.map((f) => f.hpLost)).toFixed(0)} hpOut=${(avg(fs.map((f) => f.hpFracAtExit)) * 100).toFixed(0)}% food=${avg(fs.map((f) => f.morsels)).toFixed(1)} (${(avg(fs.map((f) => f.food)) * 100).toFixed(0)}% hp)`);
  }
  return L.join('\n');
}
