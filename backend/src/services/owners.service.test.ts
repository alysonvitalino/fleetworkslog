import { describe, expect, it, vi } from 'vitest';
import type { OwnerRepository } from '../repositories/owner.repository.js';
import { OwnerService } from './owners.service.js';

function createService(exists: boolean) {
  const repository = {
    carrierExists: vi.fn().mockResolvedValue(exists),
    shipperExists: vi.fn().mockResolvedValue(exists),
    autonomousDriverExists: vi.fn().mockResolvedValue(exists),
  };
  return { repository, service: new OwnerService(repository as unknown as OwnerRepository) };
}

describe('OwnerService', () => {
  it('should resolve when the owner exists', async () => {
    const { service } = createService(true);

    await expect(service.assertShipperExists('company-1')).resolves.toBeUndefined();
    await expect(
      service.assertPartyExists({ type: 'carrier', carrierId: 'carrier-1' }),
    ).resolves.toBeUndefined();
  });

  it('should return 404 with a message specific to each kind of owner', async () => {
    const { service } = createService(false);

    await expect(service.assertShipperExists('x')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Empresa não encontrada',
    });
    await expect(
      service.assertPartyExists({ type: 'carrier', carrierId: 'x' }),
    ).rejects.toMatchObject({ message: 'Transportadora não encontrada' });
    await expect(
      service.assertPartyExists({ type: 'autonomous', driverId: 'x' }),
    ).rejects.toMatchObject({ message: 'Motorista autônomo não encontrado' });
  });

  it('should check the autonomous driver table for an autonomous party', async () => {
    const { repository, service } = createService(true);

    await service.assertPartyExists({ type: 'autonomous', driverId: 'driver-1' });

    expect(repository.autonomousDriverExists).toHaveBeenCalledWith('driver-1');
    expect(repository.carrierExists).not.toHaveBeenCalled();
  });
});
