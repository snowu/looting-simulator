import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createRng } from '../src/core/rng';
import { generateFloor } from '../src/systems/dungeon';
import { rollContainerLoot, rollEnemyLoot } from '../src/systems/items';
import { enemyDef } from '../src/data/enemies';

it('measures blueprints across fully cleared floors', () => {
  const rows = ['# Crafting loot sample', '', '200 seeds per depth, Hard, zero Find, all non-mimic containers opened and all initial enemies defeated. These are full-clear yields, not promised take-home loot.', '', '| Depth | Container BP | Mob/boss BP | Total BP |', '| --- | ---: | ---: | ---: |'];
  for (let depth = 1; depth <= 6; depth++) {
    let containers = 0;
    let mobs = 0;
    for (let seed = 0; seed < 200; seed++) {
      const floor = generateFloor(seed, depth, 'hard');
      const rng = createRng(seed + depth * 1000);
      for (const prop of floor.props) {
        if (prop.tier === 'none' || prop.mimic) continue;
        containers += rollContainerLoot(rng, depth, 0, prop.tier).items.filter(i => i.kind === 'blueprint').reduce((n, i) => n + i.qty, 0);
      }
      for (const enemy of floor.enemies) mobs += rollEnemyLoot(rng, enemyDef(enemy.def), depth, 0).items.filter(i => i.kind === 'blueprint').reduce((n, i) => n + i.qty, 0);
    }
    rows.push(`| ${depth} | ${(containers / 200).toFixed(2)} | ${(mobs / 200).toFixed(2)} | ${((containers + mobs) / 200).toFixed(2)} |`);
    expect(containers).toBeGreaterThanOrEqual(200);
  }
  writeFileSync('/tmp/crafting-loot-report.md', rows.join('\n') + '\n');
}, 60000);
