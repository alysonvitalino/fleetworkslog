import { describe, expect, it } from 'vitest';
import {
  createVehicleSchema,
  plateSchema,
  updateVehicleSchema,
  updateVehicleStatusSchema,
} from './vehicle.schema.js';

describe('plateSchema', () => {
  it('should accept old and Mercosul plates normalizing case, hyphen and spaces', () => {
    expect(plateSchema.parse('abc-1234')).toBe('ABC1234');
    expect(plateSchema.parse('abc 1d23')).toBe('ABC1D23');
    expect(plateSchema.parse('BRA2E19')).toBe('BRA2E19');
  });

  it('should reject plates outside both patterns', () => {
    for (const plate of ['AB1234', 'ABCD123', '1234ABC', 'ABC12345', 'ABC1DD3', '']) {
      expect(plateSchema.safeParse(plate).success, plate).toBe(false);
    }
  });
});

describe('createVehicleSchema', () => {
  const valid = { plate: 'ABC1D23', type: 'VAN', capacityKg: 1500, capacityM3: 8.5 };

  it('should accept a valid vehicle', () => {
    expect(createVehicleSchema.parse(valid)).toEqual(valid);
  });

  it('should reject non-positive capacities and unknown vehicle types', () => {
    expect(createVehicleSchema.safeParse({ ...valid, capacityKg: 0 }).success).toBe(false);
    expect(createVehicleSchema.safeParse({ ...valid, capacityM3: -1 }).success).toBe(false);
    expect(createVehicleSchema.safeParse({ ...valid, type: 'BICICLETA' }).success).toBe(false);
  });

  it('should reject status on create because every vehicle starts DISPONIVEL', () => {
    expect(createVehicleSchema.safeParse({ ...valid, status: 'MANUTENCAO' }).success).toBe(false);
  });
});

describe('updateVehicleSchema', () => {
  it('should accept a partial update', () => {
    expect(updateVehicleSchema.parse({ capacityKg: 2000 })).toEqual({ capacityKg: 2000 });
  });

  it('should reject an empty body', () => {
    expect(updateVehicleSchema.safeParse({}).success).toBe(false);
  });

  it('should reject status so it only changes through the status route', () => {
    expect(updateVehicleSchema.safeParse({ status: 'MANUTENCAO' }).success).toBe(false);
  });
});

describe('updateVehicleStatusSchema', () => {
  it('should only accept the statuses a user can set manually', () => {
    expect(updateVehicleStatusSchema.safeParse({ status: 'MANUTENCAO' }).success).toBe(true);
    expect(updateVehicleStatusSchema.safeParse({ status: 'DISPONIVEL' }).success).toBe(true);
    expect(updateVehicleStatusSchema.safeParse({ status: 'EM_VIAGEM' }).success).toBe(false);
  });
});
