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
];

export function biomeForDepth(depth: number): BiomeDef {
  return BIOMES.find((b) => b.depths.includes(depth)) ?? BIOMES[BIOMES.length - 1];
}
