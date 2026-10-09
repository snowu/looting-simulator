import { defineConfig, Plugin } from 'vite';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { encodeArtPack } from './src/render/art-pack';

function buildId(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return String(Date.now());
  }
}

function appVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version?: string };
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const BUILD_ID = buildId();
const APP_VERSION = appVersion();

/** Emits version.json so installed copies can tell a newer build is out. */
const versionFile = (): Plugin => ({
  name: 'version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ id: BUILD_ID, version: APP_VERSION, builtAt: new Date().toISOString() }),
    });
  },
});

/**
 * Emits art/pack.bin: every PNG in public/art in one file, in manifest order,
 * so a cold start fetches the art in one request (see src/render/art-pack.ts).
 * The loose PNGs still ship beside it as the fallback.
 */
const artPack = (): Plugin => ({
  name: 'art-pack',
  apply: 'build',
  generateBundle() {
    const dir = new URL('./public/art/', import.meta.url);
    const ids = JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8')) as string[];
    const pack = encodeArtPack(ids.map((id) => ({ id, png: readFileSync(new URL(`${id}.png`, dir)) })));
    this.emitFile({ type: 'asset', fileName: 'art/pack.bin', source: pack });
  },
});

/**
 * Emits sw.js, the offline service worker (src/pwa/service-worker.js), with
 * every file the build wrote listed for it to download on install. Runs after
 * the bundle and public files are on disk, so the list is the real output.
 */
const offlineServiceWorker = (): Plugin => {
  let outDir = 'dist';
  return {
    name: 'offline-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const skip = new Set(['sw.js', 'version.json']);
      const walk = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? walk(join(dir, e.name)) : [relative(outDir, join(dir, e.name)).split(sep).join('/')],
        );
      const files = walk(outDir).filter((f) => !skip.has(f) && !f.endsWith('.map')).sort();
      // The page itself under its directory URL, which is what a launch navigates to.
      const precache = ['./', ...files.filter((f) => f !== 'index.html')];
      const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
      const fontCss = html.match(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/)?.[1] ?? '';
      const source = readFileSync(new URL('./src/pwa/service-worker.js', import.meta.url), 'utf8')
        .replace('__SW_BUILD_ID__', JSON.stringify(BUILD_ID))
        .replace('__SW_PRECACHE__', JSON.stringify(precache))
        .replace('__SW_FONT_CSS__', JSON.stringify(fontCss.replace(/&amp;/g, '&')));
      writeFileSync(join(outDir, 'sw.js'), source);
    },
  };
};

export default defineConfig({
  base: '/looting-simulator/',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID), __APP_VERSION__: JSON.stringify(APP_VERSION) },
  plugins: [versionFile(), artPack(), offlineServiceWorker()],
});
