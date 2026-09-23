import { EnemyDef } from '../types';

type VariantOverrides = Pick<EnemyDef, 'id' | 'name' | 'sprite' | 'element' | 'damageType' | 'resist' | 'loot' | 'description'>;
/** Only identity, element and drops vary; combat timing and scaling stay inherited. */
export function elementalVariant(base: EnemyDef, overrides: VariantOverrides): EnemyDef {
  // A variant spawns in the ordinary 1–2 whatever its base's pack, as it always has.
  return { ...base, ...overrides, weight: base.weight * 0.5, pack: undefined };
}
export const ELEMENTAL_VARIANTS = [
  { base: 'skeleton', id: 'skeleton_ember', name: 'Scorched Bones', sprite: 'skelember', element: 'fire', description: 'The furnace has burned everything away except the worker. Coals still settle between its ribs.' },
  { base: 'skeleton_shield', id: 'skeleton_shield_ember', name: 'Cinder Guard', sprite: 'cinderguard', element: 'fire', description: 'Still guarding a furnace nobody tends. The shield boss is hot enough to leave its mark on stone.' },
  { base: 'spider', id: 'spider_ember', name: 'Emberback', sprite: 'emberback', element: 'fire', description: 'It nests beneath cooling slag. Each step opens another glowing seam across its shell.' },
  { base: 'ghoul', id: 'ghoul_ember', name: 'Slagborn', sprite: 'slagborn', element: 'fire', description: 'Something pulled itself from the waste crucible. Its shoulders never quite stop dripping.' },
  { base: 'skeleton', id: 'skeleton_frost', name: 'Rimebound', sprite: 'rimebound', element: 'frost', description: 'Ice stitches the bones together where tendons used to be. They creak like a frozen branch before each swing.' },
  { base: 'bat', id: 'bat_frost', name: 'Hoarfrost Bat', sprite: 'hoarbat', element: 'frost', description: 'A pale scrap of wing loosens from the ceiling. A little snow follows it down.' },
  { base: 'ghoul', id: 'ghoul_frost', name: 'Frozen Wretch', sprite: 'frozenwretch', element: 'frost', description: 'It spent a winter waiting here. Then another. The ice on its shoulders has outlived the door it was watching.' },
  { base: 'goblin_shield', id: 'goblin_shield_frost', name: 'Glacier Goblin', sprite: 'glaciergoblin', element: 'frost', description: 'A stolen shield, a stolen coat, and an icicle sharpened on the wall. It considers this an excellent posting.' },
] as const;
export const ELEMENTAL_VARIANT_IDS = new Set<string>(ELEMENTAL_VARIANTS.map((v) => v.id));
