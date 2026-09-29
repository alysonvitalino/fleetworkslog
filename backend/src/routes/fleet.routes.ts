import { Router } from 'express';
import type { Knex } from 'knex';
import { updateDriverStatusController } from '../controllers/driver.controller.js';
import { vehicleController, type OwnerFromParams } from '../controllers/vehicle.controller.js';
import { validateBody } from '../middlewares/validate.js';
import { uuidSchema } from '../schemas/common.schema.js';
import {
  createVehicleSchema,
  updateDriverStatusSchema,
  updateVehicleSchema,
  updateVehicleStatusSchema,
} from '../schemas/vehicle.schema.js';

// Veículos existem em dois lugares com as mesmas regras: frota da transportadora
// (painel web) e veículo próprio do motorista autônomo (app)
export function createFleetRoutes(db: Knex): Router {
  const router = Router();

  const mountVehicles = (basePath: string, ownerFromParams: OwnerFromParams) => {
    const vehicles = vehicleController(db, ownerFromParams);
    router.get(basePath, vehicles.list);
    router.post(basePath, validateBody(createVehicleSchema), vehicles.create);
    router.get(`${basePath}/:vehicleId`, vehicles.get);
    router.patch(`${basePath}/:vehicleId`, validateBody(updateVehicleSchema), vehicles.update);
    router.patch(
      `${basePath}/:vehicleId/status`,
      validateBody(updateVehicleStatusSchema),
      vehicles.updateStatus,
    );
    router.delete(`${basePath}/:vehicleId`, vehicles.remove);
  };

  mountVehicles('/carriers/:carrierId/vehicles', (params) => ({
    type: 'carrier',
    carrierId: uuidSchema.parse(params.carrierId),
  }));
  mountVehicles('/drivers/:driverId/vehicles', (params) => ({
    type: 'autonomous',
    driverId: uuidSchema.parse(params.driverId),
  }));

  router.patch(
    '/carriers/:carrierId/drivers/:driverId/status',
    validateBody(updateDriverStatusSchema),
    updateDriverStatusController(db, (params) => ({
      type: 'carrier',
      carrierId: uuidSchema.parse(params.carrierId),
    })),
  );
  router.patch(
    '/drivers/:driverId/status',
    validateBody(updateDriverStatusSchema),
    updateDriverStatusController(db, () => ({ type: 'autonomous' })),
  );

  return router;
}
