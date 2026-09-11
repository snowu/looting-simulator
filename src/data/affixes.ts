import { AffixDef, Slot } from '../types';

const WEAPON: Slot[] = ['weapon'];
const ARMOR: Slot[] = ['head', 'body', 'hands', 'offhand'];
const JEWEL: Slot[] = ['ring', 'amulet'];
const ALL: Slot[] = ['weapon', 'offhand', 'head', 'body', 'hands', 'ring', 'amulet'];

export const AFFIXES: AffixDef[] = [
  // --- Prefixes -----------------------------------------------------------
  { id: 'sharp', name: 'Sharp', kind: 'prefix', stat: 'attack', min: 1, max: 3, perLevel: 0.5, slots: WEAPON, weight: 10, minIlvl: 1 },
  { id: 'brutal', name: 'Brutal', kind: 'prefix', stat: 'attack', min: 4, max: 7, perLevel: 0.9, slots: WEAPON, weight: 4, minIlvl: 4 },
  { id: 'sturdy', name: 'Sturdy', kind: 'prefix', stat: 'defense', min: 1, max: 2, perLevel: 0.4, slots: ARMOR, weight: 10, minIlvl: 1 },
  { id: 'bastioned', name: 'Bastioned', kind: 'prefix', stat: 'defense', min: 3, max: 5, perLevel: 0.7, slots: ARMOR, weight: 4, minIlvl: 4 },
  { id: 'vital', name: 'Vital', kind: 'prefix', stat: 'health', min: 4, max: 8, perLevel: 1.5, slots: ALL, weight: 8, minIlvl: 1 },
  { id: 'tireless', name: 'Tireless', kind: 'prefix', stat: 'stamina', min: 6, max: 12, perLevel: 1.5, slots: ALL, weight: 7, minIlvl: 1 },
  { id: 'lucky', name: 'Lucky', kind: 'prefix', stat: 'luck', min: 2, max: 4, perLevel: 0.4, slots: ALL, weight: 6, minIlvl: 1 },
  { id: 'blazing', name: 'Blazing', kind: 'prefix', stat: 'fire', min: 2, max: 4, perLevel: 0.8, slots: [...WEAPON, ...JEWEL], weight: 4, minIlvl: 3 },
  { id: 'rimed', name: 'Rimed', kind: 'prefix', stat: 'frost', min: 2, max: 4, perLevel: 0.8, slots: [...WEAPON, ...JEWEL], weight: 4, minIlvl: 3 },
  { id: 'umbral', name: 'Umbral', kind: 'prefix', stat: 'shadow', min: 2, max: 4, perLevel: 0.8, slots: [...WEAPON, ...JEWEL], weight: 3, minIlvl: 5 },
  { id: 'blessed', name: 'Blessed', kind: 'prefix', stat: 'holy', min: 2, max: 4, perLevel: 0.8, slots: [...WEAPON, ...JEWEL], weight: 3, minIlvl: 2 },

  // --- Suffixes -----------------------------------------------------------
  { id: 'bear', name: 'of the Bear', kind: 'suffix', stat: 'health', min: 6, max: 12, perLevel: 2, slots: ALL, weight: 7, minIlvl: 2 },
  { id: 'fox', name: 'of the Fox', kind: 'suffix', stat: 'luck', min: 2, max: 5, perLevel: 0.4, slots: ALL, weight: 6, minIlvl: 1 },
  { id: 'swiftness', name: 'of Swiftness', kind: 'suffix', stat: 'speed', min: 4, max: 8, perLevel: 0.6, slots: [...WEAPON, 'hands', ...JEWEL], weight: 6, minIlvl: 1 },
  { id: 'leeching', name: 'of the Leech', kind: 'suffix', stat: 'leech', min: 2, max: 4, perLevel: 0.3, slots: [...WEAPON, ...JEWEL], weight: 4, minIlvl: 3 },
  { id: 'plunder', name: 'of Plunder', kind: 'suffix', stat: 'find', min: 6, max: 12, perLevel: 1.2, slots: ALL, weight: 5, minIlvl: 1 },
  { id: 'wall', name: 'of the Wall', kind: 'suffix', stat: 'block', min: 5, max: 10, perLevel: 0.6, slots: ['offhand'], weight: 6, minIlvl: 1 },
  { id: 'endurance', name: 'of Endurance', kind: 'suffix', stat: 'stamina', min: 8, max: 14, perLevel: 1.5, slots: ALL, weight: 5, minIlvl: 2 },
];

const BY_ID = new Map(AFFIXES.map((a) => [a.id, a]));

export function affix(id: string): AffixDef {
  const a = BY_ID.get(id);
  if (!a) throw new Error(`unknown affix ${id}`);
  return a;
}
