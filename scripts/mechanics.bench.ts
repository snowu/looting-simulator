/*
 * Rewrites the generated tables in docs/MECHANICS.md from the game's data.
 * Run it after any change to the roster: `npm run mechanics`. The test
 * mechanics-doc.test.ts fails until you do.
 */
import { it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { syncMechanics } from './mechanics-tables';

it('mechanics tables', () => {
  const path = 'docs/MECHANICS.md';
  const doc = readFileSync(path, 'utf8');
  const next = syncMechanics(doc);
  if (next !== doc) writeFileSync(path, next);
});
