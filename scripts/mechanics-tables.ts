/**
 * The tables in docs/MECHANICS.md that are generated from the game's data,
 * so the "single reference for numbers that ship" cannot quietly stop being
 * true. Each lives between `<!-- generated: name -->` and
 * `<!-- /generated: name -->` in the doc.
 *
 * `npm run mechanics` rewrites them in place; mechanics-doc.test.ts fails
 * when the doc and the data disagree.
 */
import { ENEMIES } from '../src/data/enemies';
import { material } from '../src/data/materials';
import { DamageType } from '../src/types';

const ORDER: DamageType[] = ['blunt', 'slash', 'pierce', 'fire', 'frost', 'holy', 'shadow'];

function resists(e: (typeof ENEMIES)[number]): string {
  const parts = ORDER.filter((k) => e.resist[k] !== undefined).map((k) => {
    const v = e.resist[k]!;
    const text = `${k} ×${v}`;
    return v >= 1.35 ? `**${text}**` : text;
  });
  return (e.undead ? 'undead: ' : '') + (parts.join(', ') || '—');
}

function behaviour(e: (typeof ENEMIES)[number]): string {
  const bits = [e.behavior as string];
  if (e.projectile) bits.push(`${e.projectile.damageType} bolt, speed ${e.projectile.speed}, range ${e.range}`);
  if (e.shield) bits.push(`shield (blocks ${Math.round(e.shield.block * 100)}%)`);
  if (e.floats) bits.push('floats');
  return bits.join(', ');
}

function depths(e: (typeof ENEMIES)[number]): string {
  if (e.id === 'mimic') return 'any chest';
  if (e.behavior === 'boss') return `${e.minDepth} (boss)`;
  return e.minDepth === e.maxDepth ? `${e.minDepth}` : `${e.minDepth}–${e.maxDepth}`;
}

/** Every monster's stat block, in roster order. */
export function monsterStats(): string {
  const rows = ['| Monster | Depths | HP | Atk | Def | Type | Resists / weaknesses | Behaviour | Windup | Recovery | Step | Sight |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const e of ENEMIES) {
    rows.push(`| ${e.name} | ${depths(e)} | ${e.hp} | ${e.attack} | ${e.defense} | ${e.damageType} | ${resists(e)} | ${behaviour(e)} | ${e.windup} | ${e.recovery} | ${e.step} | ${e.sight} |`);
  }
  return rows.join('\n');
}

/** What every monster drops: materials, gold and the gear chance. */
export function monsterDrops(): string {
  const rows = ['| Monster | Materials | Gold | Gear chance |', '|---|---|---|---|'];
  for (const e of ENEMIES) {
    const mats = e.loot.map((l) => {
      const qty = l.max > l.min ? ` (${l.min}–${l.max})` : '';
      return `${material(l.id).name.toLowerCase()} ${Math.round(l.chance * 100)}%${qty}`;
    }).join(', ') || '—';
    rows.push(`| ${e.name} | ${mats} | ${e.gold[0]}–${e.gold[1]} | ${e.itemChance ? `${(e.itemChance * 100).toFixed(1).replace(/\.0$/, '')}%` : '—'} |`);
  }
  return rows.join('\n');
}

export const GENERATED: Record<string, () => string> = {
  'monster-stats': monsterStats,
  'monster-drops': monsterDrops,
};

/** The doc with every generated block rewritten from the data. Throws on a missing or unclosed marker. */
export function syncMechanics(doc: string): string {
  let out = doc;
  for (const [name, make] of Object.entries(GENERATED)) {
    const open = `<!-- generated: ${name} -->`;
    const close = `<!-- /generated: ${name} -->`;
    const a = out.indexOf(open);
    const b = out.indexOf(close);
    if (a < 0 || b < a) throw new Error(`docs/MECHANICS.md is missing the ${open} … ${close} block`);
    out = out.slice(0, a + open.length) + '\n\n' + make() + '\n\n' + out.slice(b);
  }
  return out;
}
