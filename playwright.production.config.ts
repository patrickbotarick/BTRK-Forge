import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/production', outputDir: 'test-results/production', workers: 1,
  reporter: [['list'], ['json', { outputFile: 'artifacts/production-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:1421', headless: true },
  webServer: { command: 'npx tsx tools/feasibility/serve-production.ts', url: 'http://127.0.0.1:1421/studio/', reuseExistingServer: false }
});
