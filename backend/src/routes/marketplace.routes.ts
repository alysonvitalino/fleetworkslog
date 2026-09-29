import { Router, type RequestHandler } from 'express';
import type { Knex } from 'knex';
import {
  assignOfferController,
  offererController,
  shipmentOffersController,
  type PartyFromParams,
} from '../controllers/marketplace.controller.js';
import { validateBody } from '../middlewares/validate.js';
import { uuidSchema } from '../schemas/common.schema.js';
import {
  createAutonomousOfferSchema,
  createCarrierOfferSchema,
  offerAssignmentSchema,
} from '../schemas/marketplace.schema.js';

export function createMarketplaceRoutes(db: Knex): Router {
  const router = Router();

  // Quem oferta: transportadora (painel web) e motorista autônomo (app) têm as mesmas rotas,
  // só muda o corpo da oferta (o autônomo sempre informa o veículo próprio)
  const mountOfferer = (
    basePath: string,
    partyFromParams: PartyFromParams,
    validateOffer: RequestHandler,
  ) => {
    const offerer = offererController(db, partyFromParams);
    router.get(`${basePath}/available-shipments`, offerer.availableShipments);
    router.post(`${basePath}/shipments/:shipmentId/offers`, validateOffer, offerer.create);
    router.get(`${basePath}/offers`, offerer.list);
    router.post(`${basePath}/offers/:offerId/withdraw`, offerer.withdraw);
  };

  mountOfferer(
    '/carriers/:carrierId',
    (params) => ({ type: 'carrier', carrierId: uuidSchema.parse(params.carrierId) }),
    validateBody(createCarrierOfferSchema),
  );
  mountOfferer(
    '/drivers/:driverId',
    (params) => ({ type: 'autonomous', driverId: uuidSchema.parse(params.driverId) }),
    validateBody(createAutonomousOfferSchema),
  );

  router.put(
    '/carriers/:carrierId/offers/:offerId/assignment',
    validateBody(offerAssignmentSchema),
    assignOfferController(db),
  );

  // Empresa revisando as ofertas recebidas numa carga
  const shipmentOffers = shipmentOffersController(db);
  const offersPath = '/companies/:companyId/shipments/:shipmentId/offers';
  router.get(offersPath, shipmentOffers.list);
  router.post(`${offersPath}/:offerId/accept`, shipmentOffers.accept);
  router.post(`${offersPath}/:offerId/reject`, shipmentOffers.reject);

  return router;
}
