import type { Knex } from 'knex';

// Cadastros: empresas/transportadoras, motoristas e veículos — docs/02-modelo-de-dados.md.
// Empresa e transportadora dividem a tabela `companies`, diferenciadas por `type`
// (decisão registrada em docs/04-decisoes-em-aberto.md).
const COMPANY_TYPES = ['EMPRESA', 'TRANSPORTADORA'];
const DRIVER_STATUSES = ['DISPONIVEL', 'EM_VIAGEM', 'INDISPONIVEL'];
const VEHICLE_TYPES = ['VAN', 'TRUCK_TOCO', 'TRUCK_TRUCK', 'CARRETA'];
const VEHICLE_STATUSES = ['DISPONIVEL', 'EM_VIAGEM', 'MANUTENCAO'];
const CNH_CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'];

const POINT = 'geography(Point, 4326)';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('companies', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('user_id').notNullable().unique().references('id').inTable('users');
    t.enu('type', COMPANY_TYPES).notNullable();
    t.string('legal_name', 200).notNullable();
    t.string('document', 14).notNullable().unique(); // CNPJ só com dígitos
    t.string('phone', 20).nullable();
    t.jsonb('address_json').nullable();
    // Ponto de referência da busca de cargas por raio (matching) — obrigatório para transportadora
    t.specificType('base_geo', POINT).nullable();
    t.decimal('rating_avg', 3, 2).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.check("document ~ '^[0-9]{14}$'", {}, 'companies_document_cnpj_digits');
    t.check(
      "type <> 'TRANSPORTADORA' OR base_geo IS NOT NULL",
      {},
      'companies_carrier_requires_base_geo',
    );
    t.check('rating_avg BETWEEN 1 AND 5', {}, 'companies_rating_avg_range');
  });
  await knex.raw('CREATE INDEX companies_base_geo_gist ON companies USING GIST (base_geo)');

  await knex.schema.createTable('drivers', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('user_id').notNullable().unique().references('id').inTable('users');
    // Nulo = motorista autônomo, sem transportadora
    t.uuid('carrier_id').nullable().references('id').inTable('companies');
    t.string('cnh_number', 11).notNullable().unique();
    t.enu('cnh_category', CNH_CATEGORIES).notNullable();
    t.string('phone', 20).nullable();
    t.enu('status', DRIVER_STATUSES).notNullable().defaultTo('DISPONIVEL');
    t.specificType('base_geo', POINT).nullable();
    t.decimal('rating_avg', 3, 2).nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    // A posição atual NÃO fica aqui: vive no Redis (docs/05-armazenamento-gps.md)

    t.check("cnh_number ~ '^[0-9]{11}$'", {}, 'drivers_cnh_number_digits');
    t.check(
      'carrier_id IS NOT NULL OR base_geo IS NOT NULL',
      {},
      'drivers_autonomous_requires_base_geo',
    );
    t.check('rating_avg BETWEEN 1 AND 5', {}, 'drivers_rating_avg_range');
    t.index('carrier_id');
  });
  await knex.raw('CREATE INDEX drivers_base_geo_gist ON drivers USING GIST (base_geo)');

  await knex.schema.createTable('vehicles', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('carrier_id').nullable().references('id').inTable('companies');
    t.uuid('owner_driver_id').nullable().references('id').inTable('drivers');
    t.string('plate', 7).notNullable().unique(); // normalizada: AAA9999 ou Mercosul AAA9A99
    t.enu('type', VEHICLE_TYPES).notNullable();
    t.decimal('capacity_kg', 10, 2).notNullable();
    t.decimal('capacity_m3', 10, 3).notNullable();
    t.enu('status', VEHICLE_STATUSES).notNullable().defaultTo('DISPONIVEL');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Veículo é da frota de uma transportadora OU próprio de um autônomo — nunca os dois
    t.check('num_nonnulls(carrier_id, owner_driver_id) = 1', {}, 'vehicles_exactly_one_owner');
    t.check("plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'", {}, 'vehicles_plate_format');
    t.check('capacity_kg > 0', {}, 'vehicles_capacity_kg_positive');
    t.check('capacity_m3 > 0', {}, 'vehicles_capacity_m3_positive');
    t.index('carrier_id');
    t.index('owner_driver_id');
  });

  await knex.schema.createTable('driver_vehicles', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('driver_id').notNullable().references('id').inTable('drivers');
    t.uuid('vehicle_id').notNullable().references('id').inTable('vehicles');
    t.timestamp('started_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('ended_at', { useTz: true }).nullable();

    t.check('ended_at IS NULL OR ended_at >= started_at', {}, 'driver_vehicles_period');
    t.index('driver_id');
    t.index('vehicle_id');
  });
  // Um motorista dirige um veículo por vez, e um veículo tem um motorista por vez
  await knex.raw(
    'CREATE UNIQUE INDEX driver_vehicles_open_per_driver ON driver_vehicles (driver_id) WHERE ended_at IS NULL',
  );
  await knex.raw(
    'CREATE UNIQUE INDEX driver_vehicles_open_per_vehicle ON driver_vehicles (vehicle_id) WHERE ended_at IS NULL',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('driver_vehicles');
  await knex.schema.dropTable('vehicles');
  await knex.schema.dropTable('drivers');
  await knex.schema.dropTable('companies');
}
