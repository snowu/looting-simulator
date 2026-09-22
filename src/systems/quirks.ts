/**
 * Rolling a floor strange, and dressing it once it is.
 *
 * This runs **after** generation, never inside it. `generateFloor` stays a
 * pure function of (run seed, depth, difficulty, road, seals) and its golden
 * hashes keep meaning what they meant; a quirk then walks the finished floor
 * and swaps creatures on tiles that were already chosen, promotes the
 * containers that were already placed, and writes one optional string.
 *
 * The roll has its own hashed stream (`quirk:…`), so adding it reshuffles
 * nothing that existed before it.
 */
import { Rng, createRng, hashString } from '../core/rng';
import { DifficultyId } from '../data/difficulty';
import { enemyDef } from '../data/enemies';
import {
  HERD_LARGE_HP, HERD_SMALL_HP, PASTURE_HERD, QUIRKS, QUIRK_CHANCE, QUIRK_CHANCE_PER_DEPTH,
  QUIRK_IDS, QUIRK_MAX_DEPTH, QUIRK_MIN_DEPTH, QuirkId, quirkDef,
} from '../data/quirks';
import { ContainerTier, makeUnique } from './items';
import { uniqueForQuirk } from '../data/uniques';
import { EnemyState, Floor, Prop, blocksMove, createEnemy, promoteElite } from './dungeon';
import { SHADE_ID } from './grave';
import { eligibleTraits } from '../data/elites';

/** The ladder a promoted container climbs. A secret is already the top. */
const TIER_LADDER: ContainerTier[] = ['urn', 'chest', 'vault', 'secret'];

/**
 * Which quirk this floor rolls, if any. Deterministic from the run seed and
 * the depth, so a floor you walk back up to and down into again is the same
 * strange floor — and so a bug report can be reproduced from a seed.
 */
export function rollQuirk(runSeed: number, depth: number, rng?: Rng): QuirkId | null {
  if (depth < QUIRK_MIN_DEPTH || depth > QUIRK_MAX_DEPTH) return null;
  const r = rng ?? createRng(hashString(`quirk:${runSeed}:${depth}`));
  const chance = QUIRK_CHANCE + QUIRK_CHANCE_PER_DEPTH * (depth - QUIRK_MIN_DEPTH);
  if (!r.chance(chance)) return null;
  const eligible = QUIRK_IDS.filter((id) => depth >= QUIRKS[id].minDepth && depth <= QUIRKS[id].maxDepth);
  if (!eligible.length) return null;
  return r.weighted(eligible.map((id) => [id, QUIRKS[id].weight] as const));
}

/**
 * Which of the herd stands in for a given creature. Matched by health rather
 * than by name, so a pasture is exactly as dangerous as the depth it sits at
 * and anything added to the roster later is already covered.
 */
export function herdFor(defId: string): string {
  const def = enemyDef(defId);
  if (def.hp >= HERD_LARGE_HP) return PASTURE_HERD.large;
  if (def.hp <= HERD_SMALL_HP) return PASTURE_HERD.small;
  return PASTURE_HERD.medium;
}

/** Promote a container by `steps`, stopping at the top of the ladder. */
function promote(tier: Prop['tier'], steps: number): Prop['tier'] {
  if (tier === 'none') return 'none';
  const at = TIER_LADDER.indexOf(tier);
  if (at < 0) return tier;
  return TIER_LADDER[Math.min(TIER_LADDER.length - 1, at + steps)];
}

/**
 * Dress a freshly generated floor as the quirk it rolled. Mutates the floor and
 * returns the quirk applied, or null if it rolled ordinary.
 *
 * Bosses, lieutenants, your Shade and anything already hidden are left exactly
 * as they are: a quirk changes what a floor is, never what a run owes you.
 */
export function applyQuirk(floor: Floor, runSeed: number, difficulty?: DifficultyId): QuirkId | null {
  const id = rollQuirk(runSeed, floor.depth);
  if (!id) return null;
  dressFloor(floor, id, runSeed, difficulty);
  return id;
}

/**
 * Dress a floor as a named quirk, skipping the roll.
 *
 * Split out so the dev lab can load a strange floor on demand: the natural
 * path is to delve until the dungeon decides, which is the right experience
 * for a player and a useless one for anyone tuning it. Nothing in the game
 * calls this directly — {@link applyQuirk} is the one the dungeon uses.
 */
export function dressFloor(floor: Floor, id: QuirkId, runSeed: number, difficulty?: DifficultyId): void {
  const def = QUIRKS[id];
  floor.quirk = id;

  if (def.lootBoost > 0) {
    for (const prop of floor.props) prop.tier = promote(prop.tier, def.lootBoost);
  }

  if (id === 'pasture') {
    const rng = createRng(hashString(`herd:${runSeed}:${floor.depth}`));
    const herd: EnemyState[] = [];
    for (const e of floor.enemies) {
      // A lieutenant, a Shade or a boss is a thing the run is tracking by id,
      // and the pasture is a costume rather than an amnesty.
      //
      // On the dungeon's own path none of the three is here yet — the
      // lieutenant and Shade passes run *after* the dressing, on purpose, so
      // that a pasture with no goblins in it cannot produce a Quartermaster
      // with nothing to command. The guard is kept anyway because this is the
      // only place that decides what a creature becomes, `dressFloor` is also
      // reachable from the dev lab, and an ordering that changes later should
      // fail by doing nothing rather than by eating your Shade.
      if (e.lieutenant || e.def === SHADE_ID || enemyDef(e.def).behavior === 'boss') {
        herd.push(e);
        continue;
      }
      const swap = enemyDef(herdFor(e.def));
      const cow = createEnemy(swap, e.x, e.y, e.facing, e.id, floor.depth, difficulty);
      // Whatever the floor had already decided about this creature that is not
      // about *what* it is carries over: where it lurks, whether it was marked,
      // and the elite trait it was promoted with. A cow can be an elite cow —
      // and without this the Pasture would be the one floor in the game with no
      // elites on it, which is a difficulty change nobody asked for.
      if (e.lurk) cow.lurk = e.lurk;
      if (e.marked) cow.marked = true;
      // Re-promoted rather than copied, so the trait's health multiplier is
      // baked into the cow's health rather than the thing it replaced. A trait
      // the herd cannot carry is dropped rather than faked.
      if (e.elite && eligibleTraits(swap).includes(e.elite)) promoteElite(cow, e.elite);
      herd.push(cow);
    }
    floor.enemies = herd;
    // One Prize Bull per pasture, standing where the biggest thing stood.
    const biggest = floor.enemies
      .filter((e) => e.def === PASTURE_HERD.large)
      .sort((a, b) => b.maxHp - a.maxHp)[0];
    if (biggest) {
      const prize = createEnemy(enemyDef('prize_bull'), biggest.x, biggest.y, biggest.facing, biggest.id, floor.depth, difficulty);
      floor.enemies[floor.enemies.indexOf(biggest)] = prize;
    } else {
      // A pasture with nothing big enough in it still gets its champion: the
      // rosette is the point of the floor. Only ever in place of a cow —
      // picking from the whole array would let the rosette land on the very
      // lieutenant or Shade the loop above went out of its way to spare, and
      // destroy an enemy the run is tracking by id.
      const cattle = floor.enemies.filter((c) => (Object.values(PASTURE_HERD) as string[]).includes(c.def));
      if (cattle.length) {
        const any = rng.pick(cattle);
        const prize = createEnemy(enemyDef('prize_bull'), any.x, any.y, any.facing, any.id, floor.depth, difficulty);
        floor.enemies[floor.enemies.indexOf(any)] = prize;
      }
    }
  }

  plantRelic(floor, id, runSeed);
}

/**
 * The souvenir. Each strange floor carries exactly one relic that exists
 * nowhere else, dropped as a pickup rather than shuffled into a container, so
 * that finding the floor *is* finding the relic — no second roll, no chest you
 * might walk past.
 *
 * It goes on the tile furthest from the arrival stair that has nothing else on
 * it, which on a pasture is usually somewhere past the Prize Bull. The floor
 * is the reward; the walk across it is the price.
 */
function plantRelic(floor: Floor, quirk: QuirkId, runSeed: number): void {
  const def = uniqueForQuirk(quirk);
  if (!def) return;
  const rng = createRng(hashString(`relic:${runSeed}:${floor.depth}`));
  const up = floor.stairs.find((s) => !s.down) ?? floor.stairs[0];
  const taken = new Set(floor.pickups.map((p) => `${p.x},${p.y}`));
  for (const p of floor.props) taken.add(`${p.x},${p.y}`);
  const far = floor.rooms
    .flatMap((r) => {
      const out: { x: number; y: number }[] = [];
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) out.push({ x, y });
      return out;
    })
    .filter((t) => !blocksMove(floor, t.x, t.y) && !taken.has(`${t.x},${t.y}`) && !floor.stairs.some((s) => s.x === t.x && s.y === t.y))
    .sort((a, b) => (Math.abs(b.x - up.x) + Math.abs(b.y - up.y)) - (Math.abs(a.x - up.x) + Math.abs(a.y - up.y)))[0];
  if (!far) return;
  floor.pickups.push({
    id: `relic_${quirk}_${floor.depth}`,
    x: far.x, y: far.y,
    // Unidentified, like every other relic: the name is supposed to land at
    // the appraiser rather than in a corridor.
    items: [makeUnique(def, rng, floor.depth, false)],
    gold: 0,
  });
}

export { quirkDef };
