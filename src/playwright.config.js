// meta:
//   id: "139-src-playwright-config"
//   type: code
//   domain: src
//   subject: playwright-config
//   status: adopted
//   owner: ""
//   created: 2025-11-13
//   updated: 2026-10-19
//   related: ["001-project-file-metadata-spec"]
//   tags: []
//   usage: config

/**
 * Playwright Configuration for E2E Tests
 */

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 0,
  // Headed extension contexts share the xvfb display. Parallel Chromium
  // instances make lastFocusedWindow / currentWindow tab queries race.
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    headless: false, // Extensions require headed mode
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
