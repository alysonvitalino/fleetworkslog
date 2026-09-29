import { z } from 'zod';

const noteSchema = z.string().trim().min(1).max(500).optional();

// O motorista só avança a entrega; cancelar é da empresa (ou ADMIN)
export const updateDeliveryStatusSchema = z.strictObject({
  status: z.enum(['COLETADO', 'EM_TRANSITO', 'ENTREGUE']),
  note: noteSchema,
});

export const cancelDeliverySchema = z.strictObject({ note: noteSchema });

export type UpdateDeliveryStatusInput = z.infer<typeof updateDeliveryStatusSchema>;
