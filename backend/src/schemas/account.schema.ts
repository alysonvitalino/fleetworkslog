import { z } from 'zod';
import { CnhCategory, DriverStatus } from '@fleetworkslog/shared';
import { addressSchema, paginationQuerySchema } from './common.schema.js';

/** CNPJ válido pelos dígitos verificadores (só dígitos, 14 posições). */
export function isValidCnpj(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const checkDigit = (base: string) => {
    const weights =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(base[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = checkDigit(cnpj.slice(0, 12));
  const second = checkDigit(cnpj.slice(0, 12) + first);
  return cnpj.endsWith(`${first}${second}`);
}

const onlyDigits = (value: string) => value.replace(/\D/g, '');

// Aceita com ou sem máscara (11.222.333/0001-81) e guarda só os dígitos
export const cnpjSchema = z.string().transform(onlyDigits).refine(isValidCnpj, 'CNPJ inválido');

export const cnhNumberSchema = z
  .string()
  .transform(onlyDigits)
  .pipe(z.string().regex(/^\d{11}$/, 'CNH deve ter 11 dígitos'));

const phoneSchema = z
  .string()
  .transform(onlyDigits)
  .pipe(z.string().regex(/^\d{10,11}$/, 'Telefone deve ter DDD + número (10 ou 11 dígitos)'))
  .nullish();

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'E-mail inválido' }).max(254));

const passwordSchema = z.string().min(8, 'A senha deve ter pelo menos 8 caracteres').max(128);
const nameSchema = z.string().trim().min(2).max(150);
const legalNameSchema = z.string().trim().min(2).max(200);

const signupBase = {
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
};

export const signupShipperSchema = z.strictObject({
  ...signupBase,
  legalName: legalNameSchema,
  document: cnpjSchema,
  address: addressSchema.nullish(),
});

// Transportadora precisa do endereço-base: é o centro da busca de cargas por raio
export const signupCarrierSchema = z.strictObject({
  ...signupBase,
  legalName: legalNameSchema,
  document: cnpjSchema,
  address: addressSchema,
});

export const signupAutonomousDriverSchema = z.strictObject({
  ...signupBase,
  cnhNumber: cnhNumberSchema,
  cnhCategory: z.enum(CnhCategory),
  baseAddress: addressSchema,
});

const nonEmpty = (body: object) => Object.keys(body).length > 0;
const NON_EMPTY_MESSAGE = 'Informe ao menos um campo para atualizar';

export const updateCompanySchema = z
  .strictObject({
    legalName: legalNameSchema,
    phone: phoneSchema,
    address: addressSchema.nullable(),
  })
  .partial()
  .refine(nonEmpty, NON_EMPTY_MESSAGE);

export const createCarrierDriverSchema = z.strictObject({
  name: nameSchema,
  email: emailSchema,
  cnhNumber: cnhNumberSchema,
  cnhCategory: z.enum(CnhCategory),
  phone: phoneSchema,
});

const driverProfileFields = {
  name: nameSchema,
  cnhNumber: cnhNumberSchema,
  cnhCategory: z.enum(CnhCategory),
  phone: phoneSchema,
};

export const updateCarrierDriverSchema = z
  .strictObject(driverProfileFields)
  .partial()
  .refine(nonEmpty, NON_EMPTY_MESSAGE);

// PUT substitui o perfil inteiro: todos os campos obrigatórios e o telefone omitido é limpo.
// O e-mail não entra: é o login do motorista e não é editado por aqui
export const replaceCarrierDriverSchema = z
  .strictObject(driverProfileFields)
  .transform((body) => ({ ...body, phone: body.phone ?? null }));

export const updateAutonomousDriverSchema = z
  .strictObject({ ...driverProfileFields, baseAddress: addressSchema })
  .partial()
  .refine(nonEmpty, NON_EMPTY_MESSAGE);

export const listDriversQuerySchema = paginationQuerySchema.extend({
  status: z.enum(DriverStatus).optional(),
});

export type SignupShipperInput = z.infer<typeof signupShipperSchema>;
export type SignupCarrierInput = z.infer<typeof signupCarrierSchema>;
export type SignupAutonomousDriverInput = z.infer<typeof signupAutonomousDriverSchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type CreateCarrierDriverInput = z.infer<typeof createCarrierDriverSchema>;
export type UpdateCarrierDriverInput = z.infer<typeof updateCarrierDriverSchema>;
export type ReplaceCarrierDriverInput = z.infer<typeof replaceCarrierDriverSchema>;
export type UpdateAutonomousDriverInput = z.infer<typeof updateAutonomousDriverSchema>;
export type ListDriversQuery = z.infer<typeof listDriversQuerySchema>;
