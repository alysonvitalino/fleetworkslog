// Contratos do marketplace: cargas disponíveis e ofertas/contrapropostas.
// Fluxo e estados em docs/08-precificacao.md.

import type { OfferStatus } from './enums.js';
import type { ShipmentDto } from './shipments.js';

/** Carga ABERTA vista por quem pode ofertar (transportadora ou motorista autônomo). */
export interface AvailableShipmentDto extends Omit<ShipmentDto, 'shipperId'> {
  /** Distância em km entre o ponto de referência da busca e a origem da carga */
  distanceKm: number;
}

export interface ShipmentOfferDto {
  id: string;
  shipmentId: string;
  /** Nulo quando quem ofertou foi um motorista autônomo */
  carrierId: string | null;
  driverId: string | null;
  vehicleId: string | null;
  /** Igual ao preço sugerido pela empresa quando é aceite direto; diferente quando é contraproposta */
  priceProposed: number;
  isCounterProposal: boolean;
  /** Transportadora ofertou sem definir motorista/veículo: a coleta só avança depois da atribuição */
  assignmentPending: boolean;
  status: OfferStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCarrierOfferRequest {
  priceProposed: number;
  /** Opcionais, mas informados juntos: a transportadora pode definir depois */
  driverId?: string;
  vehicleId?: string;
}

export interface CreateAutonomousOfferRequest {
  priceProposed: number;
  /** Veículo próprio do motorista autônomo */
  vehicleId: string;
}

export interface OfferAssignmentRequest {
  driverId: string;
  vehicleId: string;
}
