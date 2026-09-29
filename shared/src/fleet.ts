// Contratos de frota: veículos e disponibilidade de motoristas.
// Ver docs/02-modelo-de-dados.md (Motoristas e Veículos).

import type {
  DriverStatus,
  ManualDriverStatus,
  ManualVehicleStatus,
  VehicleStatus,
  VehicleType,
} from './enums.js';

export interface VehicleDto {
  id: string;
  /** Preenchido quando o veículo é da frota de uma transportadora */
  carrierId: string | null;
  /** Preenchido quando o veículo é próprio de um motorista autônomo */
  ownerDriverId: string | null;
  /** Normalizada: maiúsculas, sem hífen (ex.: ABC1D23) */
  plate: string;
  type: VehicleType;
  capacityKg: number;
  capacityM3: number;
  status: VehicleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVehicleRequest {
  plate: string;
  type: VehicleType;
  capacityKg: number;
  capacityM3: number;
}

/** Status não entra aqui: usa a rota própria de status */
export type UpdateVehicleRequest = Partial<CreateVehicleRequest>;

export interface UpdateVehicleStatusRequest {
  status: ManualVehicleStatus;
}

export interface UpdateDriverStatusRequest {
  status: ManualDriverStatus;
}

export interface DriverStatusResponse {
  id: string;
  carrierId: string | null;
  status: DriverStatus;
  updatedAt: string;
}
