import { defineConfig } from '@playwright/test';

const basePath = process.env.E2E_BASE_PATH ?? process.env.BASE_PATH ?? '/';
const origin = process.env.E2E_ORIGIN ?? 'http://127.0.0.1:4173';
const baseURL = `${origin}${basePath}`;

/**
 * The suite always runs against a production build (`vite preview`). Set
 * E2E_BASE_PATH=/kontur/ to verify the same build under a GitHub Pages
 * repository subpath.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    trace: 'retain-on-failure',
    video: 'off',
    channel:
      process.env.PLAYWRIGHT_CHANNEL ??
      (process.env.CI || process.platform !== 'win32' ? undefined : 'msedge'),
  },
  webServer: {
    command:
      'npm run build && npm run preview -- --port 4173 --strictPort --host 127.0.0.1',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      BASE_PATH: basePath,
    },
  },
});
