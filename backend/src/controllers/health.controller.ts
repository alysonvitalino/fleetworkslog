import type { RequestHandler } from 'express';
import { getHealth, type HealthChecks } from '../services/health.service.js';

export function healthController(checks: HealthChecks): RequestHandler {
  return async (_req, res) => {
    const health = await getHealth(checks);
    // 503 permite que load balancer / uptime monitor tirem a instância de rotação
    res.status(health.status === 'ok' ? 200 : 503).json(health);
  };
}
