import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createKnex } from './db/knex.js';
import { createLogger } from './lib/logger.js';
import { createRedis } from './lib/redis.js';

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);
const knex = createKnex(env.DATABASE_URL);
const redis = createRedis(env.REDIS_URL);

redis.on('error', (error) => logger.warn({ err: error }, 'Redis indisponível'));
await redis.connect().catch((error: unknown) => {
  // Sobe mesmo assim: o /health vai reportar redis=error e o ioredis tenta reconectar
  logger.warn({ err: error }, 'Não foi possível conectar ao Redis na inicialização');
});

const app = createApp({
  logger,
  corsOrigins: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
  db: knex,
  healthChecks: {
    postgres: () => knex.raw('SELECT 1'),
    redis: () => redis.ping(),
  },
});

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API no ar');
});

// Encerramento gracioso: para de aceitar conexões e fecha banco/redis antes de sair
async function shutdown(signal: string) {
  logger.info({ signal }, 'Encerrando');
  server.close();
  await Promise.allSettled([knex.destroy(), redis.quit()]);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
