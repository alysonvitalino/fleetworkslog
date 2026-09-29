import { describe, expect, it } from 'vitest';
import {
  availableShipmentsQuerySchema,
  createCarrierOfferSchema,
} from '../schemas/marketplace.schema.js';
import { NEXT_DELIVERY_STATUS } from './delivery.service.js';
import { vehicleMismatch } from './marketplace.service.js';

const shipment = {
  required_vehicle_type: 'TRUCK_TOCO',
  weight_kg: '1000.00',
  volume_m3: '5.000',
} as const;

describe('vehicleMismatch', () => {
  it('should accept a vehicle of the required type with enough capacity', () => {
    const vehicle = { type: 'TRUCK_TOCO', capacity_kg: '1000.00', capacity_m3: '5.000' } as const;
    expect(vehicleMismatch(vehicle, shipment)).toBeNull();
  });

  it('should explain why the vehicle does not fit', () => {
    expect(vehicleMismatch({ type: 'VAN', capacity_kg: 9000, capacity_m3: 90 }, shipment)).toMatch(
      /TRUCK_TOCO/,
    );
    expect(
      vehicleMismatch({ type: 'TRUCK_TOCO', capacity_kg: 999.99, capacity_m3: 90 }, shipment),
    ).toMatch(/peso/);
    expect(
      vehicleMismatch({ type: 'TRUCK_TOCO', capacity_kg: 9000, capacity_m3: 4.9 }, shipment),
    ).toMatch(/volume/);
  });
});

describe('NEXT_DELIVERY_STATUS', () => {
  it('should allow only one step forward and nothing after the final states', () => {
    expect(NEXT_DELIVERY_STATUS).toEqual({
      COLETA_PENDENTE: 'COLETADO',
      COLETADO: 'EM_TRANSITO',
      EM_TRANSITO: 'ENTREGUE',
    });
  });
});

describe('createCarrierOfferSchema', () => {
  const id = '11111111-1111-4111-8111-111111111111';

  it('should accept an offer without driver and vehicle', () => {
    expect(createCarrierOfferSchema.safeParse({ priceProposed: 100 }).success).toBe(true);
  });

  it('should require driver and vehicle together', () => {
    expect(createCarrierOfferSchema.safeParse({ priceProposed: 100, driverId: id }).success).toBe(
      false,
    );
    expect(
      createCarrierOfferSchema.safeParse({ priceProposed: 100, driverId: id, vehicleId: id })
        .success,
    ).toBe(true);
  });
});

describe('availableShipmentsQuerySchema', () => {
  it('should default the radius to 100 km', () => {
    expect(availableShipmentsQuerySchema.parse({}).radiusKm).toBe(100);
  });

  it('should require lat and lng together', () => {
    expect(availableShipmentsQuerySchema.safeParse({ lat: '-23.5' }).success).toBe(false);
  });
});
