import { Router } from 'express';
import type { Knex } from 'knex';
import { shipmentController } from '../controllers/shipment.controller.js';
import { validateBody } from '../middlewares/validate.js';
import { createShipmentSchema, updateShipmentSchema } from '../schemas/shipment.schema.js';

export function createShipmentRoutes(db: Knex): Router {
  const router = Router();
  const shipments = shipmentController(db);
  const basePath = '/companies/:companyId/shipments';

  router.get(basePath, shipments.list);
  router.post(basePath, validateBody(createShipmentSchema), shipments.create);
  router.get(`${basePath}/:shipmentId`, shipments.get);
  router.patch(`${basePath}/:shipmentId`, validateBody(updateShipmentSchema), shipments.update);
  router.post(`${basePath}/:shipmentId/cancel`, shipments.cancel);

  return router;
}
