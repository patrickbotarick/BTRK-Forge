import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/native-e2e', outputDir: 'test-results/native', workers: 1, retries: 0,
  reporter: [['list'], ['json', { outputFile: 'artifacts/native-e2e-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:1422', headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --mode test --port 1422', url: 'http://127.0.0.1:1422', reuseExistingServer: false }
});
