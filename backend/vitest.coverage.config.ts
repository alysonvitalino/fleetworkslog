import { defineConfig } from 'vitest/config';

// Cobertura: roda unitários + integração juntos (precisa de Postgres e Redis: docker compose up -d).
// Excluímos apenas testes, arquivos de infraestrutura de banco (migrations, seeds, CLI) e o
// bootstrap do servidor — toda a aplicação (controllers, services, models, schemas, rotas) é medida.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Os testes de integração compartilham o mesmo banco de teste
    fileParallelism: false,
    testTimeout: 15000,
    coverage: {
      enabled: true,
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/test/**',
        'src/db/migrations/**',
        'src/db/seeds/**',
        'src/db/cli.ts',
        'src/server.ts',
      ],
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 60,
        statements: 60,
        functions: 60,
        branches: 60,
      },
    },
  },
});
