/**
 * Install the offline service worker (see service-worker.js): a production
 * build downloads every game file once, then boots and plays with no
 * connection. Dev has no worker, so edits always show.
 */
export function registerOfflineCache(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL;
  const register = () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {
      // Private mode or blocked storage: the game still runs online.
    });
  };
  // After load, so the download does not compete with the first boot.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
