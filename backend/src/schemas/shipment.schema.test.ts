import { describe, expect, it } from 'vitest';
import { createShipmentSchema, scheduleIssues, updateShipmentSchema } from './shipment.schema.js';

const now = new Date('2026-10-01T12:00:00Z');
const at = (iso: string) => new Date(iso);

describe('scheduleIssues', () => {
  const valid = {
    pickupWindowStart: at('2026-10-02T08:00:00Z'),
    pickupWindowEnd: at('2026-10-02T12:00:00Z'),
    deliveryDeadline: at('2026-10-03T18:00:00Z'),
  };

  it('should return no issues for a coherent schedule', () => {
    expect(scheduleIssues(valid, now)).toEqual([]);
  });

  it('should require the pickup window to end after it starts', () => {
    const issues = scheduleIssues({ ...valid, pickupWindowEnd: valid.pickupWindowStart }, now);
    expect(issues.map((issue) => issue.path)).toContainEqual(['pickupWindowEnd']);
  });

  it('should require the delivery deadline after the pickup window starts', () => {
    const issues = scheduleIssues({ ...valid, deliveryDeadline: at('2026-10-02T07:00:00Z') }, now);
    expect(issues.map((issue) => issue.path)).toEqual([['deliveryDeadline']]);
  });

  it('should reject a pickup window that already ended', () => {
    const issues = scheduleIssues(valid, at('2026-10-02T13:00:00Z'));
    expect(issues).toEqual([
      { path: ['pickupWindowEnd'], message: 'A janela de coleta já terminou' },
    ]);
  });
});

describe('createShipmentSchema', () => {
  const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
  const valid = {
    origin: { address: 'Av. Paulista, 1000 - São Paulo', lat: -23.5613, lng: -46.6565 },
    destination: { address: 'Rua XV de Novembro, 50 - Curitiba', lat: -25.4284, lng: -49.2733 },
    cargoType: 'Eletrônicos',
    weightKg: 1200,
    volumeM3: 6,
    requiredVehicleType: 'TRUCK_TOCO',
    pickupWindowStart: inHours(24),
    pickupWindowEnd: inHours(28),
    deliveryDeadline: inHours(72),
    priceOffered: 3500,
  };

  it('should parse dates into Date objects', () => {
    const parsed = createShipmentSchema.parse(valid);
    expect(parsed.pickupWindowStart).toBeInstanceOf(Date);
  });

  it('should reject dates without timezone so the server timezone never matters', () => {
    const result = createShipmentSchema.safeParse({
      ...valid,
      deliveryDeadline: '2026-10-10T10:00:00',
    });
    expect(result.success).toBe(false);
  });

  it('should reject coordinates out of range', () => {
    const result = createShipmentSchema.safeParse({
      ...valid,
      origin: { ...valid.origin, lat: -123 },
    });
    expect(result.success).toBe(false);
  });

  it('should report schedule problems with the field path', () => {
    const result = createShipmentSchema.safeParse({ ...valid, pickupWindowEnd: inHours(20) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['pickupWindowEnd']);
  });

  it('should reject the status field because it is controlled by the offer flow', () => {
    expect(createShipmentSchema.safeParse({ ...valid, status: 'ACEITA' }).success).toBe(false);
  });
});

describe('updateShipmentSchema', () => {
  it('should reject an empty body', () => {
    expect(updateShipmentSchema.safeParse({}).success).toBe(false);
  });

  it('should allow clearing special requirements with null', () => {
    expect(updateShipmentSchema.parse({ specialRequirements: null })).toEqual({
      specialRequirements: null,
    });
  });
});
