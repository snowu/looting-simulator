import { defineConfig } from 'vitest/config';
// The bench files here are entry points, not a suite: `npm run playtest` names
// balance.bench.ts and `npm run tables` names tables.bench.ts. The other two are
// run by hand — trace.bench.ts dumps one run's decisions for debugging the bot,
// mechanics.bench.ts regenerates the monster tables in docs/MECHANICS.md.
export default defineConfig({
  test: { globals: true, include: ['scripts/**/*.bench.ts'], testTimeout: 1_800_000, hookTimeout: 1_800_000 },
});
