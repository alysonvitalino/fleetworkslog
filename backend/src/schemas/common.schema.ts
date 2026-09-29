import { z } from 'zod';

export const uuidSchema = z.uuid({ message: 'ID inválido' });

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// Datas sempre em ISO 8601 com fuso (ex.: 2026-10-01T08:00:00-03:00) para não depender
// do fuso do servidor
export const isoDateSchema = z.iso
  .datetime({ offset: true, message: 'Data inválida (use ISO 8601 com fuso horário)' })
  .transform((value) => new Date(value));

// Endereço com coordenadas: o front obtém lat/lng no autocomplete de endereço
// (o geocoding no backend é o PUTF-36)
export const addressSchema = z.strictObject({
  address: z.string().trim().min(3).max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
