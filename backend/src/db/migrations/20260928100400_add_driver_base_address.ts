import type { Knex } from 'knex';

// O endereço-base do autônomo só guardava o ponto (base_geo); o texto é o que o app exibe
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('drivers', (t) => {
    t.string('base_address', 300).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('drivers', (t) => {
    t.dropColumn('base_address');
  });
}
