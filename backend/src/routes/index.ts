import { Router } from 'express';
import type { Knex } from 'knex';
import { createServices } from '../container.js';
import { healthController } from '../controllers/health.controller.js';
import type { HealthChecks } from '../services/health.service.js';
import { createAccountRoutes } from './account.routes.js';
import { createDeliveryRoutes } from './delivery.routes.js';
import { createFleetRoutes } from './fleet.routes.js';
import { createMarketplaceRoutes } from './marketplace.routes.js';
import { createShipmentRoutes } from './shipment.routes.js';

export interface RouteDeps {
  healthChecks: HealthChecks;
  db: Knex;
}

export function createRoutes(deps: RouteDeps): Router {
  const router = Router();
  router.get('/health', healthController(deps.healthChecks));

  // As rotas de domínio recebem o dono do recurso no path (/carriers/:carrierId/...,
  // /companies/:companyId/...). O middleware de autorização por role precisa garantir que
  // o usuário logado é esse dono antes de estas rotas irem para staging.
  const services = createServices(deps.db);
  router.use(createAccountRoutes(deps.db, services.drivers));
  router.use(createFleetRoutes(services));
  router.use(createShipmentRoutes(services.shipments));
  router.use(createMarketplaceRoutes(deps.db));
  router.use(createDeliveryRoutes(deps.db));
  return router;
}
