import type { Knex } from 'knex';
import type {
  Address,
  CnhCategory,
  CompanyDto,
  CompanyType,
  DriverDto,
  DriverStatus,
  Role,
} from '@fleetworkslog/shared';
import { selectLatLng } from '../db/geo.js';

const toNumberOrNull = (value: string | null) => (value === null ? null : Number(value));

export interface CompanyRow {
  id: string;
  type: CompanyType;
  legal_name: string;
  document: string;
  phone: string | null;
  // jsonb: { address, lat, lng }
  address_json: Address | null;
  rating_avg: string | null;
  created_at: Date;
  updated_at: Date;
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: Role;
  user_created_at: Date;
}

/** Empresa/transportadora com o usuário responsável (alias `c` / `u`). */
export function companiesQuery(db: Knex) {
  return db('companies as c')
    .join('users as u', 'u.id', 'c.user_id')
    .select<CompanyRow[]>(
      'c.id',
      'c.type',
      'c.legal_name',
      'c.document',
      'c.phone',
      'c.address_json',
      'c.rating_avg',
      'c.created_at',
      'c.updated_at',
      'u.id as user_id',
      'u.name as user_name',
      'u.email as user_email',
      'u.role as user_role',
      'u.created_at as user_created_at',
    );
}

export function toCompanyDto(row: CompanyRow): CompanyDto {
  return {
    id: row.id,
    type: row.type,
    legalName: row.legal_name,
    document: row.document,
    phone: row.phone,
    address: row.address_json,
    ratingAvg: toNumberOrNull(row.rating_avg),
    user: {
      id: row.user_id,
      name: row.user_name,
      email: row.user_email,
      role: row.user_role,
      createdAt: row.user_created_at.toISOString(),
    },
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export interface DriverRow {
  id: string;
  user_id: string;
  carrier_id: string | null;
  name: string;
  email: string;
  invite_pending: boolean;
  cnh_number: string;
  cnh_category: CnhCategory;
  phone: string | null;
  status: DriverStatus;
  base_address: string | null;
  base_lat: number | null;
  base_lng: number | null;
  rating_avg: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Motorista com nome/e-mail do usuário (alias `d` / `u`). */
export function driversQuery(db: Knex) {
  return db('drivers as d')
    .join('users as u', 'u.id', 'd.user_id')
    .select<DriverRow[]>(
      'd.id',
      'd.user_id',
      'd.carrier_id',
      'u.name',
      'u.email',
      db.raw('u.password_hash IS NULL AS invite_pending'),
      'd.cnh_number',
      'd.cnh_category',
      'd.phone',
      'd.status',
      'd.base_address',
      ...selectLatLng(db, 'd.base_geo', 'base'),
      'd.rating_avg',
      'd.created_at',
      'd.updated_at',
    );
}

export function toDriverDto(row: DriverRow): DriverDto {
  const hasBase = row.base_address !== null && row.base_lat !== null && row.base_lng !== null;
  return {
    id: row.id,
    userId: row.user_id,
    carrierId: row.carrier_id,
    name: row.name,
    email: row.email,
    cnhNumber: row.cnh_number,
    cnhCategory: row.cnh_category,
    phone: row.phone,
    status: row.status,
    baseAddress: hasBase
      ? {
          address: row.base_address as string,
          lat: row.base_lat as number,
          lng: row.base_lng as number,
        }
      : null,
    ratingAvg: toNumberOrNull(row.rating_avg),
    invitePending: row.invite_pending,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
