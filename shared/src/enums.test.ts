import { describe, expect, it } from 'vitest';
import {
  DeliveryStatus,
  OfferStatus,
  createValueGuard,
  isDeliveryStatus,
  isOfferStatus,
  isRole,
} from './enums.js';

describe('enums compartilhados', () => {
  it('should keep every key equal to its value so the DB and the API use the same string', () => {
    for (const group of [OfferStatus, DeliveryStatus]) {
      for (const [key, value] of Object.entries(group)) {
        expect(value).toBe(key);
      }
    }
  });

  it('should include RETIRADA as an offer status', () => {
    expect(Object.values(OfferStatus)).toContain('RETIRADA');
  });

  it('should not have ATRASADO as a delivery status because delay is a flag', () => {
    expect(Object.values(DeliveryStatus)).not.toContain('ATRASADO');
  });
});

describe('createValueGuard', () => {
  it('should accept values that belong to the set', () => {
    expect(isRole('MOTORISTA')).toBe(true);
    expect(isOfferStatus('PENDENTE')).toBe(true);
    expect(isDeliveryStatus('EM_TRANSITO')).toBe(true);
  });

  it('should reject unknown strings, other types and different casing', () => {
    expect(isRole('SUPERUSER')).toBe(false);
    expect(isRole('motorista')).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(42)).toBe(false);
  });

  it('should work with any string record', () => {
    const isColor = createValueGuard({ RED: 'red', BLUE: 'blue' } as const);
    expect(isColor('red')).toBe(true);
    expect(isColor('RED')).toBe(false);
  });
});
