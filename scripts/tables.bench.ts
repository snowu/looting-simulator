/* Just the static tables — seconds, not minutes, so it can run after every knob. */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { allTables } from './tables';

it('balance tables', () => {
  writeFileSync(process.env.TABLES_OUT ?? 'balance-tables.txt', allTables() + '\n');
});
