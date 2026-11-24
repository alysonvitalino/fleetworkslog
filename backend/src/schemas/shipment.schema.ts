import { z } from 'zod';
import { ShipmentStatus, VehicleType } from '@fleetworkslog/shared';
import { addressSchema, isoDateSchema, paginationQuerySchema } from './common.schema.js';

const shipmentFields = {
  origin: addressSchema,
  destination: addressSchema,
  cargoType: z.string().trim().min(1).max(100),
  weightKg: z.number().positive().max(100_000),
  volumeM3: z.number().positive().max(1_000),
  requiredVehicleType: z.enum(VehicleType),
  pickupWindowStart: isoDateSchema,
  pickupWindowEnd: isoDateSchema,
  deliveryDeadline: isoDateSchema,
  specialRequirements: z.string().trim().max(2000).nullish(),
  priceOffered: z.number().positive().max(10_000_000),
};

export interface ShipmentSchedule {
  pickupWindowStart: Date;
  pickupWindowEnd: Date;
  deliveryDeadline: Date;
}

export interface ScheduleIssue {
  path: (keyof ShipmentSchedule)[];
  message: string;
}

/**
 * Regras de coerência das datas de uma carga. Usada no cadastro (schema) e na edição,
 * onde as datas novas precisam ser checadas junto com as que já estão salvas.
 */
export function scheduleIssues(schedule: ShipmentSchedule, now = new Date()): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  if (schedule.pickupWindowStart >= schedule.pickupWindowEnd) {
    issues.push({
      path: ['pickupWindowEnd'],
      message: 'O fim da janela de coleta deve ser depois do início',
    });
  }
  if (schedule.deliveryDeadline <= schedule.pickupWindowStart) {
    issues.push({
      path: ['deliveryDeadline'],
      message: 'O prazo de entrega deve ser depois do início da janela de coleta',
    });
  }
  if (schedule.pickupWindowEnd <= now) {
    issues.push({ path: ['pickupWindowEnd'], message: 'A janela de coleta já terminou' });
  }
  return issues;
}

export const createShipmentSchema = z.strictObject(shipmentFields).superRefine((body, ctx) => {
  for (const issue of scheduleIssues(body)) {
    ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  }
});

export const updateShipmentSchema = z
  .strictObject(shipmentFields)
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Informe ao menos um campo para atualizar');

// PUT substitui a carga inteira: todos os campos obrigatórios são exigidos e o campo
// opcional omitido é limpo (vira null), diferente do PATCH, que mantém o valor salvo
export const replaceShipmentSchema = createShipmentSchema.transform((body) => ({
  ...body,
  specialRequirements: body.specialRequirements ?? null,
}));

export const listShipmentsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ShipmentStatus).optional(),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;
export type ReplaceShipmentInput = z.infer<typeof replaceShipmentSchema>;
export type ListShipmentsQuery = z.infer<typeof listShipmentsQuerySchema>;
