// Replaced at build time by Vite's `define` (see vite.config.ts).
declare const __BUILD_ID__: string;

export const BUILD_ID: string = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

const BASE = import.meta.env.BASE_URL;

/** The id of the newest deployed build, if it differs from the one running. */
export async function newerBuild(): Promise<string | null> {
  if (import.meta.env.DEV) return null;
  try {
    const res = await fetch(`${BASE}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const { id } = (await res.json()) as { id?: string };
    return id && id !== BUILD_ID ? id : null;
  } catch {
    return null;
  }
}

/**
 * Load the new build. Refresh the cached page first, then navigate to a
 * fresh URL so neither the browser cache nor an installed app serves the old one.
 */
export async function reloadToLatest(id: string): Promise<void> {
  try {
    await fetch(BASE, { cache: 'reload' });
  } catch {
    // offline: the navigation below will tell
  }
  location.replace(`${BASE}?v=${encodeURIComponent(id)}`);
}
