import { defineConfig } from 'vitest/config';

// Testes de integração: precisam de Postgres e Redis rodando (docker compose up -d)
export default defineConfig({
  test: {
    include: ['src/**/*.int.test.ts'],
    fileParallelism: false,
    testTimeout: 15000,
  },
});
