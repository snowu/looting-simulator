import { ArtDef, ArtResolver } from './raster';
import { TEXTURES } from './textures';
import { FROST_TEXTURES } from './frost-textures';
import { BIOME_PROPS } from './biome-props';
import { PROPS } from './props';
import { ICONS } from './icons';
import { UI_ART } from './ui';
import { ENEMY_ART_A } from './enemies-a';
import { ENEMY_ART_B } from './enemies-b';
import { ENEMY_ART_VARIETY } from './enemies-variety';
import { ENEMY_ART_BIOMES } from './enemies-biomes';
import { ENEMY_ART_ELEMENTAL } from './enemies-elemental';
import { ENEMY_ART_PASTURE } from './enemies-pasture';
import { PENGUIN_ART, SPELL_FX_ART, SPELL_MARK_ART } from './spell-fx';
import { SURFACE_ART } from './surfaces';
import { VIEWMODELS } from './viewmodels';

export const ALL_ART: ArtDef[] = [...TEXTURES, ...FROST_TEXTURES, ...PROPS, ...BIOME_PROPS, ...ICONS, ...UI_ART, ...ENEMY_ART_A, ...ENEMY_ART_B, ...ENEMY_ART_VARIETY, ...ENEMY_ART_ELEMENTAL, ...ENEMY_ART_BIOMES, ...ENEMY_ART_PASTURE, ...SPELL_FX_ART, ...SURFACE_ART, ...VIEWMODELS];

const BY_ID = new Map(ALL_ART.map((a) => [a.id, a]));

/**
 * Where each sprite's PNG lives: `public/art/<folder>/<id>.png`. The folders are
 * how an artist browses the art (and how spritewright lists it); the game only
 * reads the paths from `public/art/manifest.json`, which `npm run art:sync` writes.
 */
export const ART_FOLDERS: Record<string, ArtDef[]> = {
  enemies: [...ENEMY_ART_A, ...ENEMY_ART_B, ...ENEMY_ART_VARIETY, ...ENEMY_ART_ELEMENTAL, ...ENEMY_ART_BIOMES, ...ENEMY_ART_PASTURE, ...PENGUIN_ART],
  icons: ICONS,
  props: [...PROPS, ...BIOME_PROPS, ...SPELL_MARK_ART, ...SURFACE_ART],
  textures: [...TEXTURES, ...FROST_TEXTURES],
  ui: UI_ART,
  viewmodels: VIEWMODELS,
};
const FOLDER_OF = new Map(Object.entries(ART_FOLDERS).flatMap(([folder, defs]) => defs.map((d) => [d.id, folder] as const)));

/** A sprite's PNG, relative to `public/art/`: `enemies/rat_0.png`. */
export const artFile = (id: string): string => {
  const folder = FOLDER_OF.get(id);
  if (!folder) throw new Error(`art ${id} has no folder (add its list to ART_FOLDERS)`);
  return `${folder}/${id}.png`;
};

export const getArt: ArtResolver = (id) => BY_ID.get(id);
