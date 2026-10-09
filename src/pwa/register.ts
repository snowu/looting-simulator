/**
 * Install the offline service worker (see service-worker.js): a production
 * build downloads every game file once, then boots and plays with no
 * connection. Dev has no worker, so edits always show.
 */
export function registerOfflineCache(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  // Straight away, not on `load`: a phone may close the app within seconds,
  // and the download has to have started by then.
  navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
    // Private mode or blocked storage: the game still runs online.
  });
}

/**
 * Resolves true once this build is stored for offline play: a worker is
 * active and holds the page. Never resolves in dev or where workers are off.
 */
export async function whenOfflineReady(): Promise<boolean> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !('caches' in window)) return new Promise(() => {});
  await navigator.serviceWorker.ready;
  return !!(await caches.match(import.meta.env.BASE_URL, { ignoreSearch: true, ignoreVary: true }));
}

/**
 * Before reloading into a new build: have the worker fetch it, and wait (up
 * to `timeoutMs`) until it is stored, so the offline copy is never left
 * empty. False when there is no worker or it did not finish in time; the
 * reload goes ahead either way, since the page is fetched network-first.
 */
export async function installLatestBuild(timeoutMs = 20000): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    await reg.update();
    const worker = reg.installing ?? reg.waiting;
    if (!worker) return true;
    return await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      const check = () => {
        if (worker.state === 'activated') { clearTimeout(timer); resolve(true); }
        if (worker.state === 'redundant') { clearTimeout(timer); resolve(false); }
      };
      worker.addEventListener('statechange', check);
      check();
    });
  } catch {
    return false;
  }
}
