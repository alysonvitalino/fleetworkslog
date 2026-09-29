// Lado de quem oferta no marketplace (transportadora ou motorista autônomo):
// cargas disponíveis, ofertas/contrapropostas e atribuição de motorista/veículo.
// Regras em docs/08-precificacao.md.
import type { Knex } from 'knex';
import {
  DeliveryStatus,
  DriverStatus,
  OfferStatus,
  ShipmentStatus,
  VehicleStatus,
  type AvailableShipmentDto,
  type PaginatedResponse,
  type ShipmentDto,
  type ShipmentOfferDto,
  type VehicleType,
} from '@fleetworkslog/shared';
import { toGeography } from '../db/geo.js';
import { isUniqueViolation } from '../db/pg-errors.js';
import { AppError } from '../errors/app-error.js';
import { offersQuery, toOfferDto, type OfferRow } from '../models/offer.model.js';
import { shipmentColumns, toShipmentDto, type ShipmentRow } from '../models/shipment.model.js';
import type {
  AvailableShipmentsQuery,
  ListOffersQuery,
  OfferAssignmentInput,
} from '../schemas/marketplace.schema.js';
import { assertPartyExists, type Party } from './owners.service.js';

interface ShipmentRequirements {
  id: string;
  status: ShipmentStatus;
  required_vehicle_type: VehicleType;
  weight_kg: string;
  volume_m3: string;
}

const REQUIREMENT_COLUMNS = ['id', 'status', 'required_vehicle_type', 'weight_kg', 'volume_m3'];

interface VehicleFit {
  type: VehicleType;
  capacity_kg: string | number;
  capacity_m3: string | number;
}

/** Motivo pelo qual o veículo não atende a carga, ou null se atende. */
export function vehicleMismatch(
  vehicle: VehicleFit,
  shipment: Pick<ShipmentRequirements, 'required_vehicle_type' | 'weight_kg' | 'volume_m3'>,
): string | null {
  if (vehicle.type !== shipment.required_vehicle_type) {
    return `A carga exige veículo do tipo ${shipment.required_vehicle_type}`;
  }
  if (Number(vehicle.capacity_kg) < Number(shipment.weight_kg)) {
    return 'O veículo não comporta o peso da carga';
  }
  if (Number(vehicle.capacity_m3) < Number(shipment.volume_m3)) {
    return 'O veículo não comporta o volume da carga';
  }
  return null;
}

/** Filtra ofertas feitas por este ofertante. */
export function whereOfferer(qb: Knex.QueryBuilder, party: Party, table: string) {
  return party.type === 'carrier'
    ? qb.where(`${table}.carrier_id`, party.carrierId)
    : qb.whereNull(`${table}.carrier_id`).where(`${table}.driver_id`, party.driverId);
}

export async function getOffer(db: Knex, offerId: string): Promise<ShipmentOfferDto> {
  const row = (await offersQuery(db).where('o.id', offerId).first()) as OfferRow | undefined;
  if (!row) throw AppError.notFound('Oferta não encontrada');
  return toOfferDto(row);
}

/** Motorista e veículo da frota, disponíveis e compatíveis com a carga. */
async function assertCarrierResources(
  trx: Knex.Transaction,
  carrierId: string,
  shipment: ShipmentRequirements,
  { driverId, vehicleId }: OfferAssignmentInput,
): Promise<void> {
  const driver = await trx('drivers')
    .where({ id: driverId, carrier_id: carrierId })
    .first('status');
  if (!driver) throw AppError.notFound('Motorista não encontrado na frota da transportadora');
  if (driver.status !== DriverStatus.DISPONIVEL) {
    throw AppError.conflict(`Motorista não está DISPONIVEL (${driver.status})`);
  }

  const vehicle = await trx('vehicles')
    .where({ id: vehicleId, carrier_id: carrierId })
    .first('type', 'capacity_kg', 'capacity_m3', 'status');
  if (!vehicle) throw AppError.notFound('Veículo não encontrado na frota da transportadora');
  if (vehicle.status !== VehicleStatus.DISPONIVEL) {
    throw AppError.conflict(`Veículo não está DISPONIVEL (${vehicle.status})`);
  }

  const mismatch = vehicleMismatch(vehicle, shipment);
  if (mismatch) throw AppError.badRequest(mismatch);
}

// ---------------------------------------------------------------------------
// Cargas disponíveis (matching)
// ---------------------------------------------------------------------------

type AvailableShipmentRow = ShipmentRow & { distance_km: number };

function toAvailableShipmentDto(row: AvailableShipmentRow): AvailableShipmentDto {
  // A empresa não é exposta para quem ainda está só avaliando a carga
  const shipment: Partial<ShipmentDto> = toShipmentDto(row);
  delete shipment.shipperId;
  return {
    ...(shipment as Omit<ShipmentDto, 'shipperId'>),
    distanceKm: Math.round(Number(row.distance_km) * 10) / 10,
  };
}

/**
 * Cargas ABERTAS com coleta ainda possível, dentro do raio, que algum veículo do ofertante
 * comporta, e em que ele não teve oferta recusada (docs/02-modelo-de-dados.md — Matching).
 */
export async function listAvailableShipments(
  db: Knex,
  party: Party,
  query: AvailableShipmentsQuery,
): Promise<PaginatedResponse<AvailableShipmentDto>> {
  await assertPartyExists(db, party);

  // Centro da busca: ponto informado ou endereço-base do ofertante
  const center =
    query.lat !== undefined && query.lng !== undefined
      ? toGeography(db, { lat: query.lat, lng: query.lng })
      : party.type === 'carrier'
        ? db.raw('(SELECT base_geo FROM companies WHERE id = ?)', [party.carrierId])
        : db.raw('(SELECT base_geo FROM drivers WHERE id = ?)', [party.driverId]);

  const ownVehicles = db('vehicles')
    .select(db.raw('1'))
    .modify((qb) =>
      party.type === 'carrier'
        ? qb.where('vehicles.carrier_id', party.carrierId)
        : qb.where('vehicles.owner_driver_id', party.driverId),
    )
    .whereRaw('vehicles.type = shipments.required_vehicle_type')
    .whereRaw('vehicles.capacity_kg >= shipments.weight_kg')
    .whereRaw('vehicles.capacity_m3 >= shipments.volume_m3');

  const rejectedOffers = db('shipment_offers')
    .select(db.raw('1'))
    .whereRaw('shipment_offers.shipment_id = shipments.id')
    .where('shipment_offers.status', OfferStatus.RECUSADA)
    .modify((qb) => whereOfferer(qb, party, 'shipment_offers'));

  const base = db('shipments')
    .where('shipments.status', ShipmentStatus.ABERTA)
    .where('shipments.pickup_window_end', '>', db.fn.now())
    .whereRaw('ST_DWithin(shipments.origin_geo, ?, ?)', [center, query.radiusKm * 1000])
    .whereExists(ownVehicles)
    .whereNotExists(rejectedOffers);

  const [rows, countRow] = await Promise.all([
    base
      .clone()
      .select([
        ...shipmentColumns(db),
        db.raw('ST_Distance(shipments.origin_geo, ?) / 1000 AS distance_km', [center]),
      ])
      .orderBy('distance_km')
      .limit(query.limit)
      .offset(query.offset),
    base.clone().count<{ count: string }>({ count: '*' }).first(),
  ]);

  return {
    items: (rows as AvailableShipmentRow[]).map(toAvailableShipmentDto),
    total: Number(countRow?.count ?? 0),
    limit: query.limit,
    offset: query.offset,
  };
}

// ---------------------------------------------------------------------------
// Ofertas
// ---------------------------------------------------------------------------

export interface CreateOfferInput {
  priceProposed: number;
  driverId?: string;
  vehicleId?: string;
}

/**
 * Aceite do preço (price = sugerido) ou contraproposta. Nasce PENDENTE: nem o aceite do
 * preço fecha o negócio, a empresa sempre revisa (modelo de revisão, não corrida).
 */
export function createOffer(
  db: Knex,
  party: Party,
  shipmentId: string,
  input: CreateOfferInput,
): Promise<ShipmentOfferDto> {
  return db.transaction(async (trx) => {
    await assertPartyExists(trx, party);

    // FOR SHARE: a carga não pode ser aceita/cancelada enquanto esta oferta entra
    const shipment = (await trx('shipments')
      .where({ id: shipmentId })
      .forShare()
      .first(REQUIREMENT_COLUMNS)) as ShipmentRequirements | undefined;
    if (!shipment) throw AppError.notFound('Carga não encontrada');
    if (shipment.status !== ShipmentStatus.ABERTA) {
      throw AppError.conflict('A carga não está aberta para ofertas');
    }

    const rejected = await trx('shipment_offers')
      .where({ shipment_id: shipmentId, status: OfferStatus.RECUSADA })
      .modify((qb) => whereOfferer(qb, party, 'shipment_offers'))
      .first('id');
    if (rejected) {
      throw AppError.conflict(
        'Sua oferta para esta carga foi recusada; não é possível ofertar de novo nela',
      );
    }

    let driverId: string | null;
    let vehicleId: string | null;
    if (party.type === 'carrier') {
      if (input.driverId && input.vehicleId) {
        await assertCarrierResources(trx, party.carrierId, shipment, {
          driverId: input.driverId,
          vehicleId: input.vehicleId,
        });
      }
      driverId = input.driverId ?? null;
      vehicleId = input.vehicleId ?? null;
    } else {
      const vehicle = await trx('vehicles')
        .where({ id: input.vehicleId, owner_driver_id: party.driverId })
        .first('type', 'capacity_kg', 'capacity_m3');
      if (!vehicle) throw AppError.notFound('Veículo não encontrado entre os do motorista');
      const mismatch = vehicleMismatch(vehicle, shipment);
      if (mismatch) throw AppError.badRequest(mismatch);
      driverId = party.driverId;
      vehicleId = input.vehicleId ?? null;
    }

    try {
      const [created] = await trx('shipment_offers')
        .insert({
          shipment_id: shipmentId,
          carrier_id: party.type === 'carrier' ? party.carrierId : null,
          driver_id: driverId,
          vehicle_id: vehicleId,
          price_proposed: input.priceProposed,
        })
        .returning<{ id: string }[]>('id');
      return getOffer(trx, (created as { id: string }).id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppError.conflict(
          'Você já tem uma oferta pendente nesta carga; retire-a antes de enviar outra',
        );
      }
      throw error;
    }
  });
}

export async function listPartyOffers(
  db: Knex,
  party: Party,
  query: ListOffersQuery,
): Promise<PaginatedResponse<ShipmentOfferDto>> {
  await assertPartyExists(db, party);
  const filter = (qb: Knex.QueryBuilder) => {
    whereOfferer(qb, party, 'o');
    if (query.status) qb.where('o.status', query.status);
  };

  const [rows, countRow] = await Promise.all([
    offersQuery(db)
      .modify(filter)
      .orderBy('o.created_at', 'desc')
      .limit(query.limit)
      .offset(query.offset),
    db('shipment_offers as o').modify(filter).count<{ count: string }>({ count: '*' }).first(),
  ]);

  return {
    items: rows.map(toOfferDto),
    total: Number(countRow?.count ?? 0),
    limit: query.limit,
    offset: query.offset,
  };
}

/** O próprio ofertante desiste enquanto a oferta está PENDENTE. */
export async function withdrawOffer(
  db: Knex,
  party: Party,
  offerId: string,
): Promise<ShipmentOfferDto> {
  const updated = await db('shipment_offers')
    .where({ id: offerId, status: OfferStatus.PENDENTE })
    .modify((qb) => whereOfferer(qb, party, 'shipment_offers'))
    .update({ status: OfferStatus.RETIRADA, updated_at: db.fn.now() })
    .returning('id');

  if (updated.length === 0) {
    const exists = await db('shipment_offers')
      .where({ id: offerId })
      .modify((qb) => whereOfferer(qb, party, 'shipment_offers'))
      .first('id');
    if (!exists) throw AppError.notFound('Oferta não encontrada');
    throw AppError.conflict('Só é possível retirar uma oferta PENDENTE');
  }
  return getOffer(db, offerId);
}

/**
 * Transportadora define motorista e veículo da oferta — antes do aceite ou depois dele,
 * enquanto a entrega ainda não foi coletada.
 */
export function assignOffer(
  db: Knex,
  carrierId: string,
  offerId: string,
  input: OfferAssignmentInput,
): Promise<ShipmentOfferDto> {
  return db.transaction(async (trx) => {
    const offer = await trx('shipment_offers')
      .where({ id: offerId, carrier_id: carrierId })
      .forUpdate()
      .first('shipment_id', 'status');
    if (!offer) throw AppError.notFound('Oferta não encontrada');

    if (offer.status === OfferStatus.ACEITA) {
      const delivery = await trx('deliveries').where({ offer_id: offerId }).first('status');
      if (delivery?.status !== DeliveryStatus.COLETA_PENDENTE) {
        throw AppError.conflict('Não é possível trocar motorista/veículo depois da coleta');
      }
    } else if (offer.status !== OfferStatus.PENDENTE) {
      throw AppError.conflict('Só é possível atribuir em oferta PENDENTE ou ACEITA');
    }

    const shipment = (await trx('shipments')
      .where({ id: offer.shipment_id })
      .first(REQUIREMENT_COLUMNS)) as ShipmentRequirements;
    await assertCarrierResources(trx, carrierId, shipment, input);

    await trx('shipment_offers')
      .where({ id: offerId })
      .update({ driver_id: input.driverId, vehicle_id: input.vehicleId, updated_at: trx.fn.now() });
    return getOffer(trx, offerId);
  });
}
