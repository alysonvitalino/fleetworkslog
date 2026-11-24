import { Router } from 'express';
import { DriverStatusController } from '../controllers/driver.controller.js';
import { VehicleController, type OwnerFromParams } from '../controllers/vehicle.controller.js';
import { validateBody } from '../middlewares/validate.js';
import { uuidSchema } from '../schemas/common.schema.js';
import {
  createVehicleSchema,
  replaceVehicleSchema,
  updateDriverStatusSchema,
  updateVehicleSchema,
  updateVehicleStatusSchema,
} from '../schemas/vehicle.schema.js';
import type { Services } from '../container.js';

// Veículos existem em dois lugares com as mesmas regras: frota da transportadora
// (painel web) e veículo próprio do motorista autônomo (app)
export function createFleetRoutes(services: Pick<Services, 'vehicles' | 'drivers'>): Router {
  const router = Router();

  const mountVehicles = (basePath: string, ownerFromParams: OwnerFromParams) => {
    const vehicles = new VehicleController(services.vehicles, ownerFromParams);
    router.get(basePath, vehicles.list);
    router.post(basePath, validateBody(createVehicleSchema), vehicles.create);
    router.get(`${basePath}/:vehicleId`, vehicles.get);
    // PUT substitui o veículo inteiro; PATCH altera só os campos enviados (mesmo service)
    router.put(`${basePath}/:vehicleId`, validateBody(replaceVehicleSchema), vehicles.update);
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
    new DriverStatusController(services.drivers, (params) => ({
      type: 'carrier',
      carrierId: uuidSchema.parse(params.carrierId),
    })).update,
  );
  router.patch(
    '/drivers/:driverId/status',
    validateBody(updateDriverStatusSchema),
    new DriverStatusController(services.drivers, () => ({ type: 'autonomous' })).update,
  );

  return router;
}
