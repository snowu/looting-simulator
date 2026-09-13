import { defineConfig } from 'vitest/config';
export default defineConfig({
  // `npm test` is the behaviour suite and stays fast. The balance harness under
  // scripts/ plays whole runs and takes minutes, so it gets its own entry point
  // (`npm run playtest`) rather than being folded into every test run.
  test: { globals: true, include: ['src/**/*.test.ts'] },
});
