import type { Knex } from 'knex';
import {
  OfferStatus,
  ShipmentStatus,
  type PaginatedResponse,
  type ShipmentDto,
} from '@fleetworkslog/shared';
import { toGeography } from '../db/geo.js';
import { AppError } from '../errors/app-error.js';
import { shipmentColumns, toShipmentDto, type ShipmentRow } from '../models/shipment.model.js';
import {
  scheduleIssues,
  type CreateShipmentInput,
  type ListShipmentsQuery,
  type UpdateShipmentInput,
} from '../schemas/shipment.schema.js';
import { assertShipperExists } from './owners.service.js';

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

function findOwnedShipment(db: Knex, shipperId: string, shipmentId: string) {
  return db('shipments')
    .where({ id: shipmentId, shipper_id: shipperId })
    .first(shipmentColumns(db));
}

/** Busca a carga travando a linha até o fim da transação (edição e cancelamento). */
async function lockOwnedShipment(
  trx: Knex.Transaction,
  shipperId: string,
  shipmentId: string,
): Promise<ShipmentRow> {
  const row = await findOwnedShipment(trx, shipperId, shipmentId).forUpdate();
  if (!row) throw AppError.notFound('Carga não encontrada');
  return row;
}

export async function listShipments(
  db: Knex,
  shipperId: string,
  query: ListShipmentsQuery,
): Promise<PaginatedResponse<ShipmentDto>> {
  await assertShipperExists(db, shipperId);
  const base = db('shipments')
    .where({ shipper_id: shipperId })
    .modify((qb) => {
      if (query.status) qb.where({ status: query.status });
    });

  const [rows, countRow] = await Promise.all([
    base
      .clone()
      .select(shipmentColumns(db))
      .orderBy('created_at', 'desc')
      .limit(query.limit)
      .offset(query.offset),
    base.clone().count<{ count: string }>({ count: '*' }).first(),
  ]);

  return {
    items: (rows as ShipmentRow[]).map(toShipmentDto),
    total: Number(countRow?.count ?? 0),
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getShipment(
  db: Knex,
  shipperId: string,
  shipmentId: string,
): Promise<ShipmentDto> {
  const row = await findOwnedShipment(db, shipperId, shipmentId);
  if (!row) throw AppError.notFound('Carga não encontrada');
  return toShipmentDto(row);
}

export async function createShipment(
  db: Knex,
  shipperId: string,
  input: CreateShipmentInput,
): Promise<ShipmentDto> {
  await assertShipperExists(db, shipperId);
  const [created] = await db('shipments')
    .insert({ ...toRowFields(db, input), shipper_id: shipperId })
    .returning<{ id: string }[]>('id');
  return getShipment(db, shipperId, (created as { id: string }).id);
}

export function updateShipment(
  db: Knex,
  shipperId: string,
  shipmentId: string,
  input: UpdateShipmentInput,
): Promise<ShipmentDto> {
  return db.transaction(async (trx) => {
    const current = await lockOwnedShipment(trx, shipperId, shipmentId);
    if (current.status !== ShipmentStatus.ABERTA) {
      throw AppError.conflict('Só é possível editar uma carga ABERTA');
    }

    // As datas novas precisam ser coerentes com as que continuam salvas
    const touchesSchedule =
      input.pickupWindowStart !== undefined ||
      input.pickupWindowEnd !== undefined ||
      input.deliveryDeadline !== undefined;
    if (touchesSchedule) {
      const issues = scheduleIssues({
        pickupWindowStart: input.pickupWindowStart ?? current.pickup_window_start,
        pickupWindowEnd: input.pickupWindowEnd ?? current.pickup_window_end,
        deliveryDeadline: input.deliveryDeadline ?? current.delivery_deadline,
      });
      if (issues.length > 0) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Payload inválido', issues);
      }
    }

    await trx('shipments')
      .where({ id: shipmentId })
      .update({ ...toRowFields(trx, input), updated_at: trx.fn.now() });
    return getShipment(trx, shipperId, shipmentId);
  });
}

/**
 * Cancela uma carga ABERTA e encerra as ofertas pendentes dela (docs/08-precificacao.md).
 * Carga já aceita não é cancelada aqui: cancela-se a entrega, que devolve a carga para ABERTA.
 */
export function cancelShipment(
  db: Knex,
  shipperId: string,
  shipmentId: string,
): Promise<ShipmentDto> {
  return db.transaction(async (trx) => {
    const current = await lockOwnedShipment(trx, shipperId, shipmentId);
    if (current.status !== ShipmentStatus.ABERTA) {
      throw AppError.conflict(
        current.status === ShipmentStatus.CANCELADA
          ? 'Carga já está cancelada'
          : 'Só é possível cancelar uma carga ABERTA; para carga aceita, cancele a entrega',
      );
    }

    await trx('shipments')
      .where({ id: shipmentId })
      .update({ status: ShipmentStatus.CANCELADA, updated_at: trx.fn.now() });
    await trx('shipment_offers')
      .where({ shipment_id: shipmentId, status: OfferStatus.PENDENTE })
      .update({ status: OfferStatus.CANCELADA, updated_at: trx.fn.now() });
    return getShipment(trx, shipperId, shipmentId);
  });
}
