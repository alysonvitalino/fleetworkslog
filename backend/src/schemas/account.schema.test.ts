import { describe, expect, it } from 'vitest';
import {
  cnpjSchema,
  emailSchema,
  isValidCnpj,
  signupAutonomousDriverSchema,
  signupCarrierSchema,
  signupShipperSchema,
  updateCompanySchema,
} from './account.schema.js';

describe('isValidCnpj', () => {
  it('should accept CNPJs with valid check digits', () => {
    expect(isValidCnpj('11222333000181')).toBe(true);
    expect(isValidCnpj('11444777000161')).toBe(true);
  });

  it('should reject wrong check digits, repeated digits and wrong length', () => {
    expect(isValidCnpj('11222333000182')).toBe(false);
    expect(isValidCnpj('11111111111111')).toBe(false);
    expect(isValidCnpj('1122233300018')).toBe(false);
  });
});

describe('cnpjSchema', () => {
  it('should accept the masked format and keep only digits', () => {
    expect(cnpjSchema.parse('11.222.333/0001-81')).toBe('11222333000181');
  });
});

describe('emailSchema', () => {
  it('should trim and lowercase the e-mail', () => {
    expect(emailSchema.parse('  Ana@Empresa.COM ')).toBe('ana@empresa.com');
  });

  it('should reject invalid e-mails', () => {
    expect(emailSchema.safeParse('ana@').success).toBe(false);
  });
});

const baseAddress = { address: 'Rua A, 1 - São Paulo/SP', lat: -23.55, lng: -46.63 };
const signup = {
  name: 'Ana Silva',
  email: 'ana@empresa.com',
  password: 'senha-forte',
  legalName: 'Empresa Ana LTDA',
  document: '11222333000181',
};

describe('signup schemas', () => {
  it('should let a shipper sign up without an address', () => {
    expect(signupShipperSchema.safeParse(signup).success).toBe(true);
  });

  it('should require the base address for a carrier', () => {
    expect(signupCarrierSchema.safeParse(signup).success).toBe(false);
    expect(signupCarrierSchema.safeParse({ ...signup, address: baseAddress }).success).toBe(true);
  });

  it('should reject short passwords', () => {
    expect(signupShipperSchema.safeParse({ ...signup, password: '1234567' }).success).toBe(false);
  });

  it('should normalize the phone and reject numbers without area code', () => {
    const parsed = signupShipperSchema.parse({ ...signup, phone: '(11) 98765-4321' });
    expect(parsed.phone).toBe('11987654321');
    expect(signupShipperSchema.safeParse({ ...signup, phone: '98765-4321' }).success).toBe(false);
  });

  it('should require CNH with 11 digits and the base address for an autonomous driver', () => {
    const driver = {
      name: 'Elisa',
      email: 'elisa@dev.local',
      password: 'senha-forte',
      cnhNumber: '123.456.789-01',
      cnhCategory: 'C',
      baseAddress,
    };
    expect(signupAutonomousDriverSchema.parse(driver).cnhNumber).toBe('12345678901');
    expect(
      signupAutonomousDriverSchema.safeParse({ ...driver, baseAddress: undefined }).success,
    ).toBe(false);
  });
});

describe('updateCompanySchema', () => {
  it('should reject changing the CNPJ or an empty body', () => {
    expect(updateCompanySchema.safeParse({ document: '11444777000161' }).success).toBe(false);
    expect(updateCompanySchema.safeParse({}).success).toBe(false);
  });
});
