import { ELEMENTAL_VARIANT_IDS } from '../data/elemental-variants';
import { iciclesFor } from './ceiling-decor';
import { Rng, createRng, hashString } from '../core/rng';
import { Dir, DIRS, DX, DY, turnAround, turnLeft, turnRight } from '../core/dir';
import { biomeForDepth, FINAL_DEPTH } from '../data/biomes';
import { BOSS_ID, ENEMIES, enemyDef } from '../data/enemies';
import { DifficultyId, DifficultyDef, DIFFICULTIES, difficultyOf } from '../data/difficulty';
import { EnemyDef, Item } from '../types';
import { ContainerTier, makeMaterial, materialForDepth } from './items';

// ---------------------------------------------------------------------------
// Floor model (plain data — serialised straight into the save)
// ---------------------------------------------------------------------------

export const WALL = 0;
export const FLOOR = 1;
export const PILLAR = 2;

export type RoomRole = 'start' | 'end' | 'normal' | 'treasure' | 'vault' | 'secret' | 'shrine' | 'throne';

export interface Room {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  role: RoomRole;
}

export interface Door {
  x: number;
  y: number;
  /** Passage runs north–south, so the door leaf spans east–west. */
  ns: boolean;
  open: boolean;
  locked: boolean;
  keyId?: string;
  iron: boolean;
}

export interface Secret {
  x: number;
  y: number;
  found: boolean;
}

export interface Stairs {
  x: number;
  y: number;
  /** Direction you face when stepping into the stairs. */
  dir: Dir;
  down: boolean;
}

export interface Torch {
  x: number;
  y: number;
  /** The wall the sconce is mounted on, seen from tile (x,y). */
  side: Dir;
}

export type PropKind = 'icicle' | 'root_cache' | 'chest' | 'urn' | 'barrel' | 'bones' | 'shrine' | 'fungus' | 'portal' | 'town_portal';

export interface Prop {
  id: string;
  kind: PropKind;
  x: number;
  y: number;
  /** Chest opened / urn broken / shrine used. */
  used: boolean;
  tier: ContainerTier | 'none';
  blocking: boolean;
  /** A chest wearing a convincing wooden shell. */
  mimic: boolean;
  /** Which god a shrine serves. Only meaningful on `kind: 'shrine'`. */
  shrine?: ShrineKind;
  /** Optional roof decoration; absent on all older props and saves. */
  ceiling?: { height: number; dx: number; dz: number; sprite: string };
}

/**
 * Shrines come in three flavours, and each one tells you which it is before you
 * touch it: the flame and the light it throws are a different colour, and the
 * prompt names it. Praying is then a decision rather than a coin toss.
 */
export type ShrineKind = 'font' | 'idol' | 'coffer';

export const SHRINE_KINDS: ShrineKind[] = ['font', 'idol', 'coffer'];

/**
 * Floor hazards. Every trap is hidden until you spot the seam in the flagstones
 * from the tile in front of it, which makes walking into one a question of
 * paying attention rather than of luck.
 */
export type TrapKind = 'dart' | 'spikes' | 'alarm';

export interface Trap {
  id: string;
  kind: TrapKind;
  x: number;
  y: number;
  /** Can still fire. Cleared by triggering it or disarming it. */
  armed: boolean;
  /** Spotted (or set off) — only then is it drawn and mapped. */
  found: boolean;
  /** For darts: the wall the shooter is set into, so the bolt flies out of it. */
  dir: Dir;
}

export interface Pickup {
  id: string;
  x: number;
  y: number;
  items: Item[];
  gold: number;
  keyId?: string;
}

/** Recoverable thrown stock. Counts merge by base and tile. */
export interface ThrownMarker {
  x: number;
  y: number;
  base: string;
  n: number;
}

export interface KeyDef {
  id: string;
  name: string;
}

export type EnemyAI = 'idle' | 'wander' | 'chase' | 'windup' | 'recover' | 'flee' | 'dead';

export interface EnemyState {
  id: string;
  def: string;
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  /** Step progress 0..1 (1 = standing on x,y). */
  moveT: number;
  facing: Dir;
  hp: number;
  maxHp: number;
  ai: EnemyAI;
  timer: number;
  /** Seconds of remaining pursuit after losing sight. */
  alert: number;
  lastSeenX: number;
  lastSeenY: number;
  homeX: number;
  homeY: number;
  hurtT: number;
  deadT: number;
  attackCd: number;
  /**
   * Seconds since its last swing or loosed shot. **Absent means it has not
   * struck yet**, which is also what a creature reeling out of a wind-up looks
   * like: the follow-through is drawn from this, never from `recover`, because
   * a stagger, a parry and a broken phase all park a creature in `recover`
   * without a blow ever landing.
   */
  strikeT?: number;
  /** Depth scaling baked in at spawn. */
  power: number;
  /** Seconds left of the opening a parry tore in its guard. */
  vuln?: number;
  /** Consecutive blows turned on a carried shield. Resets when one gets through or the guard drops. */
  blocks?: number;
  /** Seconds until the block count goes stale. */
  blockT?: number;
  /**
   * Shield guard rhythm: `raising` sweeps the shield center (hitting it then
   * is answered with a bash), `up` holds it (blows chip), `down` is the
   * opening. Absent means down.
   */
  guard?: 'down' | 'raising' | 'up';
  /** Seconds left in the current guard state (or cooldown while down). */
  guardT?: number;
  /** The chest reward this mimic swallowed, released when it dies. */
  mimicTier?: ContainerTier;
  mimicPropId?: string;
  /**
   * For a boss: the highest phase whose entrance has already played. **Absent
   * means the first** — the same trick `guard` and `dur` use, so a King already
   * mid-fight in an older save costs no migration. The phase he is actually *in*
   * is derived from his health every tick (`phaseForHp`); this only remembers
   * how far the fight has been announced, so each turn lands once.
   */
  phase?: number;
  /**
   * Put down once and stood back up by the King. **Absent means it is having
   * its first life**, so killing it pays out normally; a risen one pays
   * nothing, because it already did.
   */
  risen?: boolean;
}

export interface Floor {
  depth: number;
  seed: number;
  biome: string;
  width: number;
  height: number;
  tiles: number[];
  explored: number[];
  rooms: Room[];
  doors: Door[];
  secrets: Secret[];
  stairs: Stairs[];
  torches: Torch[];
  props: Prop[];
  pickups: Pickup[];
  thrown?: ThrownMarker[];
  enemies: EnemyState[];
  keys: KeyDef[];
  traps: Trap[];
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function inBounds(f: Floor, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < f.width && y < f.height;
}

export function tileAt(f: Floor, x: number, y: number): number {
  return inBounds(f, x, y) ? f.tiles[y * f.width + x] : WALL;
}

export function doorAt(f: Floor, x: number, y: number): Door | undefined {
  return f.doors.find((d) => d.x === x && d.y === y);
}

export function secretAt(f: Floor, x: number, y: number): Secret | undefined {
  return f.secrets.find((s) => s.x === x && s.y === y && !s.found);
}

export function stairsAt(f: Floor, x: number, y: number): Stairs | undefined {
  return f.stairs.find((s) => s.x === x && s.y === y);
}

export function trapAt(f: Floor, x: number, y: number): Trap | undefined {
  return f.traps?.find((t) => t.x === x && t.y === y);
}

export function propAt(f: Floor, x: number, y: number): Prop | undefined {
  return f.props.find((p) => p.x === x && p.y === y && p.kind !== 'fungus' && p.kind !== 'bones' && p.kind !== 'icicle');
}

export function enemyAt(f: Floor, x: number, y: number): EnemyState | undefined {
  return f.enemies.find((e) => e.ai !== 'dead' && e.x === x && e.y === y);
}

/** Blocks sight: walls, pillars, closed doors. */
export function blocksSight(f: Floor, x: number, y: number): boolean {
  const t = tileAt(f, x, y);
  if (t !== FLOOR) return true;
  const d = doorAt(f, x, y);
  return !!d && !d.open;
}

/** Blocks movement for anyone (ignores creatures). */
export function blocksMove(f: Floor, x: number, y: number): boolean {
  if (blocksSight(f, x, y)) return true;
  const p = propAt(f, x, y);
  return !!p && p.blocking && !(p.kind === 'urn' || p.kind === 'barrel' || p.kind === 'root_cache' ? p.used : false);
}

/** The tile in front of a staircase — where you stand when you arrive. */
export function stairsFront(s: Stairs): { x: number; y: number; facing: Dir } {
  return { x: s.x - DX[s.dir], y: s.y - DY[s.dir], facing: turnAround(s.dir) };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/**
 * How much stronger than its stat block a monster is on this floor.
 *
 * Two things are going on, and they used to be one. A monster standing below
 * its own home floor is a veteran of its kind, which is the `overlevel` term.
 * But the player's gear tracks the *floor number* — depth is what decides which
 * materials drop and therefore what you are swinging — so the monsters have to
 * track the floor number too, or the two curves never meet. That is `floor`.
 *
 * Health climbs faster than damage on purpose: a deep floor should be a longer
 * fight you can lose slowly, not a coin flip that removes you in two blows.
 *
 * Exported because the balance tables ask the same question the generator does,
 * and a second copy of the formula is a second copy to forget to update.
 */
export function depthPower(def: EnemyDef, depth: number): number {
  const overlevel = 1 + Math.max(0, depth - def.minDepth) * 0.12;
  const floor = 1 + Math.max(0, depth - 1) * 0.5;
  return overlevel * floor;
}

/**
 * Damage and armour climb more slowly than health. `power` is already the
 * health multiplier, so these are expressed against it rather than against
 * depth again — one curve, read three ways.
 */
export function attackPower(power: number): number {
  return 1 + (power - 1) * 0.55;
}

export function defensePower(power: number): number {
  return 1 + (power - 1) * 0.45;
}

export function createEnemy(def: EnemyDef, x: number, y: number, facing: Dir, id: string, depth: number, difficulty?: DifficultyId): EnemyState {
  const power = depthPower(def, depth);
  // Difficulty scales the health bar only, never `power`: attack and armour
  // read `power` back through attackPower/defensePower, and those stay on the
  // old curve so Hard is untouched and Normal's softening is explicit per
  // system (damage in the world, armour via enemyDefense, drops in items.ts).
  const hp = Math.round(def.hp * power * difficultyOf(difficulty).enemyHp);
  return {
    id, def: def.id, x, y, fromX: x, fromY: y, moveT: 1, facing, hp, maxHp: hp, ai: 'idle', timer: 0, alert: 0,
    lastSeenX: -1, lastSeenY: -1, homeX: x, homeY: y, hurtT: 0, deadT: 0, attackCd: 0, power,
  };
}

/** Mimic rolls use their own stream so adding them never reshuffles a floor. */
export function chestIsMimic(floorSeed: number, propId: string): boolean {
  return createRng(hashString(`mimic:${floorSeed}:${propId}`)).chance(0.12);
}

/** Likewise for shrines, so an old save's shrine is the one a new one would be. */
export function shrineKindFor(floorSeed: number, propId: string): ShrineKind {
  const rng = createRng(hashString(`shrine:${floorSeed}:${propId}`));
  return rng.weighted<ShrineKind>([['font', 4], ['idol', 4], ['coffer', 3]]);
}

const KEY_NAMES: Record<string, string> = {
  crypt: 'Bone Key', catacombs: 'Silted Key', burrows: 'Burrow Key',
  mines: 'Rusted Key', frostvault: 'Frost Key', emberworks: 'Cinder Key',
  sporegrove: 'Spore Key', caverns: 'Crystal Key', throne: 'Ashen Key',
};

const FAVORED_ENEMY_WEIGHT = 4;
const ELEMENTAL_ENEMY_WEIGHT = 4;

export function generateFloor(runSeed: number, depth: number, difficulty?: DifficultyId): Floor {
  const seed = hashString(`floor:${runSeed}:${depth}`);
  // Difficulty deliberately stays out of the seed: a Hard floor is generated
  // exactly as before, and Normal only changes *how many* things spawn, never
  // *which* walls stand where.
  const diff = difficultyOf(difficulty);
  for (let attempt = 0; attempt < 40; attempt++) {
    const f = tryGenerate(seed, depth, createRng((seed + Math.imul(attempt + 1, 0x9e3779b1)) >>> 0), diff);
    if (f) return f;
  }
  throw new Error(`dungeon generation failed for depth ${depth}`);
}

class MinHeap {
  private k: number[] = [];
  private v: number[] = [];
  get size(): number {
    return this.k.length;
  }
  push(key: number, val: number): void {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]];
      [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop(): [number, number] {
    const k = this.k, v = this.v;
    const top: [number, number] = [k[0], v[0]];
    const lk = k.pop()!, lv = v.pop()!;
    if (k.length) {
      k[0] = lk;
      v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

interface Entrance {
  x: number;
  y: number;
  /** Outward direction from the room. */
  dir: Dir;
  doorable: boolean;
}

function tryGenerate(seed: number, depth: number, rng: Rng, diff: DifficultyDef = DIFFICULTIES.hard): Floor | null {
  const biome = biomeForDepth(depth, seed);
  const isBoss = depth >= FINAL_DEPTH;
  const W = 31 + 4 * Math.min(depth - 1, 4);
  const H = W;
  const N = W * H;
  const tiles: number[] = new Array(N).fill(WALL);
  const roomOf: number[] = new Array(N).fill(-1);
  const ring: number[] = new Array(N).fill(0);
  const reserved: boolean[] = new Array(N).fill(false);
  const blocked: boolean[] = new Array(N).fill(false);
  const idx = (x: number, y: number) => y * W + x;
  const inner = (x: number, y: number) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1;
  const rooms: Room[] = [];

  const fits = (x: number, y: number, w: number, h: number) =>
    x >= 2 && y >= 2 && x + w <= W - 2 && y + h <= H - 2 &&
    !rooms.some((r) => x - 2 < r.x + r.w && x + w + 2 > r.x && y - 2 < r.y + r.h && y + h + 2 > r.y);

  const addRoom = (x: number, y: number, w: number, h: number, role: RoomRole): Room => {
    const r: Room = { id: rooms.length, x, y, w, h, role };
    rooms.push(r);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      tiles[idx(xx, yy)] = FLOOR;
      roomOf[idx(xx, yy)] = r.id;
    }
    return r;
  };

  // --- Rooms ---------------------------------------------------------------
  let throne: Room | null = null;
  if (isBoss) {
    for (let a = 0; a < 200 && !throne; a++) {
      const x = rng.int(2, W - 2 - 9), y = rng.int(2, H - 2 - 11);
      if (fits(x, y, 9, 11)) throne = addRoom(x, y, 9, 11, 'throne');
    }
    if (!throne) return null;
  }
  const target = isBoss ? 8 : 9 + Math.min(depth, 5);
  for (let a = 0; a < 900 && rooms.length < target; a++) {
    const big = rng.chance(0.18);
    const w = big ? rng.int(6, 9) : rng.int(3, 6);
    const h = big ? rng.int(5, 8) : rng.int(3, 5);
    const x = rng.int(2, W - 2 - w);
    const y = rng.int(2, H - 2 - h);
    if (fits(x, y, w, h)) addRoom(x, y, w, h, 'normal');
  }
  if (rooms.length < 6) return null;

  for (const r of rooms) {
    for (let y = r.y - 1; y <= r.y + r.h; y++) for (let x = r.x - 1; x <= r.x + r.w; x++) {
      if (roomOf[idx(x, y)] === -1) ring[idx(x, y)]++;
    }
  }

  // --- Room graph: MST plus a few loops -----------------------------------
  const cx = (r: Room) => r.x + (r.w >> 1);
  const cy = (r: Room) => r.y + (r.h >> 1);
  const rdist = (a: Room, b: Room) => Math.abs(cx(a) - cx(b)) + Math.abs(cy(a) - cy(b));
  const edges: [number, number][] = [];
  const hasEdge = (a: number, b: number) => edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
  {
    const inTree = new Set<number>([0]);
    while (inTree.size < rooms.length) {
      let best: [number, number] | null = null;
      let bestD = Infinity;
      for (const i of inTree) for (const r of rooms) {
        if (inTree.has(r.id)) continue;
        // Keep the throne a dead end: it may only join once.
        if (throne && (r.id === throne.id || i === throne.id) && edges.some(([p, q]) => p === throne!.id || q === throne!.id)) continue;
        const d = rdist(rooms[i], r);
        if (d < bestD) {
          bestD = d;
          best = [i, r.id];
        }
      }
      if (!best) return null;
      edges.push(best);
      inTree.add(best[1]);
    }
    for (const r of rooms) {
      if (r === throne) continue;
      const near = rooms.filter((o) => o !== r && o !== throne).sort((a, b) => rdist(r, a) - rdist(r, b)).slice(0, 3);
      for (const o of near) if (!hasEdge(r.id, o.id) && rng.chance(0.2)) edges.push([r.id, o.id]);
    }
  }

  // --- Corridors (Dijkstra through rock, preferring existing tunnels) ------
  const noise = Array.from({ length: N }, () => rng.next() * 2.5);
  const carve = (a: Room, b: Room): boolean => {
    const s = idx(cx(a), cy(a));
    const t = idx(cx(b), cy(b));
    const cost = new Float64Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const heap = new MinHeap();
    cost[s] = 0;
    heap.push(0, s);
    while (heap.size) {
      const [c, i] = heap.pop();
      if (c > cost[i]) continue;
      if (i === t) break;
      const x = i % W, y = (i / W) | 0;
      for (const d of DIRS) {
        const nx = x + DX[d], ny = y + DY[d];
        if (!inner(nx, ny)) continue;
        const n = idx(nx, ny);
        const rid = roomOf[n];
        let step: number;
        if (rid === a.id || rid === b.id) step = 1;
        else if (rid >= 0) step = 70;
        else if (tiles[n] === FLOOR) step = 1.3;
        else step = 3 + noise[n] + ring[n] * 9;
        const nc = c + step;
        if (nc < cost[n]) {
          cost[n] = nc;
          prev[n] = i;
          heap.push(nc, n);
        }
      }
    }
    if (prev[t] < 0) return false;
    for (let i = t; i !== s && i >= 0; i = prev[i]) if (tiles[i] === WALL) tiles[i] = FLOOR;
    return true;
  };
  for (const [a, b] of edges) if (!carve(rooms[a], rooms[b])) return null;

  // --- Entrances --------------------------------------------------------------
  const entrancesOf = (r: Room): Entrance[] => {
    const out: Entrance[] = [];
    const test = (x: number, y: number, dir: Dir) => {
      const i = idx(x, y);
      if (tiles[i] !== FLOOR || roomOf[i] !== -1) return;
      const l = turnLeft(dir), rt = turnRight(dir);
      const flanks = tiles[idx(x + DX[l], y + DY[l])] === WALL && tiles[idx(x + DX[rt], y + DY[rt])] === WALL;
      const outer = tiles[idx(x + DX[dir], y + DY[dir])] === FLOOR;
      out.push({ x, y, dir, doorable: flanks && outer });
    };
    for (let x = r.x; x < r.x + r.w; x++) {
      test(x, r.y - 1, Dir.N);
      test(x, r.y + r.h, Dir.S);
    }
    for (let y = r.y; y < r.y + r.h; y++) {
      test(r.x - 1, y, Dir.W);
      test(r.x + r.w, y, Dir.E);
    }
    return out;
  };
  const entrances = rooms.map(entrancesOf);

  // --- Roles -------------------------------------------------------------------
  const bfs = (sx: number, sy: number): Int32Array => {
    const dist = new Int32Array(N).fill(-1);
    const q = [idx(sx, sy)];
    dist[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      const x = i % W, y = (i / W) | 0;
      for (const d of DIRS) {
        const n = idx(x + DX[d], y + DY[d]);
        if (tiles[n] !== FLOOR || dist[n] >= 0) continue;
        dist[n] = dist[i] + 1;
        q.push(n);
      }
    }
    return dist;
  };

  let start: Room;
  let end: Room;
  if (throne) {
    const d = bfs(cx(throne), cy(throne));
    start = rooms.filter((r) => r !== throne).sort((a, b) => d[idx(cx(b), cy(b))] - d[idx(cx(a), cy(a))])[0];
    end = throne;
  } else {
    start = rng.pick(rooms);
    const d = bfs(cx(start), cy(start));
    end = rooms.filter((r) => r !== start).sort((a, b) => d[idx(cx(b), cy(b))] - d[idx(cx(a), cy(a))])[0];
  }
  start.role = 'start';
  if (end.role !== 'throne') end.role = 'end';

  const leaves = rooms.filter((r) => r.role === 'normal' && entrances[r.id].length === 1 && entrances[r.id][0].doorable);
  rng.shuffle(leaves);
  const vault = leaves.shift() ?? null;
  if (vault) vault.role = 'vault';
  for (const r of leaves.slice(0, 2)) r.role = 'treasure';
  if (rng.chance(0.45)) {
    const cand = rooms.filter((r) => r.role === 'normal');
    if (cand.length) rng.pick(cand).role = 'shrine';
  }

  // --- Doors -------------------------------------------------------------------
  const doors: Door[] = [];
  const keys: KeyDef[] = [];
  const iron = biome.door === 'door_iron';
  for (const r of rooms) {
    for (const e of entrances[r.id]) {
      if (!e.doorable || doors.some((d) => d.x === e.x && d.y === e.y)) continue;
      const ns = e.dir === Dir.N || e.dir === Dir.S;
      if (r === vault) {
        const key: KeyDef = { id: `key_${depth}_${keys.length}`, name: KEY_NAMES[biome.id] ?? 'Iron Key' };
        keys.push(key);
        doors.push({ x: e.x, y: e.y, ns, open: false, locked: true, keyId: key.id, iron: true });
      } else if (r === throne) {
        doors.push({ x: e.x, y: e.y, ns, open: false, locked: false, iron: true });
      } else if (rng.chance(0.45)) {
        doors.push({ x: e.x, y: e.y, ns, open: false, locked: false, iron });
      }
      reserved[idx(e.x, e.y)] = true;
    }
  }

  // --- Secret room behind a pushable wall ---------------------------------
  const secrets: Secret[] = [];
  if (rng.chance(0.5 + depth * 0.06)) {
    const hosts = rooms.filter((r) => r.role === 'normal' || r.role === 'treasure' || r.role === 'start');
    for (let a = 0; a < 300 && secrets.length === 0 && hosts.length; a++) {
      const r = rng.pick(hosts);
      const d = rng.pick(DIRS);
      // Edge tile of the room on side d.
      const fx = d === Dir.W ? r.x : d === Dir.E ? r.x + r.w - 1 : rng.int(r.x, r.x + r.w - 1);
      const fy = d === Dir.N ? r.y : d === Dir.S ? r.y + r.h - 1 : rng.int(r.y, r.y + r.h - 1);
      const sx = fx + DX[d], sy = fy + DY[d];
      const ccx = fx + DX[d] * 3, ccy = fy + DY[d] * 3;
      let ok = tiles[idx(sx, sy)] === WALL && !reserved[idx(sx, sy)];
      for (let yy = ccy - 2; ok && yy <= ccy + 2; yy++) for (let xx = ccx - 2; ok && xx <= ccx + 2; xx++) {
        if (!inner(xx, yy) || tiles[idx(xx, yy)] !== WALL || roomOf[idx(xx, yy)] !== -1 || reserved[idx(xx, yy)]) ok = false;
      }
      if (!ok) continue;
      const sr = addRoom(ccx - 1, ccy - 1, 3, 3, 'secret');
      void sr;
      secrets.push({ x: sx, y: sy, found: false });
      reserved[idx(sx, sy)] = true;
    }
  }

  // --- Stairs in wall alcoves ------------------------------------------------
  const stairs: Stairs[] = [];
  const carveAlcove = (r: Room, down: boolean): Stairs | null => {
    const cands: Stairs[] = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      for (const d of DIRS) {
        const wx = x + DX[d], wy = y + DY[d];
        const wi = idx(wx, wy);
        if (roomOf[wi] !== -1 || tiles[wi] !== WALL || reserved[wi]) continue;
        const bx = wx + DX[d], by = wy + DY[d];
        if (!inner(bx, by)) continue;
        const l = turnLeft(d), rt = turnRight(d);
        if (tiles[idx(bx, by)] !== WALL || tiles[idx(wx + DX[l], wy + DY[l])] !== WALL || tiles[idx(wx + DX[rt], wy + DY[rt])] !== WALL) continue;
        // Don't put stairs right beside an entrance.
        if (reserved[idx(x, y)]) continue;
        cands.push({ x: wx, y: wy, dir: d, down });
      }
    }
    if (!cands.length) return null;
    const s = rng.pick(cands);
    tiles[idx(s.x, s.y)] = FLOOR;
    reserved[idx(s.x, s.y)] = true;
    const front = stairsFront(s);
    reserved[idx(front.x, front.y)] = true;
    return s;
  };
  const up = carveAlcove(start, false);
  if (!up) return null;
  stairs.push(up);
  if (!isBoss) {
    const down = carveAlcove(end, true);
    if (!down) return null;
    stairs.push(down);
  }
  const spawn = stairsFront(up);

  // --- Connectivity helper ---------------------------------------------------
  const secretIdx = new Set(secrets.map((s) => idx(s.x, s.y)));
  const connected = (): boolean => {
    const seen = new Uint8Array(N);
    const q = [idx(spawn.x, spawn.y)];
    seen[q[0]] = 1;
    let count = 1;
    for (let h = 0; h < q.length; h++) {
      const i = q[h];
      const x = i % W, y = (i / W) | 0;
      for (const d of DIRS) {
        const n = idx(x + DX[d], y + DY[d]);
        if (seen[n]) continue;
        const pass = (tiles[n] === FLOOR && !blocked[n]) || secretIdx.has(n);
        if (!pass) continue;
        seen[n] = 1;
        if (tiles[n] === FLOOR) count++;
        q.push(n);
      }
    }
    let total = 0;
    for (let i = 0; i < N; i++) if (tiles[i] === FLOOR && !blocked[i]) total++;
    return count === total;
  };
  if (!connected()) return null;

  // --- Pillars in big halls ------------------------------------------------
  for (const r of rooms) {
    if (r.w < 6 || r.h < 5 || r.role === 'start') continue;
    const spots: [number, number][] = [
      [r.x + 1, r.y + 1], [r.x + r.w - 2, r.y + 1], [r.x + 1, r.y + r.h - 2], [r.x + r.w - 2, r.y + r.h - 2],
    ];
    if (r.w >= 8) spots.push([r.x + (r.w >> 1), r.y + 1], [r.x + (r.w >> 1), r.y + r.h - 2]);
    for (const [x, y] of spots) {
      const i = idx(x, y);
      if (reserved[i] || DIRS.some((d) => reserved[idx(x + DX[d], y + DY[d])])) continue;
      tiles[i] = PILLAR;
      if (!connected()) tiles[i] = FLOOR;
      else reserved[i] = true;
    }
  }

  // --- Props -------------------------------------------------------------------
  const props: Prop[] = [];
  let propN = 0;
  const nearReserved = (x: number, y: number) => reserved[idx(x, y)] || DIRS.some((d) => reserved[idx(x + DX[d], y + DY[d])]);
  const edgeTiles = (r: Room): [number, number][] => {
    const out: [number, number][] = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (tiles[idx(x, y)] !== FLOOR || blocked[idx(x, y)] || nearReserved(x, y)) continue;
      const onEdge = x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1;
      if (onEdge) out.push([x, y]);
    }
    return rng.shuffle(out);
  };
  const place = (kind: PropKind, x: number, y: number, tier: Prop['tier'], blocking: boolean): boolean => {
    const i = idx(x, y);
    if (tiles[i] !== FLOOR || blocked[i]) return false;
    if (blocking) {
      blocked[i] = true;
      if (!connected()) {
        blocked[i] = false;
        return false;
      }
    }
    if (!blocking) blocked[i] = kind !== 'bones' && kind !== 'fungus';
    const id = `p${propN++}`;
    props.push({
      id, kind, x, y, used: false, tier, blocking,
      mimic: kind === 'chest' && chestIsMimic(seed, id),
      ...(kind === 'shrine' ? { shrine: shrineKindFor(seed, id) } : {}),
    });
    return true;
  };
  const vessel: PropKind = biome.id === 'burrows' ? 'root_cache' : biome.id === 'mines' || biome.id === 'caverns' || biome.id === 'sporegrove' ? 'barrel' : 'urn';
  for (const r of rooms) {
    const spots = edgeTiles(r);
    const take = () => spots.pop();
    const put = (kind: PropKind, tier: Prop['tier'], blocking: boolean) => {
      for (let s = take(); s; s = take()) if (place(kind, s[0], s[1], tier, blocking)) return;
    };
    switch (r.role) {
      case 'start':
        if (rng.chance(0.25)) put(vessel, 'urn', true);
        break;
      case 'normal':
      case 'end':
        // A chest used to sit in a third of all ordinary rooms, and a floor
        // carried nineteen lootable things against a sixteen-slot pack. If
        // every room pays, no room is worth remembering.
        if (rng.chance(0.12)) put('chest', 'chest', true);
        if (rng.chance(0.45)) put(vessel, 'urn', true);
        // This second urn is a new roll. Keep it off the floor's shared stream
        // so a balance tweak cannot shift the later enemy and trap rolls.
        if (createRng(hashString(`extra-urn:${seed}:${r.x}:${r.y}`)).chance(0.15)) put(vessel, 'urn', true);
        if (rng.chance(0.5)) put('bones', 'none', false);
        break;
      case 'treasure':
        put('chest', 'chest', true);
        if (rng.chance(0.15)) put('chest', 'chest', true);
        for (let n = rng.int(1, 2); n > 0; n--) put(vessel, 'urn', true);
        break;
      case 'vault':
        put('chest', 'vault', true);
        put('bones', 'none', false);
        break;
      case 'secret':
        put('chest', 'secret', true);
        break;
      case 'shrine': {
        const sx = cx(r), sy = cy(r);
        if (!nearReserved(sx, sy)) place('shrine', sx, sy, 'none', true);
        if (rng.chance(0.4)) put(vessel, 'urn', true);
        break;
      }
      case 'throne':
        for (let n = 2; n > 0; n--) put(vessel, 'urn', true);
        put('bones', 'none', false);
        put('bones', 'none', false);
        break;
    }
  }
  if (biome.glow) {
    for (let i = 0; i < N; i++) {
      if (tiles[i] === FLOOR && !blocked[i] && !reserved[i] && rng.chance(biome.glow.density)) {
        props.push({ id: `p${propN++}`, kind: 'fungus', x: i % W, y: (i / W) | 0, used: false, tier: 'none', blocking: false, mimic: false });
      }
    }
  }

  // --- Torches -----------------------------------------------------------------
  const torches: Torch[] = [];
  const addTorch = (x: number, y: number, side: Dir) => torches.push({ x, y, side });
  const torchSpots: Torch[] = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (tiles[idx(x, y)] !== FLOOR || stairs.some((s) => s.x === x && s.y === y)) continue;
    const inRoom = roomOf[idx(x, y)] >= 0;
    for (const d of DIRS) {
      const wi = idx(x + DX[d], y + DY[d]);
      if (tiles[wi] !== WALL || secretIdx.has(wi)) continue;
      if (inRoom || rng.chance(0.25)) torchSpots.push({ x, y, side: d });
    }
  }
  rng.shuffle(torchSpots);
  // Always light the arrival point.
  {
    const near = torchSpots.filter((t) => Math.abs(t.x - spawn.x) + Math.abs(t.y - spawn.y) <= 2);
    if (near.length) addTorch(near[0].x, near[0].y, near[0].side);
  }
  for (const t of torchSpots) {
    if (torches.some((o) => Math.abs(o.x - t.x) + Math.abs(o.y - t.y) < 5)) continue;
    const inRoom = roomOf[idx(t.x, t.y)] >= 0;
    if (rng.chance(inRoom ? biome.torchDensity * 5 : biome.torchDensity * 2)) addTorch(t.x, t.y, t.side);
  }

  // --- Enemies -----------------------------------------------------------------
  const distFromSpawn = bfs(spawn.x, spawn.y);
  const occupied = new Set<number>();
  const free = (x: number, y: number) => {
    const i = idx(x, y);
    return tiles[i] === FLOOR && !blocked[i] && !reserved[i] && !occupied.has(i) && !doors.some((d) => d.x === x && d.y === y);
  };
  const enemies: EnemyState[] = [];
  let enemyN = 0;
  const spawnEnemy = (def: EnemyDef, x: number, y: number) => {
    occupied.add(idx(x, y));
    enemies.push(createEnemy(def, x, y, rng.pick(DIRS), `e${enemyN++}`, depth, diff.id));
  };
  const pool = ENEMIES.filter((e) => e.weight > 0 && e.minDepth <= depth && depth <= e.maxDepth
    && (e.id !== 'mole' || biome.id === 'burrows')
    && (!ELEMENTAL_VARIANT_IDS.has(e.id) || e.element === biome.element)
    && !(biome.element && e.element && e.element !== biome.element));
  const roomTiles = (r: Room) => {
    const out: [number, number][] = [];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      if (free(x, y) && distFromSpawn[idx(x, y)] >= 7) out.push([x, y]);
    }
    return rng.shuffle(out);
  };
  if (throne) {
    const bx = cx(throne), by = throne.y + 2;
    spawnEnemy(enemyDef(BOSS_ID), bx, by);
    const guard = enemyDef('hollow_knight');
    if (free(bx - 2, by + 3)) spawnEnemy(guard, bx - 2, by + 3);
    if (free(bx + 2, by + 3)) spawnEnemy(guard, bx + 2, by + 3);
  }
  // Fights last three to seven swings now instead of one, so the same count
  // would turn a floor into a queue. Fewer and deadlier is the trade.
  // Difficulty thins the crowd on Normal; Hard multiplies by exactly 1, so the
  // count — and therefore every RNG draw after it — is unchanged there.
  const wanted = Math.max(1, Math.round((3 + Math.round(depth * 1.2) + Math.floor(rooms.length / 4)) * diff.enemyCount));
  const hostRooms = rooms.filter((r) => r.role !== 'start' && r.role !== 'secret' && r.role !== 'throne');
  for (let guard = 0; enemies.length < wanted + (throne ? 3 : 0) && guard < 200; guard++) {
    const def = rng.weighted(pool.map((e) => [e,
      e.weight
      * (biome.favoredEnemies?.includes(e.id) ? FAVORED_ENEMY_WEIGHT : 1)
      * (biome.element && e.element === biome.element ? ELEMENTAL_ENEMY_WEIGHT : 1),
    ] as const));
    const group = def.id === 'rat' || def.id === 'spider' ? rng.int(1, 3) : rng.int(1, 2);
    if (rng.chance(0.15)) {
      // A wanderer in the tunnels.
      const x = rng.int(1, W - 2), y = rng.int(1, H - 2);
      if (roomOf[idx(x, y)] === -1 && free(x, y) && distFromSpawn[idx(x, y)] >= 8) spawnEnemy(def, x, y);
      continue;
    }
    const r = rng.weighted(hostRooms.map((h) => [h, h.w * h.h] as const));
    const spots = roomTiles(r);
    for (let g = 0; g < group && spots.length; g++) {
      const [x, y] = spots.pop()!;
      spawnEnemy(def, x, y);
    }
  }

  // --- Loose loot and keys -----------------------------------------------------
  const pickups: Pickup[] = [];
  let pickN = 0;
  const looseSpots = () => {
    const out: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0;
      if (roomOf[i] >= 0 && rooms[roomOf[i]].role !== 'vault' && free(x, y) && !pickups.some((p) => p.x === x && p.y === y)) out.push([x, y]);
    }
    return out;
  };
  {
    const spots = rng.shuffle(looseSpots());
    for (let n = 1 + Math.ceil(depth / 2); n > 0 && spots.length; n--) {
      const [x, y] = spots.pop()!;
      if (rng.chance(0.55)) {
        pickups.push({ id: `k${pickN++}`, x, y, items: [], gold: rng.int(2, 5) * depth });
      } else {
        const m = materialForDepth(rng, depth, ['metal', 'wood', 'hide', 'cloth', 'bone']);
        pickups.push({ id: `k${pickN++}`, x, y, items: [makeMaterial(m.id, rng.int(1, 2))], gold: 0 });
      }
    }
    for (const key of keys) {
      const far = rng.shuffle(looseSpots().filter(([x, y]) => distFromSpawn[idx(x, y)] >= 6 && roomOf[idx(x, y)] >= 0 && rooms[roomOf[idx(x, y)]].role !== 'vault'));
      const spot = far[0] ?? looseSpots()[0];
      if (!spot) return null;
      pickups.push({ id: `k${pickN++}`, x: spot[0], y: spot[1], items: [], gold: 0, keyId: key.id });
    }
  }

  // --- Traps -------------------------------------------------------------------
  // Corridors get the bulk of them, so a floor is more dangerous to hurry
  // through than to read. Chokepoints in front of treasure are seeded first:
  // the reward for greed should be the one you can see coming.
  const traps: Trap[] = [];
  {
    let trapN = 0;
    const taken = new Set<number>();
    const usable = (x: number, y: number): boolean => {
      const i = idx(x, y);
      if (tiles[i] !== FLOOR || blocked[i] || reserved[i] || taken.has(i)) return false;
      if (doors.some((d) => d.x === x && d.y === y) || stairs.some((st) => st.x === x && st.y === y)) return false;
      if (pickups.some((p) => p.x === x && p.y === y)) return false;
      // Never on the arrival tile or right on top of it — no ambush on spawn.
      if (Math.abs(x - spawn.x) + Math.abs(y - spawn.y) <= 3) return false;
      return true;
    };
    const wallDir = (x: number, y: number): Dir | null => {
      const opts = DIRS.filter((d) => tiles[idx(x + DX[d], y + DY[d])] === WALL);
      return opts.length ? rng.pick(opts) : null;
    };
    const add = (kind: TrapKind, x: number, y: number): boolean => {
      if (!usable(x, y)) return false;
      // A dart needs a wall to fire from; spikes and wards don't care.
      const d = kind === 'dart' ? wallDir(x, y) : (rng.pick(DIRS) as Dir);
      if (d === null) return false;
      taken.add(idx(x, y));
      traps.push({ id: `t${trapN++}`, kind, x, y, armed: true, found: false, dir: d });
      return true;
    };
    const pickKind = (): TrapKind => {
      const roll = rng.next();
      if (roll < 0.45) return 'dart';
      if (roll < 0.8) return 'spikes';
      return 'alarm';
    };

    // Guard the ways into the rooms worth robbing.
    for (const r of rooms) {
      if (r.role !== 'treasure' && r.role !== 'vault' && r.role !== 'secret') continue;
      if (!rng.chance(0.7)) continue;
      const inside: [number, number][] = [];
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) inside.push([x, y]);
      for (const [x, y] of rng.shuffle(inside)) if (add(rng.chance(0.6) ? 'spikes' : 'dart', x, y)) break;
    }

    // Then scatter the rest, corridors first.
    const corridor: [number, number][] = [];
    const roomTile: [number, number][] = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      if (!usable(x, y)) continue;
      (roomOf[idx(x, y)] >= 0 ? roomTile : corridor).push([x, y]);
    }
    rng.shuffle(corridor);
    rng.shuffle(roomTile);
    // Difficulty plants fewer teeth on Normal; Hard multiplies by exactly 1.
    const target = Math.max(1, Math.round((2 + Math.round(depth * 1.5)) * diff.trapCount));
    for (let n = traps.length; n < target; ) {
      const spot = (rng.chance(0.7) ? corridor.pop() : roomTile.pop()) ?? corridor.pop() ?? roomTile.pop();
      if (!spot) break;
      // Keep them apart: a corridor of back-to-back plates is a wall, not a trap.
      if (traps.some((t) => Math.abs(t.x - spot[0]) + Math.abs(t.y - spot[1]) < 4)) continue;
      if (add(pickKind(), spot[0], spot[1])) n++;
    }
  }

  if (biome.id === 'frostvault') props.push(...iciclesFor(seed, depth, tiles, W, [...stairs, ...doors]));

  return {
    depth, seed, biome: biome.id, width: W, height: H, tiles, explored: new Array(N).fill(0),
    rooms, doors, secrets, stairs, torches, props, pickups, enemies, keys, traps,
  };
}
