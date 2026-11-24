// Testes unitários do DriverService: repository e OwnerService são mocks.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../errors/app-error.js';
import type { DriverRow } from '../models/account.model.js';
import type { DriverRepository } from '../repositories/driver.repository.js';
import { DriverService } from './driver.service.js';
import type { OwnerService } from './owners.service.js';

const CARRIER_ID = 'carrier-1';
const DRIVER_ID = 'driver-1';
const carrierScope = { type: 'carrier', carrierId: CARRIER_ID } as const;

function driverRow(overrides: Partial<DriverRow> = {}): DriverRow {
  return {
    id: DRIVER_ID,
    user_id: 'user-1',
    carrier_id: CARRIER_ID,
    name: 'Diego Motorista',
    email: 'diego@frota.com',
    invite_pending: true,
    cnh_number: '98765432100',
    cnh_category: 'E',
    phone: null,
    status: 'DISPONIVEL',
    base_address: null,
    base_lat: null,
    base_lng: null,
    rating_avg: null,
    created_at: new Date('2026-11-01T10:00:00Z'),
    updated_at: new Date('2026-11-01T10:00:00Z'),
    ...overrides,
  };
}

const pgError = (code: string, constraint?: string) =>
  Object.assign(new Error('pg'), { code, constraint });

type RepositoryMock = Record<
  | 'findById'
  | 'listByCarrier'
  | 'existsInScope'
  | 'updateStatusUnlessInTrip'
  | 'createForCarrier'
  | 'updateProfile'
  | 'deleteWithUser'
  | 'transaction',
  ReturnType<typeof vi.fn>
>;

let repository: RepositoryMock;
let owners: { assertCarrierExists: ReturnType<typeof vi.fn> };
let service: DriverService;

beforeEach(() => {
  repository = {
    findById: vi.fn().mockResolvedValue(driverRow()),
    listByCarrier: vi.fn(),
    existsInScope: vi.fn(),
    updateStatusUnlessInTrip: vi.fn(),
    createForCarrier: vi.fn().mockResolvedValue(DRIVER_ID),
    updateProfile: vi.fn(),
    deleteWithUser: vi.fn(),
    transaction: vi.fn(),
  };
  repository.transaction.mockImplementation((work: (repo: RepositoryMock) => unknown) =>
    work(repository),
  );
  owners = { assertCarrierExists: vi.fn().mockResolvedValue(undefined) };
  service = new DriverService(
    repository as unknown as DriverRepository,
    owners as unknown as OwnerService,
  );
});

describe('DriverService.updateStatus', () => {
  it('should return the new status when the driver is not on a trip', async () => {
    repository.updateStatusUnlessInTrip.mockResolvedValue({
      id: DRIVER_ID,
      carrier_id: CARRIER_ID,
      status: 'INDISPONIVEL',
      updated_at: new Date('2026-11-24T12:00:00Z'),
    });

    const result = await service.updateStatus(carrierScope, DRIVER_ID, 'INDISPONIVEL');

    expect(result).toEqual({
      id: DRIVER_ID,
      carrierId: CARRIER_ID,
      status: 'INDISPONIVEL',
      updatedAt: '2026-11-24T12:00:00.000Z',
    });
  });

  it('should return 409 when the driver exists but is on a trip', async () => {
    repository.updateStatusUnlessInTrip.mockResolvedValue(undefined);
    repository.existsInScope.mockResolvedValue(true);

    await expect(
      service.updateStatus(carrierScope, DRIVER_ID, 'INDISPONIVEL'),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('should return 404 when the driver is not in the scope', async () => {
    repository.updateStatusUnlessInTrip.mockResolvedValue(undefined);
    repository.existsInScope.mockResolvedValue(false);

    await expect(
      service.updateStatus({ type: 'autonomous' }, DRIVER_ID, 'INDISPONIVEL'),
    ).rejects.toMatchObject({ statusCode: 404, message: 'Motorista não encontrado' });
  });
});

describe('DriverService: motoristas da frota', () => {
  it('should list drivers only after checking that the carrier exists', async () => {
    repository.listByCarrier.mockResolvedValue({ rows: [driverRow()], total: 1 });

    const page = await service.listCarrierDrivers(CARRIER_ID, { limit: 20, offset: 0 });

    expect(owners.assertCarrierExists).toHaveBeenCalledWith(CARRIER_ID);
    expect(page.items[0]).toMatchObject({ id: DRIVER_ID, invitePending: true });
  });

  it('should look up the driver restricted to the carrier', async () => {
    await service.getCarrierDriver(CARRIER_ID, DRIVER_ID);

    expect(repository.findById).toHaveBeenCalledWith(DRIVER_ID, carrierScope);
  });

  it('should return 404 for a driver of another carrier', async () => {
    repository.findById.mockResolvedValue(undefined);

    await expect(service.getCarrierDriver(CARRIER_ID, DRIVER_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('should create the driver inside a transaction', async () => {
    const input = {
      name: 'Diego',
      email: 'diego@frota.com',
      cnhNumber: '98765432100',
      cnhCategory: 'E',
    } as const;

    const driver = await service.createCarrierDriver(CARRIER_ID, input);

    expect(repository.transaction).toHaveBeenCalledOnce();
    expect(repository.createForCarrier).toHaveBeenCalledWith(CARRIER_ID, input);
    expect(driver.id).toBe(DRIVER_ID);
  });

  it('should not create a driver for a carrier that does not exist', async () => {
    owners.assertCarrierExists.mockRejectedValue(
      AppError.notFound('Transportadora não encontrada'),
    );

    await expect(service.createCarrierDriver(CARRIER_ID, {} as never)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(repository.transaction).not.toHaveBeenCalled();
  });

  it('should return 409 for an e-mail already in use', async () => {
    repository.createForCarrier.mockRejectedValue(pgError('23505', 'users_email_lower_unique'));

    await expect(service.createCarrierDriver(CARRIER_ID, {} as never)).rejects.toMatchObject({
      statusCode: 409,
      message: 'E-mail já cadastrado',
    });
  });

  it('should return 409 for a CNH already in use when updating', async () => {
    repository.updateProfile.mockRejectedValue(pgError('23505', 'drivers_cnh_number_unique'));

    await expect(
      service.updateCarrierDriver(CARRIER_ID, DRIVER_ID, { cnhNumber: '11122233344' }),
    ).rejects.toMatchObject({ statusCode: 409, message: 'CNH já cadastrada' });
  });

  it('should update the profile of the carrier own driver', async () => {
    await service.updateCarrierDriver(CARRIER_ID, DRIVER_ID, { phone: '41998765432' });

    expect(repository.findById).toHaveBeenCalledWith(DRIVER_ID, carrierScope);
    expect(repository.updateProfile).toHaveBeenCalledWith(driverRow(), { phone: '41998765432' });
  });
});

describe('DriverService.deleteCarrierDriver', () => {
  it('should delete the driver together with the user', async () => {
    await service.deleteCarrierDriver(CARRIER_ID, DRIVER_ID);

    expect(repository.deleteWithUser).toHaveBeenCalledWith(driverRow());
  });

  it('should not delete a driver on a trip', async () => {
    repository.findById.mockResolvedValue(driverRow({ status: 'EM_VIAGEM' }));

    await expect(service.deleteCarrierDriver(CARRIER_ID, DRIVER_ID)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Não é possível remover um motorista em viagem',
    });
    expect(repository.deleteWithUser).not.toHaveBeenCalled();
  });

  it('should return 409 when the driver has offer or delivery history', async () => {
    repository.deleteWithUser.mockRejectedValue(pgError('23503'));

    await expect(service.deleteCarrierDriver(CARRIER_ID, DRIVER_ID)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/INDISPONIVEL/),
    });
  });
});

describe('DriverService: perfil do autônomo', () => {
  it('should update only drivers without a carrier', async () => {
    await service.updateAutonomousDriver(DRIVER_ID, { name: 'João' });

    expect(repository.findById).toHaveBeenCalledWith(DRIVER_ID, { type: 'autonomous' });
  });

  it('should return 404 when getting a driver that does not exist', async () => {
    repository.findById.mockResolvedValue(undefined);

    await expect(service.getDriver(DRIVER_ID)).rejects.toMatchObject({ statusCode: 404 });
  });
});
