import type { Knex } from 'knex';

// Cargas e ofertas — docs/02-modelo-de-dados.md e docs/08-precificacao.md.
const VEHICLE_TYPES = ['VAN', 'TRUCK_TOCO', 'TRUCK_TRUCK', 'CARRETA'];
const SHIPMENT_STATUSES = ['ABERTA', 'ACEITA', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADA'];
const OFFER_STATUSES = ['PENDENTE', 'ACEITA', 'RECUSADA', 'RETIRADA', 'CANCELADA'];

const POINT = 'geography(Point, 4326)';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('shipments', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('shipper_id').notNullable().references('id').inTable('companies');
    t.string('origin_address', 300).notNullable();
    t.specificType('origin_geo', POINT).notNullable();
    t.string('destination_address', 300).notNullable();
    t.specificType('destination_geo', POINT).notNullable();
    t.string('cargo_type', 100).notNullable();
    t.decimal('weight_kg', 10, 2).notNullable();
    t.decimal('volume_m3', 10, 3).notNullable();
    t.enu('required_vehicle_type', VEHICLE_TYPES).notNullable();
    t.timestamp('pickup_window_start', { useTz: true }).notNullable();
    t.timestamp('pickup_window_end', { useTz: true }).notNullable();
    t.timestamp('delivery_deadline', { useTz: true }).notNullable();
    t.text('special_requirements').nullable();
    t.decimal('price_offered', 12, 2).notNullable();
    t.enu('status', SHIPMENT_STATUSES).notNullable().defaultTo('ABERTA');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.check('weight_kg > 0', {}, 'shipments_weight_kg_positive');
    t.check('volume_m3 > 0', {}, 'shipments_volume_m3_positive');
    t.check('price_offered > 0', {}, 'shipments_price_offered_positive');
    t.check('pickup_window_start < pickup_window_end', {}, 'shipments_pickup_window_order');
    t.check('delivery_deadline > pickup_window_start', {}, 'shipments_deadline_after_pickup');
    t.index(['shipper_id', 'created_at']);
    t.index('status');
  });
  await knex.raw('CREATE INDEX shipments_origin_geo_gist ON shipments USING GIST (origin_geo)');
  await knex.raw(
    'CREATE INDEX shipments_destination_geo_gist ON shipments USING GIST (destination_geo)',
  );

  await knex.schema.createTable('shipment_offers', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('shipment_id').notNullable().references('id').inTable('shipments');
    // Nulo quando quem oferta é um motorista autônomo
    t.uuid('carrier_id').nullable().references('id').inTable('companies');
    // Transportadora pode ofertar sem motorista/veículo e definir depois (docs/08-precificacao.md)
    t.uuid('driver_id').nullable().references('id').inTable('drivers');
    t.uuid('vehicle_id').nullable().references('id').inTable('vehicles');
    t.decimal('price_proposed', 12, 2).notNullable();
    t.enu('status', OFFER_STATUSES).notNullable().defaultTo('PENDENTE');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    // Autônomo sempre oferta com ele mesmo e o veículo próprio
    t.check(
      'carrier_id IS NOT NULL OR (driver_id IS NOT NULL AND vehicle_id IS NOT NULL)',
      {},
      'shipment_offers_autonomous_requires_driver_and_vehicle',
    );
    t.check('price_proposed > 0', {}, 'shipment_offers_price_proposed_positive');
    t.index(['shipment_id', 'status']);
    t.index('carrier_id');
    t.index('driver_id');
  });
  // No máximo uma oferta PENDENTE do mesmo ofertante na mesma carga
  await knex.raw(`
    CREATE UNIQUE INDEX shipment_offers_one_pending_per_carrier
      ON shipment_offers (shipment_id, carrier_id)
      WHERE status = 'PENDENTE' AND carrier_id IS NOT NULL
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX shipment_offers_one_pending_per_autonomous
      ON shipment_offers (shipment_id, driver_id)
      WHERE status = 'PENDENTE' AND carrier_id IS NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('shipment_offers');
  await knex.schema.dropTable('shipments');
}
