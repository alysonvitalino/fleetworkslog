import { z } from 'zod';
import { OfferStatus } from '@fleetworkslog/shared';
import { paginationQuerySchema, uuidSchema } from './common.schema.js';

const priceSchema = z.number().positive().max(10_000_000);

// Transportadora pode ofertar sem motorista/veículo e atribuir depois (docs/08-precificacao.md),
// mas se informar, informa os dois
export const createCarrierOfferSchema = z
  .strictObject({
    priceProposed: priceSchema,
    driverId: uuidSchema.optional(),
    vehicleId: uuidSchema.optional(),
  })
  .refine((body) => (body.driverId === undefined) === (body.vehicleId === undefined), {
    message: 'Informe motorista e veículo juntos, ou nenhum dos dois',
    path: ['vehicleId'],
  });

// O motorista autônomo sempre oferta com ele mesmo e o veículo próprio
export const createAutonomousOfferSchema = z.strictObject({
  priceProposed: priceSchema,
  vehicleId: uuidSchema,
});

export const offerAssignmentSchema = z.strictObject({
  driverId: uuidSchema,
  vehicleId: uuidSchema,
});

export const listOffersQuerySchema = paginationQuerySchema.extend({
  status: z.enum(OfferStatus).optional(),
});

export const availableShipmentsQuerySchema = paginationQuerySchema
  .extend({
    radiusKm: z.coerce.number().positive().max(2000).default(100),
    // Sobrescrevem o endereço-base do ofertante como centro da busca
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((query) => (query.lat === undefined) === (query.lng === undefined), {
    message: 'Informe lat e lng juntos',
    path: ['lng'],
  });

export type CreateCarrierOfferInput = z.infer<typeof createCarrierOfferSchema>;
export type CreateAutonomousOfferInput = z.infer<typeof createAutonomousOfferSchema>;
export type OfferAssignmentInput = z.infer<typeof offerAssignmentSchema>;
export type ListOffersQuery = z.infer<typeof listOffersQuerySchema>;
export type AvailableShipmentsQuery = z.infer<typeof availableShipmentsQuerySchema>;
