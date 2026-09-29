import { z } from 'zod';
import {
  ManualDriverStatus,
  ManualVehicleStatus,
  VehicleStatus,
  VehicleType,
} from '@fleetworkslog/shared';
import { paginationQuerySchema } from './common.schema.js';

// Placa antiga (AAA9999) ou Mercosul (AAA9A99)
const PLATE_PATTERN = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

export const plateSchema = z
  .string()
  .transform((value) => value.toUpperCase().replace(/[\s-]/g, ''))
  .pipe(z.string().regex(PLATE_PATTERN, 'Placa inválida (use AAA9999 ou AAA9A99)'));

const vehicleFields = {
  plate: plateSchema,
  type: z.enum(VehicleType),
  capacityKg: z.number().positive().max(100_000),
  capacityM3: z.number().positive().max(1_000),
};

export const createVehicleSchema = z.strictObject(vehicleFields);

// strict: um `status` enviado aqui vira 400 em vez de ser ignorado em silêncio
export const updateVehicleSchema = z
  .strictObject(vehicleFields)
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Informe ao menos um campo para atualizar');

export const updateVehicleStatusSchema = z.strictObject({ status: z.enum(ManualVehicleStatus) });

export const updateDriverStatusSchema = z.strictObject({ status: z.enum(ManualDriverStatus) });

export const listVehiclesQuerySchema = paginationQuerySchema.extend({
  status: z.enum(VehicleStatus).optional(),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type ListVehiclesQuery = z.infer<typeof listVehiclesQuerySchema>;
