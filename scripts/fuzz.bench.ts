/*
 * `npm run fuzz`: the long fuzz run. Writes fuzz-report.txt. See fuzz.ts.
 */
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { formatFuzz, fuzz } from './fuzz';

it('fuzz', () => {
  const seeds = Number(process.env.FUZZ_SEEDS ?? 12);
  const report = fuzz({ seeds, chaos: [0, 0.02, 0.1] });
  writeFileSync(process.env.FUZZ_OUT ?? 'fuzz-report.txt', formatFuzz(report));
});
