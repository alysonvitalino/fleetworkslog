import { Router } from 'express';
import type { Knex } from 'knex';
import { accountController, carrierDriversController } from '../controllers/account.controller.js';
import { validateBody } from '../middlewares/validate.js';
import {
  createCarrierDriverSchema,
  signupAutonomousDriverSchema,
  signupCarrierSchema,
  signupShipperSchema,
  updateAutonomousDriverSchema,
  updateCarrierDriverSchema,
  updateCompanySchema,
} from '../schemas/account.schema.js';

export function createAccountRoutes(db: Knex): Router {
  const router = Router();
  const accounts = accountController(db);

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

  const carrierDrivers = carrierDriversController(db);
  const basePath = '/carriers/:carrierId/drivers';
  router.get(basePath, carrierDrivers.list);
  router.post(basePath, validateBody(createCarrierDriverSchema), carrierDrivers.create);
  router.get(`${basePath}/:driverId`, carrierDrivers.get);
  router.patch(
    `${basePath}/:driverId`,
    validateBody(updateCarrierDriverSchema),
    carrierDrivers.update,
  );
  router.delete(`${basePath}/:driverId`, carrierDrivers.remove);

  return router;
}
