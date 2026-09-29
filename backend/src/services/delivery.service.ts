// Execução da entrega: máquina de estados, liberação de motorista/veículo e cancelamento.
// Regras em docs/02-modelo-de-dados.md (deliveries, cancelamento de entrega).
import type { Knex } from 'knex';
import {
  DeliveryStatus,
  DriverStatus,
  OfferStatus,
  ShipmentStatus,
  VehicleStatus,
  type DeliveryDetailDto,
  type DeliveryWithShipmentDto,
} from '@fleetworkslog/shared';
import { AppError } from '../errors/app-error.js';
import {
  deliveriesQuery,
  toDeliveryDto,
  toDeliveryEventDto,
  type DeliveryEventRow,
  type DeliveryRow,
} from '../models/delivery.model.js';
import { shipmentColumns, toShipmentDto, type ShipmentRow } from '../models/shipment.model.js';
import type { UpdateDeliveryStatusInput } from '../schemas/delivery.schema.js';

/** Único próximo passo permitido ao motorista a partir de cada status. */
export const NEXT_DELIVERY_STATUS: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
  [DeliveryStatus.COLETA_PENDENTE]: DeliveryStatus.COLETADO,
  [DeliveryStatus.COLETADO]: DeliveryStatus.EM_TRANSITO,
  [DeliveryStatus.EM_TRANSITO]: DeliveryStatus.ENTREGUE,
};

const ACTIVE_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.COLETA_PENDENTE,
  DeliveryStatus.COLETADO,
  DeliveryStatus.EM_TRANSITO,
];

/** Motorista e veículo ficam EM_VIAGEM só depois da coleta. */
const RESOURCES_IN_USE: DeliveryStatus[] = [DeliveryStatus.COLETADO, DeliveryStatus.EM_TRANSITO];

// Toda mudança de status de uma entrega gera um evento de auditoria.
// `createdBy` fica nulo até as rotas terem usuário logado.
export async function recordDeliveryEvent(
  trx: Knex.Transaction,
  deliveryId: string,
  status: DeliveryStatus,
  note: string | null,
  createdBy: string | null = null,
): Promise<void> {
  await trx('delivery_status_events').insert({
    delivery_id: deliveryId,
    status,
    note,
    created_by: createdBy,
  });
}

async function loadShipments(db: Knex, ids: string[]): Promise<Map<string, ShipmentRow>> {
  const rows = (await db('shipments')
    .whereIn('id', ids)
    .select(shipmentColumns(db))) as ShipmentRow[];
  return new Map(rows.map((row) => [row.id, row]));
}

export async function getDeliveryDetail(db: Knex, deliveryId: string): Promise<DeliveryDetailDto> {
  const row = (await deliveriesQuery(db).where('d.id', deliveryId).first()) as
    DeliveryRow | undefined;
  if (!row) throw AppError.notFound('Entrega não encontrada');

  const [shipments, events] = await Promise.all([
    loadShipments(db, [row.shipment_id]),
    db('delivery_status_events')
      .where({ delivery_id: deliveryId })
      .orderBy('created_at')
      .select<DeliveryEventRow[]>('id', 'status', 'note', 'created_by', 'created_at'),
  ]);

  return {
    ...toDeliveryDto(row),
    shipment: toShipmentDto(shipments.get(row.shipment_id) as ShipmentRow),
    events: events.map(toDeliveryEventDto),
  };
}

export async function getShipperDelivery(
  db: Knex,
  shipperId: string,
  deliveryId: string,
): Promise<DeliveryDetailDto> {
  const owned = await db('deliveries as d')
    .join('shipments as s', 's.id', 'd.shipment_id')
    .where({ 'd.id': deliveryId, 's.shipper_id': shipperId })
    .first('d.id');
  if (!owned) throw AppError.notFound('Entrega não encontrada');
  return getDeliveryDetail(db, deliveryId);
}

/** Entregas em andamento atribuídas ao motorista (de transportadora ou autônomo). */
export async function listDriverDeliveries(
  db: Knex,
  driverId: string,
): Promise<DeliveryWithShipmentDto[]> {
  const driver = await db('drivers').where({ id: driverId }).first('id');
  if (!driver) throw AppError.notFound('Motorista não encontrado');

  const rows = (await deliveriesQuery(db)
    .where('o.driver_id', driverId)
    .whereIn('d.status', ACTIVE_STATUSES)
    .orderBy('d.created_at')) as DeliveryRow[];
  const shipments = await loadShipments(
    db,
    rows.map((row) => row.shipment_id),
  );

  return rows.map((row) => ({
    ...toDeliveryDto(row),
    shipment: toShipmentDto(shipments.get(row.shipment_id) as ShipmentRow),
  }));
}

async function lockDelivery(trx: Knex.Transaction, deliveryId: string): Promise<DeliveryRow> {
  // Trava só a linha da entrega; a oferta é lida depois, sem lock
  const delivery = await trx('deliveries').where({ id: deliveryId }).forUpdate().first('id');
  if (!delivery) throw AppError.notFound('Entrega não encontrada');
  return (await deliveriesQuery(trx).where('d.id', deliveryId).first()) as DeliveryRow;
}

/** Na coleta, motorista e veículo passam a EM_VIAGEM e o vínculo entra no histórico. */
async function takeResources(trx: Knex.Transaction, driverId: string, vehicleId: string) {
  const driver = await trx('drivers').where({ id: driverId }).forUpdate().first('status');
  const vehicle = await trx('vehicles').where({ id: vehicleId }).forUpdate().first('status');
  if (driver?.status === DriverStatus.EM_VIAGEM) {
    throw AppError.conflict('Motorista já está em outra viagem');
  }
  if (vehicle?.status !== VehicleStatus.DISPONIVEL) {
    throw AppError.conflict(`Veículo não está DISPONIVEL (${vehicle?.status})`);
  }

  await trx('drivers')
    .where({ id: driverId })
    .update({ status: DriverStatus.EM_VIAGEM, updated_at: trx.fn.now() });
  await trx('vehicles')
    .where({ id: vehicleId })
    .update({ status: VehicleStatus.EM_VIAGEM, updated_at: trx.fn.now() });
  await trx('driver_vehicles').insert({ driver_id: driverId, vehicle_id: vehicleId });
}

async function releaseResources(trx: Knex.Transaction, driverId: string, vehicleId: string) {
  await trx('drivers')
    .where({ id: driverId, status: DriverStatus.EM_VIAGEM })
    .update({ status: DriverStatus.DISPONIVEL, updated_at: trx.fn.now() });
  await trx('vehicles')
    .where({ id: vehicleId, status: VehicleStatus.EM_VIAGEM })
    .update({ status: VehicleStatus.DISPONIVEL, updated_at: trx.fn.now() });
  await trx('driver_vehicles')
    .where({ driver_id: driverId, vehicle_id: vehicleId })
    .whereNull('ended_at')
    .update({ ended_at: trx.fn.now() });
}

/** Motorista avança a entrega um passo: COLETA_PENDENTE → COLETADO → EM_TRANSITO → ENTREGUE. */
export function advanceDeliveryStatus(
  db: Knex,
  driverId: string,
  deliveryId: string,
  input: UpdateDeliveryStatusInput,
): Promise<DeliveryDetailDto> {
  return db.transaction(async (trx) => {
    const delivery = await lockDelivery(trx, deliveryId);
    // Entrega de outro motorista (ou ainda sem motorista atribuído) não é visível para ele
    if (delivery.driver_id !== driverId) throw AppError.notFound('Entrega não encontrada');

    const expected = NEXT_DELIVERY_STATUS[delivery.status];
    if (input.status !== expected) {
      throw AppError.conflict(
        expected
          ? `Transição inválida: ${delivery.status} → ${input.status} (próximo passo: ${expected})`
          : `A entrega já está ${delivery.status}`,
      );
    }

    const changes: Record<string, unknown> = { status: input.status, updated_at: trx.fn.now() };
    if (input.status === DeliveryStatus.COLETADO) {
      if (!delivery.vehicle_id) {
        throw AppError.conflict('A transportadora ainda não atribuiu o veículo desta entrega');
      }
      await takeResources(trx, driverId, delivery.vehicle_id);
      changes.picked_up_at = trx.fn.now();
    } else if (input.status === DeliveryStatus.EM_TRANSITO) {
      await trx('shipments')
        .where({ id: delivery.shipment_id })
        .update({ status: ShipmentStatus.EM_TRANSITO, updated_at: trx.fn.now() });
    } else {
      changes.delivered_at = trx.fn.now();
      await trx('shipments')
        .where({ id: delivery.shipment_id })
        .update({ status: ShipmentStatus.ENTREGUE, updated_at: trx.fn.now() });
      await releaseResources(trx, driverId, delivery.vehicle_id as string);
    }

    await trx('deliveries').where({ id: deliveryId }).update(changes);
    await recordDeliveryEvent(trx, deliveryId, input.status, input.note ?? null);
    return getDeliveryDetail(trx, deliveryId);
  });
}

/**
 * Empresa cancela a entrega (docs/02-modelo-de-dados.md — Cancelamento de entrega):
 * a oferta vira CANCELADA, a carga volta para ABERTA e motorista/veículo são liberados.
 */
export function cancelDelivery(
  db: Knex,
  shipperId: string,
  deliveryId: string,
  note: string | null,
): Promise<DeliveryDetailDto> {
  return db.transaction(async (trx) => {
    const delivery = await lockDelivery(trx, deliveryId);
    const shipment = await trx('shipments')
      .where({ id: delivery.shipment_id, shipper_id: shipperId })
      .forUpdate()
      .first('id');
    if (!shipment) throw AppError.notFound('Entrega não encontrada');

    if (!ACTIVE_STATUSES.includes(delivery.status)) {
      throw AppError.conflict(`Não é possível cancelar uma entrega ${delivery.status}`);
    }

    await trx('deliveries').where({ id: deliveryId }).update({
      status: DeliveryStatus.CANCELADO,
      cancelled_at: trx.fn.now(),
      updated_at: trx.fn.now(),
    });
    await trx('shipment_offers')
      .where({ id: delivery.offer_id })
      .update({ status: OfferStatus.CANCELADA, updated_at: trx.fn.now() });
    await trx('shipments')
      .where({ id: delivery.shipment_id })
      .update({ status: ShipmentStatus.ABERTA, updated_at: trx.fn.now() });
    if (RESOURCES_IN_USE.includes(delivery.status)) {
      await releaseResources(trx, delivery.driver_id as string, delivery.vehicle_id as string);
    }

    await recordDeliveryEvent(trx, deliveryId, DeliveryStatus.CANCELADO, note);
    return getDeliveryDetail(trx, deliveryId);
  });
}
