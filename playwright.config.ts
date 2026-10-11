import { defineConfig, devices } from '@playwright/test';

// Software WebGL makes captures possible on CI runners without a GPU.
const chromium = {
  browserName: 'chromium' as const,
  launchOptions: {
    executablePath: process.env.VISUAL_CHROMIUM_PATH,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  },
};

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5174/looting-simulator/',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...chromium, viewport: { width: 1440, height: 900 } } },
    { name: 'tablet-chromium', use: { ...devices['iPad Mini landscape'], defaultBrowserType: 'chromium', ...chromium } },
    { name: 'phone-chromium', use: { ...devices['iPhone 13 landscape'], defaultBrowserType: 'chromium', ...chromium } },
    { name: 'phone-webkit', use: { ...devices['iPhone 13 landscape'], browserName: 'webkit' } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174/looting-simulator/',
    reuseExistingServer: !process.env.CI,
  },
});
