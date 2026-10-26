import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', outputDir: 'test-results/studio', workers: 1, retries: 0,
  reporter: [['list'], ['json', { outputFile: 'artifacts/e2e-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:1420', headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:1420', reuseExistingServer: !process.env.CI },
});
