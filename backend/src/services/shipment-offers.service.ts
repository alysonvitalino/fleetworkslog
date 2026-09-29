// Lado da empresa no marketplace: revisar, aceitar e recusar ofertas de uma carga.
// Regras em docs/08-precificacao.md.
import type { Knex } from 'knex';
import {
  DeliveryStatus,
  OfferStatus,
  ShipmentStatus,
  type DeliveryDetailDto,
  type PaginatedResponse,
  type ShipmentOfferDto,
} from '@fleetworkslog/shared';
import { AppError } from '../errors/app-error.js';
import { offersQuery, toOfferDto } from '../models/offer.model.js';
import type { ListOffersQuery } from '../schemas/marketplace.schema.js';
import { getDeliveryDetail, recordDeliveryEvent } from './delivery.service.js';
import { getOffer } from './marketplace.service.js';

async function assertOwnedShipment(db: Knex, shipperId: string, shipmentId: string) {
  const shipment = await db('shipments')
    .where({ id: shipmentId, shipper_id: shipperId })
    .first('id');
  if (!shipment) throw AppError.notFound('Carga não encontrada');
}

export async function listShipmentOffers(
  db: Knex,
  shipperId: string,
  shipmentId: string,
  query: ListOffersQuery,
): Promise<PaginatedResponse<ShipmentOfferDto>> {
  await assertOwnedShipment(db, shipperId, shipmentId);
  const filter = (qb: Knex.QueryBuilder) => {
    qb.where('o.shipment_id', shipmentId);
    if (query.status) qb.where('o.status', query.status);
  };

  const [rows, countRow] = await Promise.all([
    offersQuery(db).modify(filter).orderBy('o.created_at').limit(query.limit).offset(query.offset),
    db('shipment_offers as o').modify(filter).count<{ count: string }>({ count: '*' }).first(),
  ]);

  return {
    items: rows.map(toOfferDto),
    total: Number(countRow?.count ?? 0),
    limit: query.limit,
    offset: query.offset,
  };
}

/**
 * Aceite, numa transação só: oferta ACEITA, carga ACEITA, entrega criada em
 * COLETA_PENDENTE e as demais ofertas pendentes CANCELADAS. O lock na carga garante que
 * dois aceites simultâneos não fechem a mesma carga com duas transportadoras.
 */
export function acceptOffer(
  db: Knex,
  shipperId: string,
  shipmentId: string,
  offerId: string,
): Promise<DeliveryDetailDto> {
  return db.transaction(async (trx) => {
    const shipment = await trx('shipments')
      .where({ id: shipmentId, shipper_id: shipperId })
      .forUpdate()
      .first('status');
    if (!shipment) throw AppError.notFound('Carga não encontrada');

    const offer = await trx('shipment_offers')
      .where({ id: offerId, shipment_id: shipmentId })
      .first('status');
    if (!offer) throw AppError.notFound('Oferta não encontrada');
    if (shipment.status !== ShipmentStatus.ABERTA) {
      throw AppError.conflict('A carga não está mais aberta: outra oferta já foi aceita');
    }
    if (offer.status !== OfferStatus.PENDENTE) {
      throw AppError.conflict('Só é possível aceitar uma oferta PENDENTE');
    }

    await trx('shipment_offers')
      .where({ id: offerId })
      .update({ status: OfferStatus.ACEITA, updated_at: trx.fn.now() });
    await trx('shipment_offers')
      .where({ shipment_id: shipmentId, status: OfferStatus.PENDENTE })
      .update({ status: OfferStatus.CANCELADA, updated_at: trx.fn.now() });
    await trx('shipments')
      .where({ id: shipmentId })
      .update({ status: ShipmentStatus.ACEITA, updated_at: trx.fn.now() });

    const [delivery] = await trx('deliveries')
      .insert({ shipment_id: shipmentId, offer_id: offerId })
      .returning<{ id: string }[]>('id');
    const deliveryId = (delivery as { id: string }).id;
    await recordDeliveryEvent(trx, deliveryId, DeliveryStatus.COLETA_PENDENTE, 'Oferta aceita');
    return getDeliveryDetail(trx, deliveryId);
  });
}

/** Recusa encerra a negociação com esse ofertante nesta carga, mesmo se ela reabrir. */
export async function rejectOffer(
  db: Knex,
  shipperId: string,
  shipmentId: string,
  offerId: string,
): Promise<ShipmentOfferDto> {
  await assertOwnedShipment(db, shipperId, shipmentId);
  const updated = await db('shipment_offers')
    .where({ id: offerId, shipment_id: shipmentId, status: OfferStatus.PENDENTE })
    .update({ status: OfferStatus.RECUSADA, updated_at: db.fn.now() })
    .returning('id');

  if (updated.length === 0) {
    const exists = await db('shipment_offers')
      .where({ id: offerId, shipment_id: shipmentId })
      .first('id');
    if (!exists) throw AppError.notFound('Oferta não encontrada');
    throw AppError.conflict('Só é possível recusar uma oferta PENDENTE');
  }
  return getOffer(db, offerId);
}
