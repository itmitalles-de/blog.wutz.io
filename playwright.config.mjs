import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

const localLaunchOptions = !process.env.CI && existsSync('/usr/bin/google-chrome')
  ? { executablePath: '/usr/bin/google-chrome' }
  : {};

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:43173',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        viewport: { width: 1280, height: 900 },
        launchOptions: localLaunchOptions
      }
    },
    {
      name: 'mobile-chromium',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        reducedMotion: 'reduce',
        launchOptions: localLaunchOptions
      }
    }
  ],
  webServer: {
    command: 'node scripts/serve.mjs --port 43173',
    url: 'http://127.0.0.1:43173',
    reuseExistingServer: false,
    timeout: 30_000
  }
});
