import path from 'node:path';
import knexFactory, { type Knex } from 'knex';

// Em dev/teste rodamos via tsx (arquivos .ts); em produção, a partir do dist compilado (.js)
const isCompiled = import.meta.filename.endsWith('.js');
const extension = isCompiled ? 'js' : 'ts';

export function buildKnexConfig(databaseUrl: string): Knex.Config {
  return {
    client: 'pg',
    connection: databaseUrl,
    pool: { min: 0, max: 10 },
    migrations: {
      directory: path.join(import.meta.dirname, 'migrations'),
      tableName: 'knex_migrations',
      extension,
      loadExtensions: [`.${extension}`],
    },
    seeds: {
      directory: path.join(import.meta.dirname, 'seeds'),
      extension,
      loadExtensions: [`.${extension}`],
    },
  };
}

export function createKnex(databaseUrl: string): Knex {
  return knexFactory(buildKnexConfig(databaseUrl));
}
