import type { Request, RequestHandler } from 'express';
import type { Knex } from 'knex';
import { uuidSchema } from '../schemas/common.schema.js';
import { updateDriverStatus, type DriverScope } from '../services/driver.service.js';

export function updateDriverStatusController(
  db: Knex,
  scopeFromParams: (params: Request['params']) => DriverScope,
): RequestHandler {
  return async (req, res) => {
    const driverId = uuidSchema.parse(req.params.driverId);
    res.json(await updateDriverStatus(db, scopeFromParams(req.params), driverId, req.body.status));
  };
}
