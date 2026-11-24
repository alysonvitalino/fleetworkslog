import type { Request, RequestHandler } from 'express';
import {
  listDriversQuerySchema,
  type CreateCarrierDriverInput,
  type UpdateCarrierDriverInput,
} from '../schemas/account.schema.js';
import { uuidSchema } from '../schemas/common.schema.js';
import type { DriverScope, DriverService } from '../services/driver.service.js';

const param = (req: Request, name: string) => uuidSchema.parse(req.params[name]);

/** Motoristas da frota, gerenciados pela transportadora (PUTF-31). */
export class CarrierDriverController {
  constructor(private readonly drivers: DriverService) {}

  list: RequestHandler = async (req, res) => {
    const query = listDriversQuerySchema.parse(req.query);
    res.json(await this.drivers.listCarrierDrivers(param(req, 'carrierId'), query));
  };

  get: RequestHandler = async (req, res) => {
    res.json(await this.drivers.getCarrierDriver(param(req, 'carrierId'), param(req, 'driverId')));
  };

  create: RequestHandler = async (req, res) => {
    const driver = await this.drivers.createCarrierDriver(
      param(req, 'carrierId'),
      req.body as CreateCarrierDriverInput,
    );
    res.status(201).json(driver);
  };

  update: RequestHandler = async (req, res) => {
    res.json(
      await this.drivers.updateCarrierDriver(
        param(req, 'carrierId'),
        param(req, 'driverId'),
        req.body as UpdateCarrierDriverInput,
      ),
    );
  };

  remove: RequestHandler = async (req, res) => {
    await this.drivers.deleteCarrierDriver(param(req, 'carrierId'), param(req, 'driverId'));
    res.status(204).end();
  };
}

/**
 * Alteração de status do motorista. O escopo (transportadora ou autônomo) vem do path,
 * extraído por `scopeFromParams`.
 */
export class DriverStatusController {
  constructor(
    private readonly drivers: DriverService,
    private readonly scopeFromParams: (params: Request['params']) => DriverScope,
  ) {}

  update: RequestHandler = async (req, res) => {
    res.json(
      await this.drivers.updateStatus(
        this.scopeFromParams(req.params),
        param(req, 'driverId'),
        req.body.status,
      ),
    );
  };
}
