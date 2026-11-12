import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

/** Parcours end-to-end sur le build de production, base dediee azmg_gpao_e2e, integrations simulees. */
export const E2E = {
  port: 3100,
  base: 'http://localhost:3100',
  db: process.env.DATABASE_URL_E2E ?? 'postgresql://azmg:azmg@localhost:5432/azmg_gpao_e2e',
};

// Chromium fourni par l'environnement de developpement, sinon celui de Playwright.
const chromiumLocal = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((c) => fs.existsSync(c)) ?? '';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: E2E.base,
    locale: 'fr-FR',
    timezoneId: 'Indian/Antananarivo',
    trace: 'off',
    launchOptions: chromiumLocal ? { executablePath: chromiumLocal } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node dist/server/index.js',
    url: `${E2E.base}/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      NODE_ENV: 'development',
      PORT: String(E2E.port),
      DATABASE_URL: E2E.db,
      APP_URL: E2E.base,
      AI_PROVIDER: 'mock',
      STORAGE_DIR: 'storage/e2e',
      LOG_LEVEL: 'warn',
    },
  },
});
