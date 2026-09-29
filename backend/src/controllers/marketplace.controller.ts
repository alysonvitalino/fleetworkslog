import type { Request, RequestHandler } from 'express';
import type { Knex } from 'knex';
import { uuidSchema } from '../schemas/common.schema.js';
import {
  availableShipmentsQuerySchema,
  listOffersQuerySchema,
  type OfferAssignmentInput,
} from '../schemas/marketplace.schema.js';
import {
  assignOffer,
  createOffer,
  listAvailableShipments,
  listPartyOffers,
  withdrawOffer,
  type CreateOfferInput,
} from '../services/marketplace.service.js';
import type { Party } from '../services/owners.service.js';
import {
  acceptOffer,
  listShipmentOffers,
  rejectOffer,
} from '../services/shipment-offers.service.js';

export type PartyFromParams = (params: Request['params']) => Party;

const param = (req: Request, name: string) => uuidSchema.parse(req.params[name]);

/** Rotas de quem oferta: iguais para transportadora e motorista autônomo. */
export function offererController(db: Knex, partyFromParams: PartyFromParams) {
  const availableShipments: RequestHandler = async (req, res) => {
    const query = availableShipmentsQuerySchema.parse(req.query);
    res.json(await listAvailableShipments(db, partyFromParams(req.params), query));
  };

  const create: RequestHandler = async (req, res) => {
    const offer = await createOffer(
      db,
      partyFromParams(req.params),
      param(req, 'shipmentId'),
      req.body as CreateOfferInput,
    );
    res.status(201).json(offer);
  };

  const list: RequestHandler = async (req, res) => {
    const query = listOffersQuerySchema.parse(req.query);
    res.json(await listPartyOffers(db, partyFromParams(req.params), query));
  };

  const withdraw: RequestHandler = async (req, res) => {
    res.json(await withdrawOffer(db, partyFromParams(req.params), param(req, 'offerId')));
  };

  return { availableShipments, create, list, withdraw };
}

export function assignOfferController(db: Knex): RequestHandler {
  return async (req, res) => {
    res.json(
      await assignOffer(
        db,
        param(req, 'carrierId'),
        param(req, 'offerId'),
        req.body as OfferAssignmentInput,
      ),
    );
  };
}

/** Rotas da empresa sobre as ofertas recebidas numa carga. */
export function shipmentOffersController(db: Knex) {
  const list: RequestHandler = async (req, res) => {
    const query = listOffersQuerySchema.parse(req.query);
    res.json(
      await listShipmentOffers(db, param(req, 'companyId'), param(req, 'shipmentId'), query),
    );
  };

  const accept: RequestHandler = async (req, res) => {
    const delivery = await acceptOffer(
      db,
      param(req, 'companyId'),
      param(req, 'shipmentId'),
      param(req, 'offerId'),
    );
    res.status(201).json(delivery);
  };

  const reject: RequestHandler = async (req, res) => {
    res.json(
      await rejectOffer(
        db,
        param(req, 'companyId'),
        param(req, 'shipmentId'),
        param(req, 'offerId'),
      ),
    );
  };

  return { list, accept, reject };
}
