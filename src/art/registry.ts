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
import { VIEWMODELS } from './viewmodels';

export const ALL_ART: ArtDef[] = [...TEXTURES, ...FROST_TEXTURES, ...PROPS, ...BIOME_PROPS, ...ICONS, ...UI_ART, ...ENEMY_ART_A, ...ENEMY_ART_B, ...ENEMY_ART_VARIETY, ...ENEMY_ART_ELEMENTAL, ...ENEMY_ART_BIOMES, ...ENEMY_ART_PASTURE, ...VIEWMODELS];

const BY_ID = new Map(ALL_ART.map((a) => [a.id, a]));

export const getArt: ArtResolver = (id) => BY_ID.get(id);
