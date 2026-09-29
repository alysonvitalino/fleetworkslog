// Cadastro de contas (signup) e perfil de empresa/transportadora.
// docs/02-modelo-de-dados.md — Autenticação e Perfis, Empresas e Transportadoras.
import type { Knex } from 'knex';
import {
  CompanyType,
  Role,
  type Address,
  type CompanyDto,
  type DriverDto,
} from '@fleetworkslog/shared';
import { toGeography } from '../db/geo.js';
import { AppError } from '../errors/app-error.js';
import { hashPassword } from '../lib/password.js';
import { companiesQuery, toCompanyDto, type CompanyRow } from '../models/account.model.js';
import type {
  SignupAutonomousDriverInput,
  SignupCarrierInput,
  SignupShipperInput,
  UpdateCompanyInput,
} from '../schemas/account.schema.js';
import { getDriver } from './driver.service.js';
import { insertUser, translateUniqueViolation } from './users.service.js';

export async function getCompany(db: Knex, companyId: string): Promise<CompanyDto> {
  const row = (await companiesQuery(db).where('c.id', companyId).first()) as CompanyRow | undefined;
  if (!row) throw AppError.notFound('Empresa não encontrada');
  return toCompanyDto(row);
}

// Transportadora guarda também o ponto (base_geo), usado na busca de cargas por raio
function addressColumns(db: Knex, type: CompanyType, address: Address | null) {
  return {
    address_json: address ? JSON.stringify(address) : null,
    base_geo: type === CompanyType.TRANSPORTADORA && address ? toGeography(db, address) : null,
  };
}

async function signupCompany(
  db: Knex,
  type: CompanyType,
  input: SignupShipperInput | SignupCarrierInput,
): Promise<CompanyDto> {
  // Hash fora da transação: é a parte cara e não precisa segurar conexão
  const passwordHash = await hashPassword(input.password);
  try {
    return await db.transaction(async (trx) => {
      const userId = await insertUser(trx, {
        name: input.name,
        email: input.email,
        role: type === CompanyType.EMPRESA ? Role.EMPRESA : Role.TRANSPORTADORA,
        passwordHash,
      });
      const [company] = await trx('companies')
        .insert({
          user_id: userId,
          type,
          legal_name: input.legalName,
          document: input.document,
          phone: input.phone ?? null,
          ...addressColumns(trx, type, input.address ?? null),
        })
        .returning<{ id: string }[]>('id');
      return getCompany(trx, (company as { id: string }).id);
    });
  } catch (error) {
    throw translateUniqueViolation(error);
  }
}

export const signupShipper = (db: Knex, input: SignupShipperInput) =>
  signupCompany(db, CompanyType.EMPRESA, input);

export const signupCarrier = (db: Knex, input: SignupCarrierInput) =>
  signupCompany(db, CompanyType.TRANSPORTADORA, input);

export async function signupAutonomousDriver(
  db: Knex,
  input: SignupAutonomousDriverInput,
): Promise<DriverDto> {
  const passwordHash = await hashPassword(input.password);
  try {
    return await db.transaction(async (trx) => {
      const userId = await insertUser(trx, {
        name: input.name,
        email: input.email,
        role: Role.MOTORISTA,
        passwordHash,
      });
      const [driver] = await trx('drivers')
        .insert({
          user_id: userId,
          carrier_id: null,
          cnh_number: input.cnhNumber,
          cnh_category: input.cnhCategory,
          phone: input.phone ?? null,
          base_address: input.baseAddress.address,
          base_geo: toGeography(trx, input.baseAddress),
        })
        .returning<{ id: string }[]>('id');
      return getDriver(trx, (driver as { id: string }).id);
    });
  } catch (error) {
    throw translateUniqueViolation(error);
  }
}

export async function updateCompany(
  db: Knex,
  companyId: string,
  input: UpdateCompanyInput,
): Promise<CompanyDto> {
  const current = await db('companies').where({ id: companyId }).first('type');
  if (!current) throw AppError.notFound('Empresa não encontrada');

  const changes: Record<string, unknown> = { updated_at: db.fn.now() };
  if (input.legalName !== undefined) changes.legal_name = input.legalName;
  if (input.phone !== undefined) changes.phone = input.phone ?? null;
  if (input.address !== undefined) {
    if (input.address === null && current.type === CompanyType.TRANSPORTADORA) {
      throw AppError.badRequest(
        'Transportadora precisa de endereço-base (usado na busca de cargas)',
      );
    }
    Object.assign(changes, addressColumns(db, current.type, input.address));
  }

  await db('companies').where({ id: companyId }).update(changes);
  return getCompany(db, companyId);
}
