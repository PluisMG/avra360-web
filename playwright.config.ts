import { defineConfig } from '@playwright/test';

const chrome = process.env.CHROME_PATH ?? '/usr/local/bin/google-chrome';

export default defineConfig({
  testDir: 'tests',
  fullyParallel: false,
  retries: 0,
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4321',
    browserName: 'chromium',
    launchOptions: {
      executablePath: chrome,
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    },
  },
  webServer: {
    command:
      'PREVIEW=1 npm run build && npx wrangler dev --ip 127.0.0.1 --port 4321 --local-protocol http --show-interactive-dev-session false --log-level error',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
