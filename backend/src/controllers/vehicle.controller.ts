import type { Request, RequestHandler } from 'express';
import { uuidSchema } from '../schemas/common.schema.js';
import {
  listVehiclesQuerySchema,
  type CreateVehicleInput,
  type UpdateVehicleInput,
} from '../schemas/vehicle.schema.js';
import type { VehicleOwner, VehicleService } from '../services/vehicle.service.js';

export type OwnerFromParams = (params: Request['params']) => VehicleOwner;

/**
 * Traduz HTTP ↔ service. O dono do veículo vem do path e é extraído por `ownerFromParams`,
 * o que permite montar o mesmo controller para transportadora e para motorista autônomo.
 */
export class VehicleController {
  constructor(
    private readonly vehicles: VehicleService,
    private readonly ownerFromParams: OwnerFromParams,
  ) {}

  list: RequestHandler = async (req, res) => {
    const query = listVehiclesQuerySchema.parse(req.query);
    res.json(await this.vehicles.list(this.ownerFromParams(req.params), query));
  };

  get: RequestHandler = async (req, res) => {
    res.json(await this.vehicles.get(this.ownerFromParams(req.params), vehicleId(req)));
  };

  create: RequestHandler = async (req, res) => {
    const vehicle = await this.vehicles.create(
      this.ownerFromParams(req.params),
      req.body as CreateVehicleInput,
    );
    res.status(201).json(vehicle);
  };

  update: RequestHandler = async (req, res) => {
    res.json(
      await this.vehicles.update(
        this.ownerFromParams(req.params),
        vehicleId(req),
        req.body as UpdateVehicleInput,
      ),
    );
  };

  updateStatus: RequestHandler = async (req, res) => {
    res.json(
      await this.vehicles.updateStatus(
        this.ownerFromParams(req.params),
        vehicleId(req),
        req.body.status,
      ),
    );
  };

  remove: RequestHandler = async (req, res) => {
    await this.vehicles.delete(this.ownerFromParams(req.params), vehicleId(req));
    res.status(204).end();
  };
}

const vehicleId = (req: Request) => uuidSchema.parse(req.params.vehicleId);
