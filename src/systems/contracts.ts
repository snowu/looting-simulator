import { Rng } from '../core/rng';
import { Item, Rarity, RARITY_ORDER, rarityAtLeast, Slot } from '../types';
import { MATERIALS, material } from '../data/materials';
import { ITEM_BASES } from '../data/items';
import { ENEMIES, enemyDef } from '../data/enemies';
import { FINAL_DEPTH } from '../data/biomes';
import { Container, countOf } from '../state/inventory';
import { itemRarity, itemValue } from './items';

export type ContractKind = 'deliver' | 'gear' | 'slay' | 'delve';

export interface Contract {
  id: string;
  kind: ContractKind;
  giver: string;
  materialId?: string;
  qty?: number;
  slot?: Slot;
  minRarity?: Rarity;
  enemyId?: string;
  count?: number;
  depth?: number;
  progress: number;
  reward: { gold: number; renown: number };
  daysLeft: number;
  accepted: boolean;
}

export const MAX_ACCEPTED = 3;
const BOARD_SIZE = 5;

const GIVERS = [
  'Magda the Smith',
  'Brother Aldous',
  'Old Fenwick',
  'Captain Rhoe',
  'Ysolde of the Academy',
  'The Tanner\'s Guild',
  'A hooded stranger',
];

const SLOT_NAMES: Record<Slot, string> = {
  weapon: 'weapon', offhand: 'shield', thrown: 'belt of shafts', head: 'helmet', body: 'body armour', hands: 'pair of gloves', ring: 'ring', amulet: 'amulet',
};

export function contractTitle(c: Contract): string {
  switch (c.kind) {
    case 'deliver':
      return `Deliver ${c.qty} × ${material(c.materialId!).name}`;
    case 'gear':
      return `Deliver ${/^[AEIOU]/.test(c.minRarity!) ? 'an' : 'a'} ${c.minRarity} or better ${SLOT_NAMES[c.slot!]}`;
    case 'slay':
      return `Slay ${c.count} × ${enemyDef(c.enemyId!).name}`;
    case 'delve':
      return `Reach depth ${c.depth}`;
  }
}

export function generateContract(rng: Rng, bestDepth: number): Contract {
  const depth = Math.max(1, bestDepth);
  const kind = rng.weighted<ContractKind>([
    ['deliver', 5],
    ['gear', 2],
    ['slay', 3],
    ['delve', depth < FINAL_DEPTH ? 1.5 : 0],
  ]);
  const base = { id: `c${rng.int(0, 1e9).toString(36)}`, kind, giver: rng.pick(GIVERS), progress: 0, accepted: false, daysLeft: rng.int(3, 6) };
  switch (kind) {
    case 'deliver': {
      const pool = MATERIALS.filter((m) => m.tier <= depth / 1.4 + 1.2);
      const mat = rng.pick(pool);
      const qty = Math.max(1, Math.round(rng.int(3, 10) / Math.max(1, mat.tier * 0.8)));
      return { ...base, materialId: mat.id, qty, reward: { gold: Math.round(mat.value * qty * rng.float(1.5, 2.1)), renown: 1 + Math.floor(mat.tier / 2) } };
    }
    case 'gear': {
      const slot = rng.pick(Array.from(new Set(ITEM_BASES.map((b) => b.slot))));
      const minRarity = rng.weighted<Rarity>([[Rarity.Uncommon, 5], [Rarity.Rare, depth >= 3 ? 3 : 0.5], [Rarity.Epic, depth >= 5 ? 1 : 0]]);
      return { ...base, slot, minRarity, reward: { gold: 60 + 90 * RARITY_ORDER[minRarity] * RARITY_ORDER[minRarity] + depth * 20, renown: 1 + RARITY_ORDER[minRarity] } };
    }
    case 'slay': {
      const pool = ENEMIES.filter((e) => e.weight > 0 && e.minDepth <= depth + 1);
      const e = rng.pick(pool);
      const count = rng.int(3, 7);
      return { ...base, enemyId: e.id, count, reward: { gold: Math.round((e.hp * 0.9 + 8) * count), renown: 2 } };
    }
    case 'delve': {
      const d = Math.min(FINAL_DEPTH, depth + 1);
      return { ...base, depth: d, daysLeft: rng.int(4, 7), reward: { gold: 80 * d, renown: 3 + d } };
    }
  }
}

/** Daily tick: age contracts, drop expired ones, top the board back up. */
export function refreshContracts(list: Contract[], rng: Rng, bestDepth: number): Contract[] {
  const kept = list.map((c) => ({ ...c, daysLeft: c.daysLeft - 1 })).filter((c) => c.daysLeft > 0);
  while (kept.length < BOARD_SIZE) kept.push(generateContract(rng, bestDepth));
  return kept;
}

/** Items in the stash that could satisfy a gear contract. */
export function gearCandidates(c: Contract, stash: Container): Item[] {
  if (c.kind !== 'gear') return [];
  return stash.items.filter(
    (it) =>
      it.kind === 'equipment' &&
      it.identified !== false &&
      ITEM_BASES.find((b) => b.id === it.ref)?.slot === c.slot &&
      rarityAtLeast(itemRarity(it), c.minRarity!),
  ).sort((a, b) => itemValue(a) - itemValue(b));
}

export function isComplete(c: Contract, stash: Container): boolean {
  switch (c.kind) {
    case 'deliver':
      return countOf(stash, 'material', c.materialId!) >= c.qty!;
    case 'gear':
      return gearCandidates(c, stash).length > 0;
    case 'slay':
      return c.progress >= c.count!;
    case 'delve':
      return c.progress >= c.depth!;
  }
}

export function recordKill(list: Contract[], enemyId: string): void {
  for (const c of list) if (c.accepted && c.kind === 'slay' && c.enemyId === enemyId) c.progress = Math.min(c.count!, c.progress + 1);
}

export function recordDepth(list: Contract[], depth: number): void {
  for (const c of list) if (c.accepted && c.kind === 'delve') c.progress = Math.max(c.progress, depth);
}
