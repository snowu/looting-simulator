/*
 * Regenerates the monster tables in docs/MECHANICS.md from src/data/enemies.ts.
 *
 * MECHANICS.md is the project's stated single reference for every number, and
 * seventeen hand-transcribed rows is seventeen chances for it to quietly stop
 * being true. Run this after any change to the roster and paste the result in.
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { ENEMIES } from '../src/data/enemies';
import { material } from '../src/data/materials';
import { DamageType } from '../src/types';

const PHYS: DamageType[] = ['slash', 'pierce', 'blunt'];
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

it('mechanics tables', () => {
  const stats = ['| Monster | Depths | HP | Atk | Def | Type | Resists / weaknesses | Behaviour | Windup | Recovery | Step | Sight |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  const drops = ['| Monster | Materials | Gold | Gear chance |', '|---|---|---|---|'];
  for (const e of ENEMIES) {
    stats.push(`| ${e.name} | ${depths(e)} | ${e.hp} | ${e.attack} | ${e.defense} | ${e.damageType} | ${resists(e)} | ${behaviour(e)} | ${e.windup} | ${e.recovery} | ${e.step} | ${e.sight} |`);
    const mats = e.loot.map((l) => {
      const qty = l.max > l.min ? ` (${l.min}–${l.max})` : '';
      return `${material(l.id).name.toLowerCase()} ${Math.round(l.chance * 100)}%${qty}`;
    }).join(', ') || '—';
    drops.push(`| ${e.name} | ${mats} | ${e.gold[0]}–${e.gold[1]} | ${e.itemChance ? `${(e.itemChance * 100).toFixed(1).replace(/\.0$/, '')}%` : '—'} |`);
  }
  const weights = ENEMIES.filter((e) => e.weight > 0).map((e) => `${e.name} ${e.weight}`).join(', ');
  writeFileSync(process.env.OUT ?? 'mechanics-tables.md',
    [stats.join('\n'), '', drops.join('\n'), '', `Spawn weights: ${weights}.`, ''].join('\n'));
});
