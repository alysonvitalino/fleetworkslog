import type { Knex } from 'knex';

// Garante o PostGIS em qualquer ambiente (no Docker local o init script já cria,
// mas staging/produção dependem desta migration)
export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS postgis');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP EXTENSION IF EXISTS postgis');
}
