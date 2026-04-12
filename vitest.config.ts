import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'web/src'),
    },
  },
  test: {
    globals: true,
    testTimeout: 10000,
    // Only run backend tests from root - frontend tests have their own vitest config in web/
    include: [
      'src/__tests__/**/*.test.ts',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'web/**',
    ],
  },
});
