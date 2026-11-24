// Testes unitários do ShipmentService: repository e OwnerService são mocks.
// O mock de `transaction` só executa o trabalho com o próprio mock, como o Knex faria com a trx.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../errors/app-error.js';
import type { ShipmentRow } from '../models/shipment.model.js';
import type { ShipmentRepository } from '../repositories/shipment.repository.js';
import type { OwnerService } from './owners.service.js';
import { ShipmentService } from './shipment.service.js';

const SHIPPER_ID = 'shipper-1';
const SHIPMENT_ID = 'shipment-1';
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);

function shipmentRow(overrides: Partial<ShipmentRow> = {}): ShipmentRow {
  return {
    id: SHIPMENT_ID,
    shipper_id: SHIPPER_ID,
    origin_address: 'Curitiba/PR',
    origin_lat: -25.43,
    origin_lng: -49.27,
    destination_address: 'São Paulo/SP',
    destination_lat: -23.56,
    destination_lng: -46.66,
    cargo_type: 'Eletrônicos',
    weight_kg: '3500.00',
    volume_m3: '25.000',
    required_vehicle_type: 'TRUCK_TOCO',
    pickup_window_start: inDays(2),
    pickup_window_end: inDays(3),
    delivery_deadline: inDays(5),
    special_requirements: null,
    price_offered: '4800.00',
    status: 'ABERTA',
    created_at: new Date('2026-11-01T10:00:00Z'),
    updated_at: new Date('2026-11-01T10:00:00Z'),
    ...overrides,
  };
}

type RepositoryMock = Record<
  | 'list'
  | 'findOwned'
  | 'findOwnedForUpdate'
  | 'create'
  | 'update'
  | 'updateStatus'
  | 'hasOffers'
  | 'cancelPendingOffers'
  | 'delete'
  | 'transaction',
  ReturnType<typeof vi.fn>
>;

let repository: RepositoryMock;
let owners: { assertShipperExists: ReturnType<typeof vi.fn> };
let service: ShipmentService;

beforeEach(() => {
  repository = {
    list: vi.fn(),
    findOwned: vi.fn().mockResolvedValue(shipmentRow()),
    findOwnedForUpdate: vi.fn().mockResolvedValue(shipmentRow()),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    hasOffers: vi.fn().mockResolvedValue(false),
    cancelPendingOffers: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  };
  repository.transaction.mockImplementation((work: (repo: RepositoryMock) => unknown) =>
    work(repository),
  );
  owners = { assertShipperExists: vi.fn().mockResolvedValue(undefined) };
  service = new ShipmentService(
    repository as unknown as ShipmentRepository,
    owners as unknown as OwnerService,
  );
});

describe('ShipmentService.list e get', () => {
  it('should list only after checking that the shipper exists', async () => {
    repository.list.mockResolvedValue({ rows: [shipmentRow()], total: 1 });

    const page = await service.list(SHIPPER_ID, { limit: 10, offset: 0 });

    expect(owners.assertShipperExists).toHaveBeenCalledWith(SHIPPER_ID);
    expect(page.items[0]).toMatchObject({ id: SHIPMENT_ID, weightKg: 3500, priceOffered: 4800 });
  });

  it('should return 404 when the shipment does not belong to the shipper', async () => {
    repository.findOwned.mockResolvedValue(undefined);

    await expect(service.get(SHIPPER_ID, SHIPMENT_ID)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Carga não encontrada',
    });
  });
});

describe('ShipmentService.create', () => {
  it('should not create a shipment for a company that is not a shipper', async () => {
    owners.assertShipperExists.mockRejectedValue(AppError.notFound('Empresa não encontrada'));

    await expect(service.create(SHIPPER_ID, {} as never)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('should return the created shipment', async () => {
    repository.create.mockResolvedValue(SHIPMENT_ID);

    const shipment = await service.create(SHIPPER_ID, {} as never);

    expect(shipment).toMatchObject({ id: SHIPMENT_ID, status: 'ABERTA' });
  });
});

describe('ShipmentService.update', () => {
  it('should update an ABERTA shipment inside a transaction', async () => {
    await service.update(SHIPPER_ID, SHIPMENT_ID, { priceOffered: 5200 });

    expect(repository.transaction).toHaveBeenCalledOnce();
    expect(repository.findOwnedForUpdate).toHaveBeenCalledWith(SHIPPER_ID, SHIPMENT_ID);
    expect(repository.update).toHaveBeenCalledWith(SHIPMENT_ID, { priceOffered: 5200 });
  });

  it('should return 409 when the shipment is no longer ABERTA', async () => {
    repository.findOwnedForUpdate.mockResolvedValue(shipmentRow({ status: 'ACEITA' }));

    await expect(
      service.update(SHIPPER_ID, SHIPMENT_ID, { priceOffered: 5200 }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('should validate a new deadline against the stored pickup window', async () => {
    // A coleta salva começa em +2 dias: prazo em +1 dia é incoerente
    const deliveryDeadline = inDays(1);

    await expect(
      service.update(SHIPPER_ID, SHIPMENT_ID, { deliveryDeadline }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      details: [expect.objectContaining({ path: ['deliveryDeadline'] })],
    });
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('should return 404 when the shipment is not found', async () => {
    repository.findOwnedForUpdate.mockResolvedValue(undefined);

    await expect(
      service.update(SHIPPER_ID, SHIPMENT_ID, { priceOffered: 1 }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('ShipmentService.cancel', () => {
  it('should cancel the shipment and its pending offers', async () => {
    await service.cancel(SHIPPER_ID, SHIPMENT_ID);

    expect(repository.updateStatus).toHaveBeenCalledWith(SHIPMENT_ID, 'CANCELADA');
    expect(repository.cancelPendingOffers).toHaveBeenCalledWith(SHIPMENT_ID);
  });

  it('should explain that an already cancelled shipment cannot be cancelled again', async () => {
    repository.findOwnedForUpdate.mockResolvedValue(shipmentRow({ status: 'CANCELADA' }));

    await expect(service.cancel(SHIPPER_ID, SHIPMENT_ID)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Carga já está cancelada',
    });
  });

  it('should point to the delivery cancellation for an accepted shipment', async () => {
    repository.findOwnedForUpdate.mockResolvedValue(shipmentRow({ status: 'ACEITA' }));

    await expect(service.cancel(SHIPPER_ID, SHIPMENT_ID)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/cancele a entrega/),
    });
    expect(repository.cancelPendingOffers).not.toHaveBeenCalled();
  });
});

describe('ShipmentService.delete', () => {
  it('should delete an ABERTA shipment without offers', async () => {
    await service.delete(SHIPPER_ID, SHIPMENT_ID);

    expect(repository.delete).toHaveBeenCalledWith(SHIPMENT_ID);
  });

  it('should not delete a shipment that already received offers', async () => {
    repository.hasOffers.mockResolvedValue(true);

    await expect(service.delete(SHIPPER_ID, SHIPMENT_ID)).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/cancele-a/),
    });
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('should not delete a shipment that is not ABERTA', async () => {
    repository.findOwnedForUpdate.mockResolvedValue(shipmentRow({ status: 'ENTREGUE' }));

    await expect(service.delete(SHIPPER_ID, SHIPMENT_ID)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(repository.hasOffers).not.toHaveBeenCalled();
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
