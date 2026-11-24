import type { Knex } from 'knex';
import { DriverRepository } from './repositories/driver.repository.js';
import { OwnerRepository } from './repositories/owner.repository.js';
import { ShipmentRepository } from './repositories/shipment.repository.js';
import { VehicleRepository } from './repositories/vehicle.repository.js';
import { DriverService } from './services/driver.service.js';
import { OwnerService } from './services/owners.service.js';
import { ShipmentService } from './services/shipment.service.js';
import { VehicleService } from './services/vehicle.service.js';

export interface Services {
  vehicles: VehicleService;
  drivers: DriverService;
  shipments: ShipmentService;
}

/**
 * Composition root: o único lugar que sabe como montar os objetos.
 * Cada service recebe seus repositories pelo construtor (injeção de dependência),
 * o que permite trocá-los por mocks nos testes unitários.
 */
export function createServices(db: Knex): Services {
  const owners = new OwnerService(new OwnerRepository(db));
  return {
    vehicles: new VehicleService(new VehicleRepository(db), owners),
    drivers: new DriverService(new DriverRepository(db), owners),
    shipments: new ShipmentService(new ShipmentRepository(db), owners),
  };
}
