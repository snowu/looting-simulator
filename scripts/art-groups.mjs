// The sprite groups spritewright's Context view compares a sprite against
// (docs/art-groups.json, named by spritewright.config.json): an enemy beside
// the creatures it shares a floor with, a sword icon beside the other blades
// and the blade it is held as, a wall beside its biome's floor and ceiling.
// Built from the game's own data, so the groups follow the game; art:sync
// writes the file and art:check fails when it is out of date.
//
// Each group: { "background": "#rrggbb"?, "sprites": ["public/art/<folder>/<id>.png", ...] }.
// A sprite can sit in several; spritewright opens the first one that holds it.
import { loadModule } from './art-lib.mjs';

export const GROUPS_FILE = 'docs/art-groups.json';

export async function artGroups({ ALL_ART, artFile }) {
  const { BIOMES } = await loadModule('src/data/biomes.ts');
  const { ENEMIES, spawnPool } = await loadModule('src/data/enemies.ts');
  const { ITEM_BASES, CONSUMABLES, viewmodelFor } = await loadModule('src/data/items.ts');
  const { MATERIALS } = await loadModule('src/data/materials.ts');

  const known = new Set(ALL_ART.map((d) => d.id));
  const groups = {};
  const add = (name, ids, background) => {
    const sprites = [...new Set(ids)].filter((id) => known.has(id)).map((id) => `public/art/${artFile(id)}`);
    if (sprites.length > 1) groups[name] = background ? { background, sprites } : { sprites };
  };
  const pose = (e) => `${e.sprite}_0`;
  const ids = (re) => ALL_ART.map((d) => d.id).filter((id) => re.test(id));

  // Enemies: by the floors they spawn on first (what the player sees together), then by kind.
  for (const b of BIOMES) {
    const pool = [...new Set(b.depths.flatMap((d) => spawnPool(b, d)))];
    pool.sort((x, y) => Number(!!b.favoredEnemies?.includes(y.id)) - Number(!!b.favoredEnemies?.includes(x.id)));
    add(`Enemies · ${b.name}`, pool.map(pose), b.fog);
  }
  const kinds = { melee: 'Melee enemies', ranged: 'Ranged enemies', skittish: 'Skittish creatures', boss: 'Bosses' };
  for (const [behavior, name] of Object.entries(kinds)) add(name, [...ENEMIES.filter((e) => e.behavior === behavior).map(pose), ...(behavior === 'boss' ? ids(/^king_.*_0$/) : [])]);
  add('Undead', ENEMIES.filter((e) => e.undead).map(pose));
  add('Fire creatures', ENEMIES.filter((e) => e.element === 'fire').map(pose));
  add('Frost creatures', ENEMIES.filter((e) => e.element === 'frost').map(pose));

  // Textures and doors: every surface of a biome, on its fog colour.
  for (const b of BIOMES) {
    const own = [b.wall, b.wallAlt, b.wallSecret, ...(b.wallVariants ?? []), b.floor, ...(b.floorVariants ?? []),
      b.ceiling, ...(b.ceilingVariants ?? []), b.door, ...Object.values(b.timberSets ?? {}).filter((v) => typeof v === 'string')];
    add(`Surfaces · ${b.name}`, [...own, ...ids(new RegExp(`^${b.wall}_`))], b.fog);
  }

  // Weapons: icons of one class, then the viewmodels they are held as.
  const weapons = ITEM_BASES.filter((i) => i.slot === 'weapon' && i.weaponClass);
  for (const cls of [...new Set(weapons.map((i) => i.weaponClass))]) {
    const of = weapons.filter((i) => i.weaponClass === cls);
    add(`Weapons · ${cls}`, [...of.map((i) => i.icon), ...of.map(viewmodelFor)]);
  }
  add('Melee weapons', weapons.filter((i) => i.weaponClass !== 'thrown').map((i) => i.icon));
  add('Ranged: thrown weapons and projectiles', [...ITEM_BASES.filter((i) => i.slot === 'thrown').map((i) => i.icon), ...ids(/^(proj_|pickup_(knives|axes|javelins))/)]);
  add('Spells and conduits', [...ids(/^ic_spell_/), ...ids(/^ic_(wand|rod|stave)$/), ...ids(/^vm_(wand|rod|stave)/), ...ids(/^proj_(frost|fire|shadow|fireball|icicle)/), ...ids(/^fx_/)]);
  add('Shields', [...ITEM_BASES.filter((i) => i.slot === 'offhand').map((i) => i.icon).filter((id) => !/wand|rod|stave/.test(id)), ...ids(/shield$/).filter((id) => id.startsWith('vm_'))]);
  for (const slot of ['head', 'body', 'hands']) add(`Armour · ${slot}`, ITEM_BASES.filter((i) => i.slot === slot).map((i) => i.icon));
  add('Rings and amulets', ITEM_BASES.filter((i) => i.slot === 'ring' || i.slot === 'amulet').map((i) => i.icon));
  add('Consumables', CONSUMABLES.map((c) => c.icon));
  add('Materials', MATERIALS.map((m) => m.icon));
  add('Sigils', [...ids(/^ic_sig_/), ...ids(/^vm_sigil/)]);
  add('Rites: marks and carvings', [...ids(/^ic_rite_/), ...ids(/^carving/), ...ids(/^fx_(blast|frost|smite|poof)/)]);

  // Props, by what they are in the dungeon.
  add('Containers', ids(/^(chest|urn|barrel|root_cache|mimic)/));
  add('Shrines', ids(/^shrine/));
  add('Traps and wards', ids(/^(trap_|ward_)/));
  add('Surfaces underfoot', ids(/^surf_/));
  add('Ice and fire on the walls', ids(/^(icicle_|flame_|fx_flame_|sconce)/));
  return groups;
}
