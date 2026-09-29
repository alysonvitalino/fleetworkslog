import type { Knex } from 'knex';

// Execução da entrega — docs/02-modelo-de-dados.md (deliveries, atraso e cancelamento).
// Atraso não é status: fica em `is_late`, porque a entrega pode estar EM_TRANSITO e atrasada.
const DELIVERY_STATUSES = ['COLETA_PENDENTE', 'COLETADO', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADO'];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('deliveries', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('shipment_id').notNullable().references('id').inTable('shipments');
    t.uuid('offer_id').notNullable().unique().references('id').inTable('shipment_offers');
    t.enu('status', DELIVERY_STATUSES).notNullable().defaultTo('COLETA_PENDENTE');
    t.boolean('is_late').notNullable().defaultTo(false);
    t.timestamp('late_detected_at', { useTz: true }).nullable();
    t.timestamp('picked_up_at', { useTz: true }).nullable();
    t.timestamp('delivered_at', { useTz: true }).nullable();
    t.timestamp('cancelled_at', { useTz: true }).nullable();
    t.text('proof_of_delivery_url').nullable();
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    t.check("status <> 'CANCELADO' OR cancelled_at IS NOT NULL", {}, 'deliveries_cancelled_at');
    t.check("status <> 'ENTREGUE' OR delivered_at IS NOT NULL", {}, 'deliveries_delivered_at');
    t.index('shipment_id');
    t.index('status');
  });
  // Entrega cancelada devolve a carga para ABERTA, que pode gerar uma nova entrega:
  // a unicidade é só entre as não canceladas
  await knex.raw(`
    CREATE UNIQUE INDEX deliveries_one_active_per_shipment
      ON deliveries (shipment_id)
      WHERE status <> 'CANCELADO'
  `);

  await knex.schema.createTable('delivery_status_events', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('delivery_id').notNullable().references('id').inTable('deliveries');
    t.enu('status', DELIVERY_STATUSES).notNullable();
    t.text('note').nullable();
    // Nulo em eventos gerados pelo sistema (e enquanto as rotas ainda não têm usuário logado)
    t.uuid('created_by').nullable().references('id').inTable('users');
    t.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.index(['delivery_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('delivery_status_events');
  await knex.schema.dropTable('deliveries');
}
