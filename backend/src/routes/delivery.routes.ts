import { Router } from 'express';
import type { Knex } from 'knex';
import { deliveryController } from '../controllers/delivery.controller.js';
import { validateBody } from '../middlewares/validate.js';
import { updateDeliveryStatusSchema } from '../schemas/delivery.schema.js';

export function createDeliveryRoutes(db: Knex): Router {
  const router = Router();
  const deliveries = deliveryController(db);

  // Empresa acompanha e pode cancelar a entrega da sua carga
  router.get('/companies/:companyId/deliveries/:deliveryId', deliveries.getForShipper);
  router.post('/companies/:companyId/deliveries/:deliveryId/cancel', deliveries.cancel);

  // Motorista (de transportadora ou autônomo) vê e avança as entregas atribuídas a ele
  router.get('/drivers/:driverId/deliveries', deliveries.listForDriver);
  router.post(
    '/drivers/:driverId/deliveries/:deliveryId/status',
    validateBody(updateDeliveryStatusSchema),
    deliveries.advanceStatus,
  );

  return router;
}
