// Contratos de cadastro: usuários, empresas/transportadoras e motoristas.
// Ver docs/02-modelo-de-dados.md (Autenticação e Perfis, Empresas e Transportadoras, Motoristas).

import type { CompanyType, DriverStatus, Role } from './enums.js';
import type { Address } from './shipments.js';

export const CnhCategory = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  E: 'E',
  AB: 'AB',
  AC: 'AC',
  AD: 'AD',
  AE: 'AE',
} as const;
export type CnhCategory = (typeof CnhCategory)[keyof typeof CnhCategory];

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface CompanyDto {
  id: string;
  type: CompanyType;
  legalName: string;
  /** CNPJ só com dígitos */
  document: string;
  phone: string | null;
  /** Obrigatório para transportadora: é o ponto de referência da busca de cargas por raio */
  address: Address | null;
  ratingAvg: number | null;
  /** Usuário responsável pela conta */
  user: UserDto;
  createdAt: string;
  updatedAt: string;
}

export interface DriverDto {
  id: string;
  userId: string;
  /** Nulo = motorista autônomo */
  carrierId: string | null;
  name: string;
  email: string;
  cnhNumber: string;
  cnhCategory: CnhCategory;
  phone: string | null;
  status: DriverStatus;
  /** Endereço-base do autônomo (matching de cargas); nulo para motorista de transportadora */
  baseAddress: Address | null;
  ratingAvg: number | null;
  /** Motorista cadastrado pela transportadora que ainda não definiu a senha pelo convite */
  invitePending: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SignupBase {
  /** Nome da pessoa responsável */
  name: string;
  email: string;
  password: string;
  phone?: string | null;
}

export interface SignupShipperRequest extends SignupBase {
  legalName: string;
  document: string;
  address?: Address | null;
}

export interface SignupCarrierRequest extends SignupBase {
  legalName: string;
  document: string;
  /** Endereço-base obrigatório */
  address: Address;
}

export interface SignupAutonomousDriverRequest extends SignupBase {
  cnhNumber: string;
  cnhCategory: CnhCategory;
  baseAddress: Address;
}

export interface UpdateCompanyRequest {
  legalName?: string;
  phone?: string | null;
  address?: Address | null;
}

/** Transportadora cadastra motorista da frota: sem senha, o acesso vem pelo convite */
export interface CreateCarrierDriverRequest {
  name: string;
  email: string;
  cnhNumber: string;
  cnhCategory: CnhCategory;
  phone?: string | null;
}

export interface UpdateCarrierDriverRequest {
  name?: string;
  cnhNumber?: string;
  cnhCategory?: CnhCategory;
  phone?: string | null;
}

export interface UpdateAutonomousDriverRequest extends UpdateCarrierDriverRequest {
  baseAddress?: Address;
}
