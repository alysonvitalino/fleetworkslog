// Infra dos testes de integração: app real ligada a um Postgres/PostGIS de teste
import type { Knex } from 'knex';
import { createApp } from '../app.js';
import { createKnex } from '../db/knex.js';
import { createLogger } from '../lib/logger.js';

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgres://fleetworkslog:fleetworkslog@localhost:5437/fleetworkslog_test';

export function createTestContext() {
  const db = createKnex(databaseUrl);
  const app = createApp({
    logger: createLogger('silent'),
    corsOrigins: [],
    db,
    healthChecks: { postgres: () => Promise.resolve(), redis: () => Promise.resolve() },
  });
  return { db, app };
}

/** Apaga todos os dados entre testes (as tabelas de domínio dependem de `users`). */
export async function resetDatabase(db: Knex): Promise<void> {
  await db.raw('TRUNCATE users CASCADE');
}
