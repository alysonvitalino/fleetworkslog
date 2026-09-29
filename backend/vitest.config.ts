import { defineConfig } from 'vitest/config';

// Testes unitários: rodam sem banco/redis
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.int.test.ts'],
  },
});
