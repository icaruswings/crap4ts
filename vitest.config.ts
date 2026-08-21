import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: [...defaultExclude, '.stryker-tmp/**', '.worktrees/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/**/*.ts'],
    },
  },
});
