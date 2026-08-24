import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    env: {
      SEEDFLIX_DATA_DIR: path.resolve(__dirname, 'data/test'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: ['server/**/*.ts'],
      exclude: [
        '**/*.d.ts',
        'node_modules/**',
        'dist/**',
        'tests/**',
        'server/index.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
