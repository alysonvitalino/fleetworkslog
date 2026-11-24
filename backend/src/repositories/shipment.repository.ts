import type { Knex } from 'knex';
import { OfferStatus, type ShipmentStatus } from '@fleetworkslog/shared';
import { toGeography } from '../db/geo.js';
import { shipmentColumns, type ShipmentRow } from '../models/shipment.model.js';
import type { CreateShipmentInput, UpdateShipmentInput } from '../schemas/shipment.schema.js';
import { BaseRepository, type PageFilter, type PagedRows } from './base.repository.js';

/** Acesso às tabelas `shipments` (cargas) e às ofertas de cada carga. */
export class ShipmentRepository extends BaseRepository<ShipmentRepository> {
  protected withConnection(connection: Knex): ShipmentRepository {
    return new ShipmentRepository(connection);
  }

  async list(
    shipperId: string,
    filter: PageFilter<ShipmentStatus>,
  ): Promise<PagedRows<ShipmentRow>> {
    const base = this.db('shipments')
      .where({ shipper_id: shipperId })
      .modify((qb) => {
        if (filter.status) qb.where({ status: filter.status });
      });

    const [rows, countRow] = await Promise.all([
      base
        .clone()
        .select(shipmentColumns(this.db))
        .orderBy('created_at', 'desc')
        .limit(filter.limit)
        .offset(filter.offset),
      base.clone().count<{ count: string }>({ count: '*' }).first(),
    ]);
    return { rows: rows as ShipmentRow[], total: Number(countRow?.count ?? 0) };
  }

  async findOwned(shipperId: string, shipmentId: string): Promise<ShipmentRow | undefined> {
    return this.ownedQuery(shipperId, shipmentId);
  }

  /**
   * Busca a carga travando a linha até o fim da transação (FOR UPDATE).
   * Só faz sentido dentro de `transaction()`.
   */
  async findOwnedForUpdate(
    shipperId: string,
    shipmentId: string,
  ): Promise<ShipmentRow | undefined> {
    return this.ownedQuery(shipperId, shipmentId).forUpdate();
  }

  async create(shipperId: string, input: CreateShipmentInput): Promise<string> {
    const [created] = await this.db('shipments')
      .insert({ ...toRowFields(this.db, input), shipper_id: shipperId })
      .returning<{ id: string }[]>('id');
    return (created as { id: string }).id;
  }

  async update(shipmentId: string, input: UpdateShipmentInput): Promise<void> {
    await this.db('shipments')
      .where({ id: shipmentId })
      .update({ ...toRowFields(this.db, input), updated_at: this.db.fn.now() });
  }

  async updateStatus(shipmentId: string, status: ShipmentStatus): Promise<void> {
    await this.db('shipments')
      .where({ id: shipmentId })
      .update({ status, updated_at: this.db.fn.now() });
  }

  async hasOffers(shipmentId: string): Promise<boolean> {
    const offer = await this.db('shipment_offers').where({ shipment_id: shipmentId }).first('id');
    return offer !== undefined;
  }

  async cancelPendingOffers(shipmentId: string): Promise<void> {
    await this.db('shipment_offers')
      .where({ shipment_id: shipmentId, status: OfferStatus.PENDENTE })
      .update({ status: OfferStatus.CANCELADA, updated_at: this.db.fn.now() });
  }

  async delete(shipmentId: string): Promise<void> {
    await this.db('shipments').where({ id: shipmentId }).delete();
  }

  private ownedQuery(shipperId: string, shipmentId: string) {
    return this.db('shipments')
      .where({ id: shipmentId, shipper_id: shipperId })
      .first<ShipmentRow | undefined>(shipmentColumns(this.db));
  }
}

/** Converte os campos da API (camelCase) para as colunas do banco. */
function toRowFields(db: Knex, input: UpdateShipmentInput): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (input.origin) {
    fields.origin_address = input.origin.address;
    fields.origin_geo = toGeography(db, input.origin);
  }
  if (input.destination) {
    fields.destination_address = input.destination.address;
    fields.destination_geo = toGeography(db, input.destination);
  }
  if (input.cargoType !== undefined) fields.cargo_type = input.cargoType;
  if (input.weightKg !== undefined) fields.weight_kg = input.weightKg;
  if (input.volumeM3 !== undefined) fields.volume_m3 = input.volumeM3;
  if (input.requiredVehicleType !== undefined) {
    fields.required_vehicle_type = input.requiredVehicleType;
  }
  if (input.pickupWindowStart !== undefined) fields.pickup_window_start = input.pickupWindowStart;
  if (input.pickupWindowEnd !== undefined) fields.pickup_window_end = input.pickupWindowEnd;
  if (input.deliveryDeadline !== undefined) fields.delivery_deadline = input.deliveryDeadline;
  if (input.specialRequirements !== undefined) {
    fields.special_requirements = input.specialRequirements ?? null;
  }
  if (input.priceOffered !== undefined) fields.price_offered = input.priceOffered;
  return fields;
}
