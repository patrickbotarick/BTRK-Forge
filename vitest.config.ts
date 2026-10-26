import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], testTimeout: 15000, reporters: ['default', 'json'], outputFile: { json: 'artifacts/unit-results.json' } } });
