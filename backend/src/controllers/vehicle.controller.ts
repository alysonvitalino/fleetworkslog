import type { Request, RequestHandler } from 'express';
import type { Knex } from 'knex';
import { uuidSchema } from '../schemas/common.schema.js';
import {
  listVehiclesQuerySchema,
  type CreateVehicleInput,
  type UpdateVehicleInput,
} from '../schemas/vehicle.schema.js';
import {
  createVehicle,
  deleteVehicle,
  getVehicle,
  listVehicles,
  updateVehicle,
  updateVehicleStatus,
  type VehicleOwner,
} from '../services/vehicle.service.js';

export type OwnerFromParams = (params: Request['params']) => VehicleOwner;

export function vehicleController(db: Knex, ownerFromParams: OwnerFromParams) {
  const list: RequestHandler = async (req, res) => {
    const query = listVehiclesQuerySchema.parse(req.query);
    res.json(await listVehicles(db, ownerFromParams(req.params), query));
  };

  const get: RequestHandler = async (req, res) => {
    const vehicleId = uuidSchema.parse(req.params.vehicleId);
    res.json(await getVehicle(db, ownerFromParams(req.params), vehicleId));
  };

  const create: RequestHandler = async (req, res) => {
    const vehicle = await createVehicle(
      db,
      ownerFromParams(req.params),
      req.body as CreateVehicleInput,
    );
    res.status(201).json(vehicle);
  };

  const update: RequestHandler = async (req, res) => {
    const vehicleId = uuidSchema.parse(req.params.vehicleId);
    res.json(
      await updateVehicle(
        db,
        ownerFromParams(req.params),
        vehicleId,
        req.body as UpdateVehicleInput,
      ),
    );
  };

  const updateStatus: RequestHandler = async (req, res) => {
    const vehicleId = uuidSchema.parse(req.params.vehicleId);
    res.json(
      await updateVehicleStatus(db, ownerFromParams(req.params), vehicleId, req.body.status),
    );
  };

  const remove: RequestHandler = async (req, res) => {
    const vehicleId = uuidSchema.parse(req.params.vehicleId);
    await deleteVehicle(db, ownerFromParams(req.params), vehicleId);
    res.status(204).end();
  };

  return { list, get, create, update, updateStatus, remove };
}
