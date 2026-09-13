export interface BiomeDef {
  id: string;
  name: string;
  depths: number[];
  wall: string;
  /** Alternate wall texture, mixed in for variety. */
  wallAlt: string;
  /** Wall texture hinting at a secret passage. */
  wallSecret: string;
  floor: string;
  ceiling: string;
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
    id: 'caverns', name: 'The Glowing Warrens', depths: [5],
    wall: 'wall_cave', wallAlt: 'wall_cave_b', wallSecret: 'wall_cave_s',
    floor: 'floor_cave', ceiling: 'ceil_cave', door: 'door_iron',
    fog: '#020705', ambient: '#1c3028', torch: '#ffc890', torchDensity: 0.045,
    glow: { color: '#40e0c0', density: 0.05, sprite: 'fungus' },
  },
  {
    id: 'throne', name: 'The Ashen Throne', depths: [6],
    wall: 'wall_throne', wallAlt: 'wall_throne_b', wallSecret: 'wall_throne_s',
    floor: 'floor_throne', ceiling: 'ceil_throne', door: 'door_iron',
    fog: '#090103', ambient: '#2a1014', torch: '#ff9a6a', torchDensity: 0.08,
  },
  {
    id: 'catacombs', name: 'The Sunken Catacombs', depths: [1, 2, 3],
    wall: 'wall_crypt', wallAlt: 'wall_crypt_b', wallSecret: 'wall_crypt_s',
    floor: 'floor_cave', ceiling: 'ceil_crypt', door: 'door_wood',
    fog: '#061013', ambient: '#20333b', torch: '#86c9d4', torchDensity: 0.035,
    glow: { color: '#55b9bc', density: 0.025, sprite: 'fungus' },
    favoredEnemies: ['rat', 'bat', 'skeleton', 'drowned_bones'],
  },
  {
    id: 'burrows', name: 'The Vermin Burrows', depths: [1, 2, 3],
    wall: 'wall_burrows', wallAlt: 'wall_burrows_b', wallSecret: 'wall_burrows_s',
    floor: 'floor_burrows', ceiling: 'floor_cave', door: 'door_wood',
    fog: '#0e0904', ambient: '#3a2b1a', torch: '#ffbb70', torchDensity: 0.055,
    favoredEnemies: ['rat', 'bat', 'spider', 'goblin', 'tunnel_stalker'],
  },
  {
    id: 'frostvault', name: 'The Frost Vault', depths: [3, 4, 5],
    wall: 'wall_crypt', wallAlt: 'wall_crypt_b', wallSecret: 'wall_crypt_s',
    floor: 'floor_frostvault', ceiling: 'ceil_crypt', door: 'door_iron',
    fog: '#050b17', ambient: '#23344c', torch: '#a9d5ff', torchDensity: 0.04,
    favoredEnemies: ['frost_wisp', 'skeleton_archer', 'skeleton_shield', 'icebound_guard', 'elemental_frost'],
  },
  {
    id: 'emberworks', name: 'The Emberworks', depths: [3, 4, 5],
    wall: 'wall_emberworks', wallAlt: 'wall_emberworks_b', wallSecret: 'wall_emberworks_s',
    floor: 'floor_emberworks', ceiling: 'ceil_mine', door: 'door_iron',
    fog: '#160603', ambient: '#483022', torch: '#ff7848', torchDensity: 0.09,
    favoredEnemies: ['ember_wisp', 'flame_wraith', 'goblin_shield', 'cinder_raider'],
  },
  {
    id: 'sporegrove', name: 'The Sporegrove', depths: [3, 4, 5],
    wall: 'wall_cave', wallAlt: 'wall_cave_b', wallSecret: 'wall_cave_s',
    floor: 'floor_cave', ceiling: 'ceil_cave', door: 'door_wood',
    fog: '#071007', ambient: '#293c22', torch: '#b8dc78', torchDensity: 0.025,
    glow: { color: '#9acf65', density: 0.085, sprite: 'fungus' },
    favoredEnemies: ['spider', 'ghoul', 'bat', 'spore_hunter'],
  },
];

export function biomeForDepth(depth: number, seed?: number): BiomeDef {
  const choices = BIOMES.filter((b) => b.depths.includes(depth));
  if (!choices.length) return BIOMES.find((b) => b.id === 'throne')!;
  return choices[seed === undefined ? 0 : (seed >>> 0) % choices.length];
}

export function biomeForFloor(floor: { biome: string; depth: number }): BiomeDef {
  return BIOMES.find((b) => b.id === floor.biome) ?? biomeForDepth(floor.depth);
}
