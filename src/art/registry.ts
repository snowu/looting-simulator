import { ArtDef, ArtResolver } from './raster';
import { TEXTURES } from './textures';
import { PROPS } from './props';
import { ICONS } from './icons';
import { UI_ART } from './ui';
import { ENEMY_ART_A } from './enemies-a';
import { ENEMY_ART_B } from './enemies-b';
import { VIEWMODELS } from './viewmodels';

export const ALL_ART: ArtDef[] = [...TEXTURES, ...PROPS, ...ICONS, ...UI_ART, ...ENEMY_ART_A, ...ENEMY_ART_B, ...VIEWMODELS];

const BY_ID = new Map(ALL_ART.map((a) => [a.id, a]));

export const getArt: ArtResolver = (id) => BY_ID.get(id);
