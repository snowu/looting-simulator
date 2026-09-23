/**
 * A screenshot of the whole game screen, for bug reports: the 3D view (when
 * there is one) with the HUD or town UI drawn over it, as the player saw it.
 *
 * The browser has no API to photograph its own page without a permission
 * prompt, so the DOM is redrawn through `html-to-image` (an SVG
 * foreignObject pass), loaded only when a report is opened. WebGL cannot be
 * read that way after the fact, so the caller hands in the 3D frame already
 * copied (`DungeonRenderer.captureFrame`) and it goes underneath.
 *
 * Anything matching `exclude` is left out: the report form itself should
 * never be in its own screenshot.
 */
export async function snapshotScreen(
  root: HTMLElement,
  gl: { canvas: HTMLCanvasElement; frame: HTMLCanvasElement } | null,
  exclude: string,
): Promise<Blob | null> {
  const rect = root.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  // Crisp pixel font on a phone without a 4K PNG from a desktop monitor.
  const pr = Math.min(2, window.devicePixelRatio || 1);
  const out = document.createElement('canvas');
  out.width = Math.round(rect.width * pr);
  out.height = Math.round(rect.height * pr);
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#000';
  ctx.fillRect(0, 0, out.width, out.height);
  if (gl) {
    const r = gl.canvas.getBoundingClientRect();
    ctx.drawImage(gl.frame, (r.left - rect.left) * pr, (r.top - rect.top) * pr, r.width * pr, r.height * pr);
  }
  try {
    const { toCanvas } = await import('html-to-image');
    const ui = await toCanvas(root, {
      pixelRatio: pr,
      width: rect.width,
      height: rect.height,
      // The root's own backdrop would paint over the 3D view underneath.
      style: { background: 'transparent' },
      filter: (node) => !(node instanceof Element) || (node !== gl?.canvas && !node.matches(exclude)),
    });
    ctx.drawImage(ui, 0, 0, out.width, out.height);
  } catch (e) {
    // The 3D view alone still beats no screenshot; town without the UI does not.
    console.warn('UI snapshot failed', e);
    if (!gl) return null;
  }
  return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
}
