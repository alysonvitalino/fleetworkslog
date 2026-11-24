import type { Request, RequestHandler } from 'express';
import { uuidSchema } from '../schemas/common.schema.js';
import {
  listShipmentsQuerySchema,
  type CreateShipmentInput,
  type UpdateShipmentInput,
} from '../schemas/shipment.schema.js';
import type { ShipmentService } from '../services/shipment.service.js';

const shipperId = (req: Request) => uuidSchema.parse(req.params.companyId);
const shipmentId = (req: Request) => uuidSchema.parse(req.params.shipmentId);

/** Traduz HTTP ↔ service para as cargas da empresa. */
export class ShipmentController {
  constructor(private readonly shipments: ShipmentService) {}

  list: RequestHandler = async (req, res) => {
    const query = listShipmentsQuerySchema.parse(req.query);
    res.json(await this.shipments.list(shipperId(req), query));
  };

  get: RequestHandler = async (req, res) => {
    res.json(await this.shipments.get(shipperId(req), shipmentId(req)));
  };

  create: RequestHandler = async (req, res) => {
    const shipment = await this.shipments.create(shipperId(req), req.body as CreateShipmentInput);
    res.status(201).json(shipment);
  };

  update: RequestHandler = async (req, res) => {
    res.json(
      await this.shipments.update(shipperId(req), shipmentId(req), req.body as UpdateShipmentInput),
    );
  };

  cancel: RequestHandler = async (req, res) => {
    res.json(await this.shipments.cancel(shipperId(req), shipmentId(req)));
  };

  remove: RequestHandler = async (req, res) => {
    await this.shipments.delete(shipperId(req), shipmentId(req));
    res.status(204).end();
  };
}
