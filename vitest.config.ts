import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@shared': path.resolve(__dirname, 'src/shared') } },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/global-setup.ts'],
    setupFiles: ['tests/setup.ts'],
    // Les tests d'integration partagent une base PostgreSQL : execution sequentielle.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
