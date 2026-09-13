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
import { CONSUMABLES, ITEM_BASES, viewmodelFor } from '../data/items';
import { MaterialDef } from '../types';
import { Ramp } from '../art/raster';
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
  /** The material ramp the game would draw this cell through, if any. */
  ramp?: Ramp;
}

/**
 * Icons are never drawn flat in the game and never drawn in an arbitrary
 * colour either: a potion is one of six potions, an ingot is one of six
 * metals, and a long sword is made of a metal because its base says
 * `primary: ['metal']`. So the icon sheet is built from the things that
 * actually exist rather than from a colour picker — every cell below is a
 * combination the game can produce, and says which one it is.
 */
const TIERS = [...new Set(MATERIALS.map((m) => m.tier))].sort((a, b) => a - b);
export const MATERIAL_TIERS: number[] = TIERS;
export const DEFAULT_TIER = TIERS[Math.floor(TIERS.length / 2)];

/** The best material a base is allowed at this tier, or the cheapest it allows. */
function materialFor(categories: readonly string[], tier: number): MaterialDef | undefined {
  const allowed = MATERIALS.filter((m) => categories.includes(m.category));
  const atTier = allowed.filter((m) => m.tier <= tier);
  const pool = atTier.length ? atTier : allowed;
  return pool.reduce<MaterialDef | undefined>((best, m) => (!best || m.tier > best.tier ? m : best), undefined);
}

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

/**
 * The game hands the viewmodel the equipped weapon's ramp, so a flat one is a
 * weapon made of nothing. Each model is shown in the material of a real base
 * that is held as it — `vm_fist` excepted, which is a hand.
 */
function viewmodelCells(tier: number): SheetCell[] {
  return VIEWMODELS.map((vm) => {
    const base = ITEM_BASES.find((b) =>
      vm.id === 'vm_shield' ? b.slot === 'offhand' : b.slot === 'weapon' && viewmodelFor(b.weaponClass) === vm.id);
    if (!base) return { id: vm.id, label: 'Bare hands' };
    const m = materialFor(base.primary, tier);
    return { id: vm.id, label: m ? `${base.name} · ${m.name}` : base.name, ramp: m?.ramp };
  });
}

function iconGroups(tier: number): SheetGroup[] {
  const covered = new Set<string>();
  const materials: SheetCell[] = MATERIALS.map((m) => {
    covered.add(m.icon);
    return { id: m.icon, label: m.name, ramp: m.ramp };
  });
  const gear: SheetCell[] = ITEM_BASES.map((b) => {
    covered.add(b.icon);
    const m = materialFor(b.primary, tier);
    return { id: b.icon, label: m ? `${b.name} · ${m.name}` : b.name, ramp: m?.ramp };
  });
  const consumables: SheetCell[] = CONSUMABLES.map((c) => {
    covered.add(c.icon);
    return { id: c.icon, label: c.name, ramp: c.ramp };
  });
  // Whatever no item claims — the key, the coin, the settings gear. These have
  // no ramp in the game either, so they are drawn exactly as they ship.
  const fixed: SheetCell[] = ICONS.filter((i) => !covered.has(i.id)).map((i) => ({ id: i.id, label: i.id }));
  return [
    { title: `Gear · best material at tier ${tier}`, cells: gear },
    { title: 'Materials', cells: materials },
    { title: 'Consumables', cells: consumables },
    ...(fixed.length ? [{ title: 'Never recoloured', cells: fixed }] : []),
  ];
}

export function sheets(tier: number = DEFAULT_TIER): ArtSheet[] {
  return [
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
  { id: 'icons', title: 'Icons', note: 'Every icon as something that exists: each piece of gear in a material its base actually allows, each material and potion in its own colours.', cols: 6, groups: iconGroups(tier) },
  { id: 'viewmodels', title: 'Viewmodels', note: 'The weapon in your own hands, in the material of a weapon that uses it. An empty hand has no material.', cols: 4, groups: [{ title: `Held · best material at tier ${tier}`, cells: viewmodelCells(tier) }] },
  ];
}

export const sheet = (id: string, tier?: number): ArtSheet | undefined => sheets(tier).find((s) => s.id === id);
