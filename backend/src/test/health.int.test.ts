// Teste de integração: usa Postgres e Redis reais (docker compose local ou services do CI)
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createKnex } from '../db/knex.js';
import { createLogger } from '../lib/logger.js';
import { createRedis } from '../lib/redis.js';

const databaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgres://fleetworkslog:fleetworkslog@localhost:5437/fleetworkslog_test';
const redisUrl = process.env.TEST_REDIS_URL ?? 'redis://localhost:6382/1';

const knex = createKnex(databaseUrl);
const redis = createRedis(redisUrl);

beforeAll(async () => {
  await redis.connect();
  await knex.migrate.latest();
});

afterAll(async () => {
  await knex.migrate.rollback(undefined, true);
  await Promise.all([knex.destroy(), redis.quit()]);
});

describe('integração com Postgres e Redis', () => {
  it('should return 200 on /health with real connections', async () => {
    const app = createApp({
      logger: createLogger('silent'),
      corsOrigins: [],
      db: knex,
      healthChecks: { postgres: () => knex.raw('SELECT 1'), redis: () => redis.ping() },
    });
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.checks).toEqual({ postgres: 'ok', redis: 'ok' });
  });

  it('should have PostGIS available after running the migrations', async () => {
    const result = await knex.raw("SELECT extname FROM pg_extension WHERE extname = 'postgis'");
    expect(result.rows).toHaveLength(1);
  });
});
