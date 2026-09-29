import type { Request, RequestHandler } from 'express';
import type { Knex } from 'knex';
import { uuidSchema } from '../schemas/common.schema.js';
import {
  listShipmentsQuerySchema,
  type CreateShipmentInput,
  type UpdateShipmentInput,
} from '../schemas/shipment.schema.js';
import {
  cancelShipment,
  createShipment,
  getShipment,
  listShipments,
  updateShipment,
} from '../services/shipment.service.js';

const shipperId = (req: Request) => uuidSchema.parse(req.params.companyId);
const shipmentId = (req: Request) => uuidSchema.parse(req.params.shipmentId);

export function shipmentController(db: Knex) {
  const list: RequestHandler = async (req, res) => {
    const query = listShipmentsQuerySchema.parse(req.query);
    res.json(await listShipments(db, shipperId(req), query));
  };

  const get: RequestHandler = async (req, res) => {
    res.json(await getShipment(db, shipperId(req), shipmentId(req)));
  };

  const create: RequestHandler = async (req, res) => {
    const shipment = await createShipment(db, shipperId(req), req.body as CreateShipmentInput);
    res.status(201).json(shipment);
  };

  const update: RequestHandler = async (req, res) => {
    res.json(
      await updateShipment(db, shipperId(req), shipmentId(req), req.body as UpdateShipmentInput),
    );
  };

  const cancel: RequestHandler = async (req, res) => {
    res.json(await cancelShipment(db, shipperId(req), shipmentId(req)));
  };

  return { list, get, create, update, cancel };
}
