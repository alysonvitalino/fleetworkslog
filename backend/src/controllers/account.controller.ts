import type { Request, RequestHandler } from 'express';
import type { Knex } from 'knex';
import {
  listDriversQuerySchema,
  type CreateCarrierDriverInput,
  type SignupAutonomousDriverInput,
  type SignupCarrierInput,
  type SignupShipperInput,
  type UpdateAutonomousDriverInput,
  type UpdateCarrierDriverInput,
  type UpdateCompanyInput,
} from '../schemas/account.schema.js';
import { uuidSchema } from '../schemas/common.schema.js';
import {
  getCompany,
  signupAutonomousDriver,
  signupCarrier,
  signupShipper,
  updateCompany,
} from '../services/account.service.js';
import {
  createCarrierDriver,
  deleteCarrierDriver,
  getCarrierDriver,
  getDriver,
  listCarrierDrivers,
  updateAutonomousDriver,
  updateCarrierDriver,
} from '../services/driver.service.js';

const param = (req: Request, name: string) => uuidSchema.parse(req.params[name]);

export function accountController(db: Knex) {
  const signupShipperHandler: RequestHandler = async (req, res) => {
    res.status(201).json(await signupShipper(db, req.body as SignupShipperInput));
  };

  const signupCarrierHandler: RequestHandler = async (req, res) => {
    res.status(201).json(await signupCarrier(db, req.body as SignupCarrierInput));
  };

  const signupDriverHandler: RequestHandler = async (req, res) => {
    res.status(201).json(await signupAutonomousDriver(db, req.body as SignupAutonomousDriverInput));
  };

  const getCompanyHandler: RequestHandler = async (req, res) => {
    res.json(await getCompany(db, param(req, 'companyId')));
  };

  const updateCompanyHandler: RequestHandler = async (req, res) => {
    res.json(await updateCompany(db, param(req, 'companyId'), req.body as UpdateCompanyInput));
  };

  const getDriverHandler: RequestHandler = async (req, res) => {
    res.json(await getDriver(db, param(req, 'driverId')));
  };

  const updateAutonomousDriverHandler: RequestHandler = async (req, res) => {
    res.json(
      await updateAutonomousDriver(
        db,
        param(req, 'driverId'),
        req.body as UpdateAutonomousDriverInput,
      ),
    );
  };

  return {
    signupShipper: signupShipperHandler,
    signupCarrier: signupCarrierHandler,
    signupDriver: signupDriverHandler,
    getCompany: getCompanyHandler,
    updateCompany: updateCompanyHandler,
    getDriver: getDriverHandler,
    updateAutonomousDriver: updateAutonomousDriverHandler,
  };
}

/** Motoristas da frota, gerenciados pela transportadora (PUTF-31). */
export function carrierDriversController(db: Knex) {
  const list: RequestHandler = async (req, res) => {
    const query = listDriversQuerySchema.parse(req.query);
    res.json(await listCarrierDrivers(db, param(req, 'carrierId'), query));
  };

  const get: RequestHandler = async (req, res) => {
    res.json(await getCarrierDriver(db, param(req, 'carrierId'), param(req, 'driverId')));
  };

  const create: RequestHandler = async (req, res) => {
    const driver = await createCarrierDriver(
      db,
      param(req, 'carrierId'),
      req.body as CreateCarrierDriverInput,
    );
    res.status(201).json(driver);
  };

  const update: RequestHandler = async (req, res) => {
    res.json(
      await updateCarrierDriver(
        db,
        param(req, 'carrierId'),
        param(req, 'driverId'),
        req.body as UpdateCarrierDriverInput,
      ),
    );
  };

  const remove: RequestHandler = async (req, res) => {
    await deleteCarrierDriver(db, param(req, 'carrierId'), param(req, 'driverId'));
    res.status(204).end();
  };

  return { list, get, create, update, remove };
}
