import { Router } from 'express';
import { healthController } from '../controllers/health.controller.js';
import type { HealthChecks } from '../services/health.service.js';

export interface RouteDeps {
  healthChecks: HealthChecks;
}

export function createRoutes(deps: RouteDeps): Router {
  const router = Router();
  router.get('/health', healthController(deps.healthChecks));
  return router;
}
