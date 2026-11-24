import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,
  timeout: 30000,
  use: {
    headless: true,
    channel: 'chrome',
    viewport: { width: 1280, height: 720 },
  },
});
