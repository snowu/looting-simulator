// Replaced at build time by Vite's `define` (see vite.config.ts).
declare const __BUILD_ID__: string;
declare const __APP_VERSION__: string;

export const BUILD_ID: string = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

const BASE = import.meta.env.BASE_URL;

export interface BuildInfo {
  /** Git sha (or timestamp fallback) identifying the deployed bundle. */
  id: string;
  /** Human-readable semver from package.json, e.g. "1.0.0". */
  version: string;
  builtAt: string;
}

const RELOAD_GUARD_KEY = 'looting-simulator-reloaded-for';
const RESUME_KEY = 'looting-simulator-resume-after-update';

/** True when the deployed build differs from the one running. Pure, tested. */
export function isNewerBuild(runningId: string, latestId: string | null | undefined): boolean {
  return !!latestId && latestId !== runningId;
}

/**
 * Totally fresh URL for the new build. The `v` query busts the browser's
 * cached copy of the page itself; hashed JS/CSS already change filenames per
 * build, and unhashed public assets (art PNGs, icons) carry `?v=BUILD_ID`
 * (see art-cache.ts), so a navigation here re-downloads everything that a
 * new version could have changed. Pure, tested.
 */
export function buildUpdateUrl(href: string, base: string, id: string): string {
  const baseUrl = new URL(base, href);
  const target = new URL(baseUrl.toString());
  target.searchParams.set('v', id);
  return target.toString();
}

/**
 * Append the running build id to an unhashed public asset (`art/*.png`,
 * `manifest.json`, icons) so every new version downloads it again instead of
 * serving the old one from HTTP cache. Pure, tested.
 */
export function versionedAssetUrl(url: string, buildId: string): string {
  if (!buildId || buildId === 'dev') return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(buildId)}`;
}

/**
 * Session guard against reload loops: after a deploy, GitHub Pages can serve
 * the new version.json a minute before the new index.html propagates. Only
 * attempt one reload per build id per tab session; the periodic poll retries
 * on the next tick once the new page is actually servable.
 */
export function shouldAttemptReload(latestId: string): boolean {
  try {
    return sessionStorage.getItem(RELOAD_GUARD_KEY) !== latestId;
  } catch {
    return true;
  }
}

export function markReloadAttempt(latestId: string): void {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, latestId);
  } catch {
    // Storage blocked: reload anyway, the loop risk is a second refresh.
  }
}

/**
 * Updating mid-delve: remember which save slot to open again once the new
 * build has loaded, so the reload lands back in the delve instead of on the
 * title screen. Session storage, so it survives the reload and nothing else.
 */
export function markResumeAfterUpdate(slot: number): void {
  try {
    sessionStorage.setItem(RESUME_KEY, String(slot));
  } catch {
    // Storage blocked: the update still lands, on the title screen.
  }
}

/** The slot to reopen after an update, read once: the next boot starts normally. */
export function takeResumeAfterUpdate(): number | null {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY);
    sessionStorage.removeItem(RESUME_KEY);
    const n = Number(raw);
    return raw !== null && Number.isInteger(n) ? n : null;
  } catch {
    return null;
  }
}

/** The newest deployed build, if it differs from the one running. */
export async function newerBuild(): Promise<string | null> {
  // Dev has no deploys to find. `?fakeupdate=<id>` pretends one landed, to
  // try the banner and the mid-delve update by hand; the reload drops the
  // query, so it fires once.
  if (import.meta.env.DEV) return new URLSearchParams(location.search).get('fakeupdate');
  try {
    const res = await fetch(`${BASE}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const { id } = (await res.json()) as Partial<BuildInfo>;
    return isNewerBuild(BUILD_ID, typeof id === 'string' ? id : null) ? (id as string) : null;
  } catch {
    return null;
  }
}

/** Drop caches an installed copy or browser could use to resurrect the old build. */
async function clearUpdateCaches(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // ignore: navigation below still busts the page URL
  }
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // ignore
  }
}

/**
 * Load the new build: force the cached page + version file through the
 * network first, drop service-worker/Cache Storage copies, then navigate to
 * a fresh URL so neither the browser cache nor an installed app serves the
 * old one. Marks the session guard first so a half-propagated deploy cannot
 * spin the tab.
 */
export async function reloadToLatest(id: string): Promise<void> {
  markReloadAttempt(id);
  try {
    await fetch(`${BASE}version.json?t=${Date.now()}`, { cache: 'reload' });
  } catch {
    // offline: the navigation below will tell
  }
  try {
    await fetch(BASE, { cache: 'reload' });
  } catch {
    // offline: the navigation below will tell
  }
  await clearUpdateCaches();
  location.replace(buildUpdateUrl(location.href, BASE, id));
}
