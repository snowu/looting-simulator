import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { yields } from './tables';

/*
 * Treasure Sense measured as roughly nothing in 24 scripted runs, but banked
 * value swings by hundreds of gold on a single Epic drop, so 24 runs cannot
 * resolve a ten-percent effect. This asks the loot tables directly over 60
 * deterministic seeds, which can.
 */
it('what loot find is worth', () => {
  const out = [
    '--- loot yield at each level of Treasure Sense (60 seeds per depth) ---',
    '', 'no Treasure Sense:', yields(0),
    '', 'Treasure Sense 1 (+20 find):', yields(20),
    '', 'Treasure Sense 3 (+60 find):', yields(60),
  ];
  writeFileSync(process.env.OUT ?? 'find.txt', out.join('\n') + '\n');
});
