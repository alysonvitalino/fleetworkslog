import { Router } from 'express';
import { ShipmentController } from '../controllers/shipment.controller.js';
import { validateBody } from '../middlewares/validate.js';
import {
  createShipmentSchema,
  replaceShipmentSchema,
  updateShipmentSchema,
} from '../schemas/shipment.schema.js';
import type { ShipmentService } from '../services/shipment.service.js';

export function createShipmentRoutes(shipmentService: ShipmentService): Router {
  const router = Router();
  const shipments = new ShipmentController(shipmentService);
  const basePath = '/companies/:companyId/shipments';

  router.get(basePath, shipments.list);
  router.post(basePath, validateBody(createShipmentSchema), shipments.create);
  router.get(`${basePath}/:shipmentId`, shipments.get);
  // PUT substitui a carga inteira; PATCH altera só os campos enviados (mesmo service)
  router.put(`${basePath}/:shipmentId`, validateBody(replaceShipmentSchema), shipments.update);
  router.patch(`${basePath}/:shipmentId`, validateBody(updateShipmentSchema), shipments.update);
  router.delete(`${basePath}/:shipmentId`, shipments.remove);
  router.post(`${basePath}/:shipmentId/cancel`, shipments.cancel);

  return router;
}
