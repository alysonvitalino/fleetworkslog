import type { Request, RequestHandler } from 'express';
import type { Knex } from 'knex';
import {
  type SignupAutonomousDriverInput,
  type SignupCarrierInput,
  type SignupShipperInput,
  type UpdateAutonomousDriverInput,
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
import type { DriverService } from '../services/driver.service.js';

const param = (req: Request, name: string) => uuidSchema.parse(req.params[name]);

export function accountController(db: Knex, drivers: DriverService) {
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
    res.json(await drivers.getDriver(param(req, 'driverId')));
  };

  const updateAutonomousDriverHandler: RequestHandler = async (req, res) => {
    res.json(
      await drivers.updateAutonomousDriver(
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
