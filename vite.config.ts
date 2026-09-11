import { defineConfig, Plugin } from 'vite';
import { execSync } from 'node:child_process';

function buildId(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return String(Date.now());
  }
}

const BUILD_ID = buildId();

/** Emits version.json so installed copies can tell a newer build is out. */
const versionFile = (): Plugin => ({
  name: 'version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID, builtAt: new Date().toISOString() }) });
  },
});

export default defineConfig({
  base: '/looting-simulator/',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  plugins: [versionFile()],
});
