import type { Knex } from 'knex';

// Autenticação e perfis — docs/02-modelo-de-dados.md.
// Os valores de enum ficam fixos aqui (e não importados do shared/): a migration é uma
// foto do schema, então mudar um enum depois exige uma migration nova.
const ROLES = ['ADMIN', 'OPERADOR', 'EMPRESA', 'TRANSPORTADORA', 'MOTORISTA'];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.string('name', 150).notNullable();
    t.string('email', 254).notNullable();
    // Nulo enquanto um motorista convidado pela transportadora ainda não definiu a senha
    t.text('password_hash').nullable();
    t.enu('role', ROLES).notNullable();
    t.timestamp('disabled_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
  // E-mail único sem diferenciar maiúsculas/minúsculas
  await knex.raw('CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email))');

  await knex.schema.createTable('refresh_tokens', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('token_hash').notNullable().unique();
    t.timestamp('expires_at', { useTz: true }).notNullable();
    t.timestamp('revoked_at', { useTz: true }).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index('user_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('refresh_tokens');
  await knex.schema.dropTable('users');
}
