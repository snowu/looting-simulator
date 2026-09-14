/**
 * Dev-only: named multi-mob spawn configurations for the combat lab.
 *
 * Builtins cover the common cases; customs persist in localStorage (dev
 * scratch only — never part of a save) and move between machines as JSON.
 */
import { enemyDef } from '../data/enemies';

export type LabSpacing = 'near' | 'ranged';
export type LabPrime = 'alert' | 'windup';

export interface LabMobEntry {
  id: string;
  count: number;
  spacing: LabSpacing;
  prime: LabPrime;
}

export interface LabConfig {
  name: string;
  entries: LabMobEntry[];
}

export const BUILTIN_LAB_CONFIGS: LabConfig[] = [
  {
    name: 'Melee pile',
    entries: [
      { id: 'skeleton', count: 1, spacing: 'near', prime: 'windup' },
      { id: 'goblin', count: 1, spacing: 'near', prime: 'windup' },
      { id: 'ghoul', count: 1, spacing: 'near', prime: 'windup' },
      { id: 'spider', count: 1, spacing: 'near', prime: 'windup' },
      { id: 'bat', count: 1, spacing: 'near', prime: 'windup' },
    ],
  },
  {
    name: 'Archer volley',
    entries: [
      { id: 'goblin_archer', count: 1, spacing: 'ranged', prime: 'alert' },
      { id: 'skeleton_archer', count: 1, spacing: 'ranged', prime: 'alert' },
      { id: 'cinder_raider', count: 1, spacing: 'ranged', prime: 'alert' },
      { id: 'elemental_frost', count: 1, spacing: 'ranged', prime: 'alert' },
      { id: 'elemental_shadow', count: 1, spacing: 'ranged', prime: 'alert' },
    ],
  },
  {
    name: 'Mixed skirmish',
    entries: [
      { id: 'goblin_shield', count: 2, spacing: 'near', prime: 'alert' },
      { id: 'goblin_archer', count: 2, spacing: 'ranged', prime: 'alert' },
      { id: 'spider', count: 2, spacing: 'near', prime: 'alert' },
    ],
  },
  {
    name: 'Throne guard',
    entries: [
      { id: 'ashen_king', count: 1, spacing: 'ranged', prime: 'alert' },
      { id: 'hollow_knight', count: 2, spacing: 'near', prime: 'alert' },
    ],
  },
];

const STORE_KEY = 'lab.configs.v1';
const MAX_ENTRIES = 12;

function validId(id: unknown): string | null {
  if (typeof id !== 'string') return null;
  try {
    enemyDef(id);
    return id;
  } catch {
    return null;
  }
}

function sanitizeEntry(raw: unknown): LabMobEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = validId(r.id);
  if (!id) return null;
  const count = Math.max(1, Math.min(20, Math.floor(Number(r.count) || 1)));
  const spacing: LabSpacing = r.spacing === 'ranged' ? 'ranged' : 'near';
  const prime: LabPrime = r.prime === 'windup' ? 'windup' : 'alert';
  return { id, count, spacing, prime };
}

/** Parse shared JSON into a config, forgiving about shape. Returns null if useless. */
export function parseLabConfig(json: string): LabConfig | null {
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 40) : 'Imported';
    const list = Array.isArray(raw.entries) ? raw.entries : [];
    const entries = list.map(sanitizeEntry).filter((e): e is LabMobEntry => e !== null).slice(0, MAX_ENTRIES);
    if (!entries.length) return null;
    return { name, entries };
  } catch {
    return null;
  }
}

function readStore(): LabConfig[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    const out: LabConfig[] = [];
    for (const item of list) {
      const cfg = parseLabConfig(JSON.stringify(item));
      if (cfg && !BUILTIN_LAB_CONFIGS.some((b) => b.name === cfg.name)) out.push(cfg);
    }
    return out;
  } catch {
    return [];
  }
}

/** Builtins first, then customs. */
export function loadLabConfigs(): LabConfig[] {
  return [...BUILTIN_LAB_CONFIGS, ...readStore()];
}

function writeStore(customs: LabConfig[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(customs));
  } catch {
    // Private mode etc. — configs just don't persist this session.
  }
}

/** Save (or overwrite) a custom config. Builtin names are left alone. */
export function saveLabConfig(cfg: LabConfig): void {
  const clean: LabConfig = {
    name: cfg.name.trim().slice(0, 40) || 'Unnamed',
    entries: cfg.entries.map(sanitizeEntry).filter((e): e is LabMobEntry => e !== null).slice(0, MAX_ENTRIES),
  };
  if (!clean.entries.length) return;
  const customs = readStore().filter((c) => c.name !== clean.name);
  customs.push(clean);
  writeStore(customs);
}

export function deleteLabConfig(name: string): void {
  writeStore(readStore().filter((c) => c.name !== name));
}

export function isBuiltinLabConfig(name: string): boolean {
  return BUILTIN_LAB_CONFIGS.some((b) => b.name === name);
}

export function exportLabConfig(cfg: LabConfig): string {
  return JSON.stringify(cfg);
}

/** One-line summary for the saved list, e.g. "5 mobs · skeleton +4". */
export function summarizeLabConfig(cfg: LabConfig): string {
  const total = cfg.entries.reduce((n, e) => n + e.count, 0);
  const first = cfg.entries[0]?.id ?? '';
  const rest = cfg.entries.length - 1;
  return `${total} mob${total === 1 ? '' : 's'} · ${first}${rest > 0 ? ` +${rest}` : ''}`;
}
