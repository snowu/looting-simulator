import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createRng } from '../src/core/rng';
import { generateFloor } from '../src/systems/dungeon';
import { enemyDef } from '../src/data/enemies';
import { itemBase } from '../src/data/items';
import { material } from '../src/data/materials';
import { buildCrafted } from '../src/systems/crafting';
import { rollContainerLoot, rollEnemyLoot, materialAvailableAtDepth, itemStats } from '../src/systems/items';
import { Item, Rarity, RARITY_ORDER } from '../src/types';

it('audits Hard loot quality and crafting progression', () => {
  const samples = 200;
  const lines = ['# Hard loot progression sample', '', '200 generated floors per depth and Find setting. Every non-mimic container and initial enemy is looted; loose pickups included. Fresh recipe/unique history; boss rewards included at depth 6. Full-clear supply, before backpack limits, deaths, identification costs or crafting choices.', ''];
  const leaks = new Map<string, number>();
  const catalystRows: string[] = [];
  for (const find of [0, 60]) {
    lines.push(`## Find ${find}`, '', '| Depth | Gear/floor | Common | Uncommon | Rare | Epic | Legendary | Mean material tier | BP/floor | Unidentified weapons/floor | Early materials/floor |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
    for (let depth = 1; depth <= 6; depth++) {
      const rar = [0, 0, 0, 0, 0];
      let gear = 0, tier = 0, bp = 0, weapons = 0, early = 0;
      const gems = [0, 0, 0, 0, 0];
      const take = (items: Item[], source: string): void => {
        for (const item of items) {
          if (item.kind === 'material' && material(item.ref).category === 'gem') {
            expect(materialAvailableAtDepth(material(item.ref), depth), `${source}: ${item.ref} at depth ${depth}`).toBe(true);
            gems[material(item.ref).tier] += item.qty;
          }
          if (item.kind === 'blueprint') bp += item.qty;
          if (item.kind === 'equipment') {
            gear++;
            rar[RARITY_ORDER[item.rarity ?? Rarity.Common]]++;
            tier += item.materialId ? material(item.materialId).tier : 1;
            if (item.identified === false && ['weapon', 'thrown'].includes(itemBase(item.ref).slot)) weapons++;
          }
          if (item.kind === 'material' && material(item.ref).category !== 'valuable' && !materialAvailableAtDepth(material(item.ref), depth)) {
            early += item.qty;
            if (find === 0) {
              const key = `D${depth} ${source}: ${item.ref}`;
              leaks.set(key, (leaks.get(key) ?? 0) + item.qty);
            }
          }
        }
      };
      for (let seed = 0; seed < samples; seed++) {
        const floor = generateFloor(seed, depth, 'hard');
        const rng = createRng(seed + depth * 1000);
        for (const prop of floor.props) if (prop.tier !== 'none' && !prop.mimic) take(rollContainerLoot(rng, depth, find, prop.tier, undefined, {}, [], 'hard').items, prop.tier);
        for (const enemy of floor.enemies) take(rollEnemyLoot(rng, enemyDef(enemy.def), depth, find, undefined, {}, undefined, [], 'hard').items, enemy.def);
        for (const pickup of floor.pickups) take(pickup.items, 'loose');
      }
      lines.push(`| ${depth} | ${(gear / samples).toFixed(2)} | ${rar.map(n => (100 * n / gear).toFixed(1) + '%').join(' | ')} | ${(tier / gear).toFixed(2)} | ${(bp / samples).toFixed(2)} | ${(weapons / samples).toFixed(2)} | ${(early / samples).toFixed(2)} |`);
      catalystRows.push(`| ${find} | ${depth} | ${[2, 3, 4].map(t => (gems[t] / samples).toFixed(2)).join(' | ')} |`);
    }
    lines.push('');
  }
  lines.push('## Direct catalyst supply', '', 'Units per full clear, excluding salvage and merchant purchases. Tier 2 unlocks at depth 2, tier 3 at depth 4, tier 4 at depth 5. Every sampled gem is checked against its depth gate.', '', '| Find | Depth | Tier 2 | Tier 3 | Tier 4 |', '| --- | ---: | ---: | ---: | ---: |', ...catalystRows, '');
  lines.push('## Materials arriving before their generic depth gate (Find 0)', '', '| Source | Units per floor |', '| --- | ---: |');
  for (const [source, units] of [...leaks].sort()) lines.push(`| ${source} | ${(units / samples).toFixed(3)} |`);
  lines.push('', '## Controlled craft comparison', '', 'Same dagger base and iron primary, timber grip; median preview quality. Attack includes physical attack only. Flame Shard is a tier-4 catalyst; this illustrates what an early catalyst can enable, not how often the whole recipe is affordable.', '', '| Smith level | Recipe rank | Catalyst | Rarity | Item level | Attack | Fire | Affixes |', '| --- | --- | --- | --- | ---: | ---: | ---: | ---: |');
  for (const smith of [0, 3]) for (const rank of [1, 5]) for (const gem of [null, 'flame_shard']) {
    const item = buildCrafted({ recipeId: 'r_dagger', materials: ['iron', 'timber', gem] }, smith, undefined, rank);
    const stats = itemStats(item);
    lines.push(`| ${smith} | ${rank} | ${gem ?? 'none'} | ${item.rarity} | ${item.ilvl} | ${stats.attack} | ${stats.fire} | ${item.affixes?.length ?? 0} |`);
  }
  writeFileSync('/tmp/hard-progression-report.md', lines.join('\n') + '\n');
}, 60000);
