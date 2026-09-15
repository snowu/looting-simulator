export interface BiomeDef {
  id: string;
  name: string;
  depths: number[];
  wall: string;
  /** Alternate wall texture, mixed in for variety. */
  wallAlt: string;
  /** Position-hashed wall choices; repeated IDs provide weighting. */
  wallVariants?: string[];
  /** Wall texture hinting at a secret passage. */
  wallSecret: string;
  floor: string;
  floorVariants?: string[];
  ceiling: string;
  ceilingVariants?: string[];
  door: string;
  fog: string;
  ambient: string;
  torch: string;
  /** Chance per room-wall tile of a torch sconce. */
  torchDensity: number;
  /** Extra coloured glows (e.g. fungus) scattered on the floor. */
  glow?: { color: string; density: number; sprite: string };
  /** Enemy families that are more common on this floor. */
  favoredEnemies?: string[];
  /** Elemental theme: aligned creatures are favored and the opposite is excluded. */
  element?: 'fire' | 'frost';
}

export const FINAL_DEPTH = 6;

export const BIOMES: BiomeDef[] = [
  {
    id: 'crypt', name: 'The Ossuary', depths: [1, 2],
    wall: 'wall_crypt', wallAlt: 'wall_crypt_b', wallSecret: 'wall_crypt_s',
    floor: 'floor_crypt', ceiling: 'ceil_crypt', door: 'door_wood',
    fog: '#040308', ambient: '#24212e', torch: '#ffc488', torchDensity: 0.07,
  },
  {
    id: 'mines', name: 'The Deep Mines', depths: [3, 4],
    wall: 'wall_mine', wallAlt: 'wall_mine_b', wallSecret: 'wall_mine_s',
    floor: 'floor_mine', ceiling: 'ceil_mine', door: 'door_wood',
    fog: '#080503', ambient: '#2a2016', torch: '#ffb870', torchDensity: 0.06,
  },
  {
    id: 'throne', name: 'The Ashen Throne', depths: [6],
    wall: 'wall_throne', wallAlt: 'wall_throne_b', wallSecret: 'wall_throne_s',
    floor: 'floor_throne', ceiling: 'ceil_throne', door: 'door_iron',
    fog: '#090103', ambient: '#2a1014', torch: '#ff9a6a', torchDensity: 0.08,
  },
  {
    id: 'catacombs', name: 'The Sunken Catacombs', depths: [1, 2, 3],
    wall: 'wall_catacombs', wallAlt: 'wall_catacombs_b', wallSecret: 'wall_catacombs_s',
    floor: 'floor_cave', ceiling: 'ceil_crypt', door: 'door_wood',
    fog: '#061013', ambient: '#20333b', torch: '#86c9d4', torchDensity: 0.035,
    glow: { color: '#55b9bc', density: 0.025, sprite: 'fungus' },
    favoredEnemies: ['rat', 'bat', 'skeleton', 'drowned_bones'],
  },
  {
    id: 'burrows', name: 'The Vermin Burrows', depths: [1, 2, 3],
    wall: 'wall_burrows', wallAlt: 'wall_burrows_b', wallSecret: 'wall_burrows_s',
    // Burrows inherit the preceding floor's ground texture at render time.
    // Keep a packed-earth roof as the depth-1 fallback, where no preceding floor exists.
    floor: 'floor_burrows', ceiling: 'ceil_burrows', door: 'door_wood',
    fog: '#0e0904', ambient: '#3a2b1a', torch: '#ffbb70', torchDensity: 0.055,
    favoredEnemies: ['rat', 'bat', 'spider', 'goblin', 'tunnel_stalker', 'mole'],
  },
  {
    id: 'frostvault', name: 'The Frost Vault', depths: [3, 4, 5],
    wall: 'wall_frostvault', wallAlt: 'wall_frostvault_b', wallSecret: 'wall_frostvault_s',
    wallVariants: ['wall_frostvault', 'wall_frostvault_glaze', 'wall_frostvault_fall', 'wall_frostvault_split', 'wall_frostvault_grate'],
    floorVariants: ['floor_frostvault', 'floor_frostvault_ice'],
    floor: 'floor_frostvault', ceiling: 'ceil_frostvault', door: 'door_iron',
    fog: '#050b17', ambient: '#23344c', torch: '#a9d5ff', torchDensity: 0.04, element: 'frost',
    favoredEnemies: ['frost_wisp', 'skeleton_archer', 'skeleton_shield', 'icebound_guard', 'elemental_frost'],
  },
  {
    id: 'emberworks', name: 'The Emberworks', depths: [3, 4, 5],
    wall: 'wall_emberworks', wallAlt: 'wall_emberworks_b', wallSecret: 'wall_emberworks_s',
    wallVariants: ['wall_emberworks', 'wall_emberworks', 'wall_emberworks_seam', 'wall_emberworks_pool', 'wall_emberworks_grate'],
    ceilingVariants: ['ceil_emberworks', 'ceil_emberworks_shelf', 'ceil_emberworks_blister', 'ceil_emberworks_split'],
    floorVariants: ['floor_emberworks', 'floor_emberworks_shelf', 'floor_emberworks_shards', 'floor_emberworks_vent'],
    floor: 'floor_emberworks', ceiling: 'ceil_emberworks', door: 'door_iron',
    fog: '#160603', ambient: '#483022', torch: '#ff7848', torchDensity: 0.09, element: 'fire',
    favoredEnemies: ['ember_wisp', 'flame_wraith', 'goblin_shield', 'cinder_raider'],
  },
  {
    id: 'sporegrove', name: 'The Sporegrove', depths: [3, 4, 5],
    wall: 'wall_cave', wallAlt: 'wall_cave_b', wallSecret: 'wall_cave_s',
    floor: 'floor_cave', ceiling: 'ceil_cave', door: 'door_wood',
    fog: '#071007', ambient: '#293c22', torch: '#b8dc78', torchDensity: 0.025,
    glow: { color: '#9acf65', density: 0.085, sprite: 'fungus' },
    favoredEnemies: ['spider', 'ghoul', 'bat', 'spore_hunter', 'bog_seraph'],
  },
];

/**
 * The old depth-5 biome remains readable for saves made before Sporegrove
 * replaced its duplicate walls. It is not selectable for newly generated
 * floors and is intentionally absent from the art sheet.
 */
const LEGACY_BIOMES: BiomeDef[] = [
  {
    id: 'caverns', name: 'The Glowing Warrens', depths: [5],
    wall: 'wall_cave', wallAlt: 'wall_cave_b', wallSecret: 'wall_cave_s',
    floor: 'floor_cave', ceiling: 'ceil_cave', door: 'door_iron',
    fog: '#020705', ambient: '#1c3028', torch: '#ffc890', torchDensity: 0.045,
    glow: { color: '#40e0c0', density: 0.05, sprite: 'fungus' },
  },
];

export function biomeForDepth(depth: number, seed?: number): BiomeDef {
  const choices = BIOMES.filter((b) => b.depths.includes(depth));
  if (!choices.length) return BIOMES.find((b) => b.id === 'throne')!;
  return choices[seed === undefined ? 0 : (seed >>> 0) % choices.length];
}

export function biomeForFloor(floor: { biome: string; depth: number }): BiomeDef {
  return BIOMES.find((b) => b.id === floor.biome)
    ?? LEGACY_BIOMES.find((b) => b.id === floor.biome)
    ?? biomeForDepth(floor.depth);
}

/** The roof texture for a floor, including the Burrows' transition from above. */
export function ceilingForFloor(
  floor: { biome: string; depth: number },
  previous?: { biome: string; depth: number },
): string {
  const biome = biomeForFloor(floor);
  return biome.id === 'burrows' && previous ? biomeForFloor(previous).floor : biome.ceiling;
}
