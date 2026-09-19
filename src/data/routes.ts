/**
 * The route fork: the one road decision in a delve.
 *
 * Going down from depth 2, the stair splits. Two roads are open, and the one
 * you take sets the biome of depths 3 and 4; the other is sealed for the rest
 * of the delve. Which two are open is decided by the day, not the delve, and
 * tilted by what is happening in Bleakmere: an Iron Shortage means the mine
 * road is open, a Harsh Winter the frozen one. The town's news names them, so
 * you can prepare for the road you mean to take.
 *
 * Depth 5 still rolls its own biome: the road is two floors, not the rest of
 * the delve.
 */
import { createRng, hashString } from '../core/rng';

/** The depth whose down stair forks. */
export const FORK_DEPTH = 2;
/** The depths a road sets the biome of. */
export const ROAD_DEPTHS = [3, 4];

export interface RoadDef {
  biome: string;
  name: string;
  danger: string;
  reward: string;
  color: string;
}

export const ROADS: Record<string, RoadDef> = {
  mines: {
    biome: 'mines', name: 'The Mine Road', color: '#c8a070',
    danger: 'Goblin shieldbearers, the Barrow Champion, burrowers under the rubble.',
    reward: 'Metal: ore spills from the seams, and the goblins carry iron.',
  },
  frostvault: {
    biome: 'frostvault', name: 'The Frozen Road', color: '#9ad0ff',
    danger: 'Frost wisps and icebound guards. Fire answers them; frost does nothing.',
    reward: 'Frost shards and moonstone.',
  },
  emberworks: {
    biome: 'emberworks', name: 'The Ember Road', color: '#ff9a50',
    danger: 'Flame wraiths and molten floors. Frost answers them; fire does nothing.',
    reward: 'Flame shards and sunstone.',
  },
  sporegrove: {
    biome: 'sporegrove', name: 'The Spore Road', color: '#8ce07a',
    danger: 'Spore hunters and the Bog Seraph, a champion that hits like a vault guardian.',
    reward: 'Leather and crystal.',
  },
};

export const ROAD_BIOMES = Object.keys(ROADS);

/** How a market event tilts the roads: an event makes its road this many times likelier. */
export const EVENT_ROADS: Record<string, Record<string, number>> = {
  iron_shortage: { mines: 3 },
  war_drums: { mines: 2 },
  harsh_winter: { frostvault: 3 },
  dragon_sighting: { emberworks: 3 },
  forge_fire: { emberworks: 2 },
  arcane_study: { sporegrove: 3 },
  royal_wedding: { sporegrove: 2 },
};

/**
 * The two roads open on a given day. Deterministic from the playthrough and the
 * day, so the town can name them before the delve and the delve agrees.
 */
export function roadsForDay(saveId: string, day: number, events: { id: string }[]): string[] {
  const rng = createRng(hashString(`roads:${saveId}:${day}`));
  const weight = (biome: string) => events.reduce((w, ev) => w * (EVENT_ROADS[ev.id]?.[biome] ?? 1), 1);
  const first = rng.weighted(ROAD_BIOMES.map((b) => [b, weight(b)] as const));
  const second = rng.weighted(ROAD_BIOMES.filter((b) => b !== first).map((b) => [b, weight(b)] as const));
  return [first, second];
}
