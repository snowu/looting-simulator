import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

for (const scene of ['title', 'dark', 'bright'] as const) {
  test(`${scene}: grain before and after`, async ({ browser }, testInfo) => {
    const images: Buffer[] = [];
    const fixtures: { biome: string; seed: number }[] = [];
    const errors: string[] = [];
    const dir = path.resolve('visual-review', testInfo.project.name);
    await mkdir(dir, { recursive: true });
    for (const variant of ['before', 'after'] as const) {
      // Each variant gets a clean device context, including empty saves and
      // brightness preferences. Neither scene can alter a player's save.
      const context = await browser.newContext(testInfo.project.use);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
      });
      try {
        await page.goto('/looting-simulator/');
        await page.waitForFunction(() => !!(window as any).__game, undefined, { timeout: 15_000 });
        const fixture = await page.evaluate(async ({ scene, legacy }) => {
          const fixture = await (window as any).__game.captureVisual(scene, legacy);
          await document.fonts.ready;
          return fixture as { biome: string; seed: number };
        }, { scene, legacy: variant === 'before' });
        fixtures.push(fixture);
        await expect(page.locator('#view')).toBeVisible();
        // Screenshot after the fonts have loaded, with the world and torches
        // frozen by the dev harness rather than CSS animation suppression.
        const png = await page.screenshot({ animations: 'disabled' });
        const repeat = await page.screenshot({ animations: 'disabled' });
        expect(png.equals(repeat), 'Frozen scene must produce stable screenshots').toBe(true);
        images.push(png);
        const file = path.join(dir, `${scene}-${variant}.png`);
        await writeFile(file, png);
        await testInfo.attach(`${scene}-${variant}`, { body: png, contentType: 'image/png' });
        // Opt-in regression checks: review and approve baselines explicitly.
        if (process.env.VISUAL_ASSERT === '1' && variant === 'after') {
          expect(png).toMatchSnapshot(`${scene}.png`, { maxDiffPixelRatio: 0.001 });
        }
      } finally {
        await context.close();
      }
    }
    expect(errors, 'No browser runtime errors').toEqual([]);
    expect(fixtures[0]).toEqual(fixtures[1]);
    expect(fixtures[1].biome).toBe(scene === 'bright' ? 'frostvault' : 'crypt');
    expect(images[0].equals(images[1]), 'The grain treatments must produce different images').toBe(false);
  });
}
