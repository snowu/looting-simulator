/**
 * What the art sheet shows, and in what order. DOM-free on purpose: the
 * in-game dev overlay (`src/dev/art-sheet.ts`) and the PNG exporter
 * (`scripts/art-sheet.mjs`) both read these, so a sheet posted on a pull
 * request is the same sheet the game shows.
 *
 * The creature groups are derived from the enemy table rather than listed, so
 * a new creature turns up on the sheet the moment it exists — which is the
 * whole point of having the tool.
 */
import { ENEMIES, KING_PHASES } from '../data/enemies';
import { BIOMES } from '../data/biomes';
import { ICONS } from '../art/icons';
import { MATERIALS } from '../data/materials';
import { PROPS } from '../art/props';
import { VIEWMODELS } from '../art/viewmodels';
import { EnemyDef } from '../types';

/** Everything the pose model needs to play a creature's attack, plus its name. */
export interface Creature {
  name: string;
  sprite: string;
  windup: number;
  recovery: number;
  ranged: boolean;
  hasShield: boolean;
  floats: boolean;
  scale: number;
}

export interface SheetCell {
  /** The art shown when the sheet is held still. */
  id: string;
  label: string;
  /** Set when the cell can be played through a full attack. */
  creature?: Creature;
}

/**
 * Art whose `1`-`4` pixels are a material ramp is never shown in the game
 * without one — an icon sheet drawn flat is a sheet of the one version of the
 * icon nobody ever sees. These are the ramps to look at it through.
 */
export const RAMPS: { id: string; name: string; ramp: readonly [string, string, string, string] }[] =
  ['iron', 'copper', 'gold', 'moonsilver', 'shadewood', 'dragon_scale']
    .map((id) => MATERIALS.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => !!m)
    .map((m) => ({ id: m.id, name: m.name.replace(/ (Ore|Log|Hide|Scale|Cloth)$/, ''), ramp: m.ramp }));

export interface SheetGroup {
  title: string;
  cells: SheetCell[];
}

export interface ArtSheet {
  id: string;
  title: string;
  note: string;
  /** Cells per row in the exported PNG; the in-game sheet wraps to fit. */
  cols: number;
  groups: SheetGroup[];
}

/** Which family a creature belongs to — the axis this whole pass is about. */
export type CreatureClass = 'melee' | 'ranged' | 'guard' | 'boss';

export function creatureClass(def: Pick<EnemyDef, 'behavior' | 'shield' | 'projectile'>): CreatureClass {
  if (def.behavior === 'boss') return 'boss';
  if (def.shield) return 'guard';
  if (def.behavior === 'ranged' && def.projectile) return 'ranged';
  return 'melee';
}

function creatureOf(def: EnemyDef): Creature {
  return {
    name: def.name,
    sprite: def.sprite,
    windup: def.windup,
    recovery: def.recovery,
    ranged: def.behavior === 'ranged',
    hasShield: !!def.shield,
    floats: !!def.floats,
    scale: def.scale,
  };
}

/** Every creature the renderer can draw, the King once per phase. */
export const CREATURES: Creature[] = [
  ...ENEMIES.filter((d) => d.behavior !== 'boss').map(creatureOf),
  ...ENEMIES.filter((d) => d.behavior === 'boss').flatMap((d) =>
    KING_PHASES.map((phase, i) => ({
      ...creatureOf(d),
      name: `${d.name} · phase ${i + 1}`,
      sprite: phase.sprite,
      windup: phase.windup,
      recovery: phase.recovery,
      hasShield: !!phase.shield,
    })),
  ),
];

const CLASS_OF = new Map<string, CreatureClass>([
  ...ENEMIES.map((d) => [d.sprite, creatureClass(d)] as const),
  ...KING_PHASES.map((p) => [p.sprite, 'boss' as CreatureClass] as const),
]);

export const creatureClassOf = (sprite: string): CreatureClass => CLASS_OF.get(sprite) ?? 'melee';

/** Idle, attack, and the guard for anything that carries a shield. */
export function creaturePoses(c: Creature): string[] {
  return c.hasShield ? ['0', 'atk', 'block'] : ['0', 'atk'];
}

function creatureGroup(title: string, cls: CreatureClass): SheetGroup {
  return {
    title,
    cells: CREATURES.filter((c) => creatureClassOf(c.sprite) === cls).flatMap((c) =>
      creaturePoses(c).map((pose) => ({
        id: `${c.sprite}_${pose}`,
        label: `${c.name}${pose === '0' ? '' : pose === 'atk' ? ' · attack' : ' · guard'}`,
        creature: c,
      })),
    ),
  };
}

const biomeGroups: SheetGroup[] = BIOMES.map((b) => ({
  title: b.name,
  cells: [
    { id: b.wall, label: 'wall' },
    { id: b.wallAlt, label: 'wall alt' },
    { id: b.wallSecret, label: 'secret' },
    { id: b.floor, label: 'floor' },
    { id: b.ceiling, label: 'ceiling' },
    { id: b.door, label: 'door' },
  ],
}));

const plain = (ids: string[]): SheetCell[] => ids.map((id) => ({ id, label: id }));

export const SHEETS: ArtSheet[] = [
  {
    id: 'melee',
    title: 'Melee',
    note: 'Idle and the raised-weapon tell. The tell has to change the silhouette, not just move a few pixels.',
    cols: 4,
    groups: [creatureGroup('Melee', 'melee')],
  },
  {
    id: 'ranged',
    title: 'Ranged',
    note: 'Idle and the drawn or gathered shot. The weapon carried in idle is the weapon fired.',
    cols: 4,
    groups: [creatureGroup('Ranged', 'ranged')],
  },
  {
    id: 'guard',
    title: 'Shields',
    note: 'Idle, guard and attack. The guard reads as the shield coming across the body.',
    cols: 3,
    groups: [creatureGroup('Shieldbearers', 'guard')],
  },
  {
    id: 'boss',
    title: 'The Ashen King',
    note: 'One row per phase.',
    cols: 3,
    groups: [creatureGroup('Phases', 'boss')],
  },
  { id: 'biomes', title: 'Biomes', note: 'Wall, floor, ceiling and door per biome. In-game these also carry coloured light.', cols: 6, groups: biomeGroups },
  { id: 'props', title: 'Props', note: 'Everything the dungeon stands on the floor.', cols: 6, groups: [{ title: 'Props', cells: plain(PROPS.map((p) => p.id)) }] },
  { id: 'icons', title: 'Icons', note: 'Inventory icons, through a material ramp — the way the game always draws them.', cols: 8, groups: [{ title: 'Icons', cells: plain(ICONS.map((i) => i.id)) }] },
  { id: 'viewmodels', title: 'Viewmodels', note: 'The weapon in your own hands.', cols: 4, groups: [{ title: 'Viewmodels', cells: plain(VIEWMODELS.map((v) => v.id)) }] },
];

export const sheet = (id: string): ArtSheet | undefined => SHEETS.find((s) => s.id === id);
