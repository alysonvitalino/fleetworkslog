import type { Request, RequestHandler } from 'express';
import type { Knex } from 'knex';
import { uuidSchema } from '../schemas/common.schema.js';
import {
  cancelDeliverySchema,
  type UpdateDeliveryStatusInput,
} from '../schemas/delivery.schema.js';
import {
  advanceDeliveryStatus,
  cancelDelivery,
  getShipperDelivery,
  listDriverDeliveries,
} from '../services/delivery.service.js';

const param = (req: Request, name: string) => uuidSchema.parse(req.params[name]);

export function deliveryController(db: Knex) {
  const getForShipper: RequestHandler = async (req, res) => {
    res.json(await getShipperDelivery(db, param(req, 'companyId'), param(req, 'deliveryId')));
  };

  const cancel: RequestHandler = async (req, res) => {
    // Corpo opcional: POST sem body chega como undefined
    const { note } = cancelDeliverySchema.parse(req.body ?? {});
    res.json(
      await cancelDelivery(db, param(req, 'companyId'), param(req, 'deliveryId'), note ?? null),
    );
  };

  const listForDriver: RequestHandler = async (req, res) => {
    res.json({ items: await listDriverDeliveries(db, param(req, 'driverId')) });
  };

  const advanceStatus: RequestHandler = async (req, res) => {
    res.json(
      await advanceDeliveryStatus(
        db,
        param(req, 'driverId'),
        param(req, 'deliveryId'),
        req.body as UpdateDeliveryStatusInput,
      ),
    );
  };

  return { getForShipper, cancel, listForDriver, advanceStatus };
}
