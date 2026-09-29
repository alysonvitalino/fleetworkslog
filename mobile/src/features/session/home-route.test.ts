import { describe, expect, it } from 'vitest';
import { resolveHomeRoute } from './home-route';

describe('resolveHomeRoute', () => {
  it('should send a logged out user to login', () => {
    expect(resolveHomeRoute(null)).toBe('/login');
  });

  it('should send MOTORISTA to the active deliveries area', () => {
    expect(resolveHomeRoute('MOTORISTA')).toBe('/motorista');
  });

  it('should send EMPRESA to the shipment tracking area', () => {
    expect(resolveHomeRoute('EMPRESA')).toBe('/empresa');
  });

  it.each(['TRANSPORTADORA', 'OPERADOR', 'ADMIN'] as const)(
    'should tell %s to use the web panel',
    (role) => {
      expect(resolveHomeRoute(role)).toBe('/usar-painel-web');
    },
  );
});
