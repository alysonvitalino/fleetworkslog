import { Router } from 'express';
import type { Knex } from 'knex';
import { accountController } from '../controllers/account.controller.js';
import { CarrierDriverController } from '../controllers/driver.controller.js';
import { validateBody } from '../middlewares/validate.js';
import {
  createCarrierDriverSchema,
  replaceCarrierDriverSchema,
  signupAutonomousDriverSchema,
  signupCarrierSchema,
  signupShipperSchema,
  updateAutonomousDriverSchema,
  updateCarrierDriverSchema,
  updateCompanySchema,
} from '../schemas/account.schema.js';
import type { DriverService } from '../services/driver.service.js';

export function createAccountRoutes(db: Knex, driverService: DriverService): Router {
  const router = Router();
  const accounts = accountController(db, driverService);

  // Cadastro público: empresa e motorista autônomo pelo app, transportadora pelo web
  router.post('/signup/empresa', validateBody(signupShipperSchema), accounts.signupShipper);
  router.post('/signup/transportadora', validateBody(signupCarrierSchema), accounts.signupCarrier);
  router.post(
    '/signup/motorista',
    validateBody(signupAutonomousDriverSchema),
    accounts.signupDriver,
  );

  router.get('/companies/:companyId', accounts.getCompany);
  router.patch('/companies/:companyId', validateBody(updateCompanySchema), accounts.updateCompany);

  router.get('/drivers/:driverId', accounts.getDriver);
  router.patch(
    '/drivers/:driverId',
    validateBody(updateAutonomousDriverSchema),
    accounts.updateAutonomousDriver,
  );

  const carrierDrivers = new CarrierDriverController(driverService);
  const basePath = '/carriers/:carrierId/drivers';
  router.get(basePath, carrierDrivers.list);
  router.post(basePath, validateBody(createCarrierDriverSchema), carrierDrivers.create);
  router.get(`${basePath}/:driverId`, carrierDrivers.get);
  // PUT substitui o perfil inteiro; PATCH altera só os campos enviados (mesmo service)
  router.put(
    `${basePath}/:driverId`,
    validateBody(replaceCarrierDriverSchema),
    carrierDrivers.update,
  );
  router.patch(
    `${basePath}/:driverId`,
    validateBody(updateCarrierDriverSchema),
    carrierDrivers.update,
  );
  router.delete(`${basePath}/:driverId`, carrierDrivers.remove);

  return router;
}
