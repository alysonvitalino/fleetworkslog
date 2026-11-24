// Testes unitários do VehicleService: o repository e o OwnerService são mocks,
// então nenhum teste aqui toca no banco.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../errors/app-error.js';
import type { VehicleRow } from '../models/vehicle.model.js';
import type { VehicleRepository } from '../repositories/vehicle.repository.js';
import type { OwnerService } from './owners.service.js';
import { VehicleService, type VehicleOwner } from './vehicle.service.js';

const owner: VehicleOwner = { type: 'carrier', carrierId: 'carrier-1' };
const VEHICLE_ID = 'vehicle-1';

function vehicleRow(overrides: Partial<VehicleRow> = {}): VehicleRow {
  return {
    id: VEHICLE_ID,
    carrier_id: 'carrier-1',
    owner_driver_id: null,
    plate: 'ABC1D23',
    type: 'VAN',
    capacity_kg: '1500.00',
    capacity_m3: '8.500',
    status: 'DISPONIVEL',
    created_at: new Date('2026-11-01T10:00:00Z'),
    updated_at: new Date('2026-11-02T10:00:00Z'),
    ...overrides,
  };
}

const pgError = (code: string, constraint?: string) =>
  Object.assign(new Error('pg'), { code, constraint });

let repository: {
  list: ReturnType<typeof vi.fn>;
  findOwned: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  updateStatusUnlessInTrip: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};
let owners: { assertPartyExists: ReturnType<typeof vi.fn> };
let service: VehicleService;

beforeEach(() => {
  repository = {
    list: vi.fn(),
    findOwned: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatusUnlessInTrip: vi.fn(),
    delete: vi.fn(),
  };
  owners = { assertPartyExists: vi.fn().mockResolvedValue(undefined) };
  service = new VehicleService(
    repository as unknown as VehicleRepository,
    owners as unknown as OwnerService,
  );
});

describe('VehicleService.list', () => {
  it('should return the page converted to DTOs with numeric capacities', async () => {
    repository.list.mockResolvedValue({ rows: [vehicleRow()], total: 1 });

    const page = await service.list(owner, { limit: 20, offset: 0 });

    expect(owners.assertPartyExists).toHaveBeenCalledWith(owner);
    expect(page).toMatchObject({ total: 1, limit: 20, offset: 0 });
    expect(page.items[0]).toMatchObject({ id: VEHICLE_ID, capacityKg: 1500, capacityM3: 8.5 });
  });

  it('should not query vehicles when the owner does not exist', async () => {
    owners.assertPartyExists.mockRejectedValue(AppError.notFound('Transportadora não encontrada'));

    await expect(service.list(owner, { limit: 20, offset: 0 })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(repository.list).not.toHaveBeenCalled();
  });
});

describe('VehicleService.get', () => {
  it('should return 404 when the vehicle is not found for this owner', async () => {
    repository.findOwned.mockResolvedValue(undefined);

    await expect(service.get(owner, VEHICLE_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Veículo não encontrado',
    });
  });
});

describe('VehicleService.create', () => {
  const input = { plate: 'ABC1D23', type: 'VAN', capacityKg: 1500, capacityM3: 8.5 } as const;

  it('should create the vehicle for the owner', async () => {
    repository.create.mockResolvedValue(vehicleRow());

    const vehicle = await service.create(owner, input);

    expect(repository.create).toHaveBeenCalledWith(owner, input);
    expect(vehicle.status).toBe('DISPONIVEL');
  });

  it('should return 409 when the plate is already registered', async () => {
    repository.create.mockRejectedValue(pgError('23505', 'vehicles_plate_unique'));

    await expect(service.create(owner, input)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Já existe um veículo cadastrado com essa placa',
    });
  });

  it('should rethrow unexpected database errors untouched', async () => {
    const unexpected = new Error('conexão perdida');
    repository.create.mockRejectedValue(unexpected);

    await expect(service.create(owner, input)).rejects.toBe(unexpected);
  });
});

describe('VehicleService.update', () => {
  it('should return the updated vehicle', async () => {
    repository.update.mockResolvedValue(vehicleRow({ capacity_kg: '7000.00' }));

    const vehicle = await service.update(owner, VEHICLE_ID, { capacityKg: 7000 });

    expect(vehicle.capacityKg).toBe(7000);
  });

  it('should return 404 when no vehicle of this owner was updated', async () => {
    repository.update.mockResolvedValue(undefined);

    await expect(service.update(owner, VEHICLE_ID, { capacityKg: 7000 })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('should return 409 when the new plate belongs to another vehicle', async () => {
    repository.update.mockRejectedValue(pgError('23505', 'vehicles_plate_unique'));

    await expect(service.update(owner, VEHICLE_ID, { plate: 'XYZ9Z99' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe('VehicleService.updateStatus', () => {
  it('should switch the status when the vehicle is not on a trip', async () => {
    repository.updateStatusUnlessInTrip.mockResolvedValue(vehicleRow({ status: 'MANUTENCAO' }));

    const vehicle = await service.updateStatus(owner, VEHICLE_ID, 'MANUTENCAO');

    expect(vehicle.status).toBe('MANUTENCAO');
    expect(repository.findOwned).not.toHaveBeenCalled();
  });

  it('should return 409 when the vehicle exists but is on a trip', async () => {
    repository.updateStatusUnlessInTrip.mockResolvedValue(undefined);
    repository.findOwned.mockResolvedValue(vehicleRow({ status: 'EM_VIAGEM' }));

    await expect(service.updateStatus(owner, VEHICLE_ID, 'MANUTENCAO')).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/em viagem/i),
    });
  });

  it('should return 404 when the vehicle does not exist', async () => {
    repository.updateStatusUnlessInTrip.mockResolvedValue(undefined);
    repository.findOwned.mockResolvedValue(undefined);

    await expect(service.updateStatus(owner, VEHICLE_ID, 'MANUTENCAO')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('VehicleService.delete', () => {
  it('should delete an available vehicle', async () => {
    repository.findOwned.mockResolvedValue(vehicleRow());

    await service.delete(owner, VEHICLE_ID);

    expect(repository.delete).toHaveBeenCalledWith(VEHICLE_ID);
  });

  it('should not delete a vehicle on a trip', async () => {
    repository.findOwned.mockResolvedValue(vehicleRow({ status: 'EM_VIAGEM' }));

    await expect(service.delete(owner, VEHICLE_ID)).rejects.toMatchObject({ statusCode: 409 });
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('should return 409 when the vehicle has offer or delivery history', async () => {
    repository.findOwned.mockResolvedValue(vehicleRow());
    repository.delete.mockRejectedValue(pgError('23503'));

    await expect(service.delete(owner, VEHICLE_ID)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/MANUTENCAO/),
    });
  });

  it('should rethrow unexpected errors when deleting', async () => {
    const unexpected = new Error('timeout');
    repository.findOwned.mockResolvedValue(vehicleRow());
    repository.delete.mockRejectedValue(unexpected);

    await expect(service.delete(owner, VEHICLE_ID)).rejects.toBe(unexpected);
  });
});
