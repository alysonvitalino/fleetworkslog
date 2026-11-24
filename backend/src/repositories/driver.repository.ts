import type { Knex } from 'knex';
import { DriverStatus, Role } from '@fleetworkslog/shared';
import { toGeography } from '../db/geo.js';
import { driversQuery, type DriverRow } from '../models/account.model.js';
import type {
  CreateCarrierDriverInput,
  UpdateAutonomousDriverInput,
} from '../schemas/account.schema.js';
import { BaseRepository, type PageFilter, type PagedRows } from './base.repository.js';

/** A transportadora gerencia os motoristas da frota; o autônomo gerencia a si mesmo. */
export type DriverScope = { type: 'carrier'; carrierId: string } | { type: 'autonomous' };

export interface DriverStatusRow {
  id: string;
  carrier_id: string | null;
  status: DriverStatus;
  updated_at: Date;
}

const STATUS_COLUMNS = ['id', 'carrier_id', 'status', 'updated_at'] as const;

/** Acesso às tabelas `drivers` e `users` (o nome e o e-mail do motorista ficam em `users`). */
export class DriverRepository extends BaseRepository<DriverRepository> {
  protected withConnection(connection: Knex): DriverRepository {
    return new DriverRepository(connection);
  }

  /** Motorista com os dados do usuário; com `scope`, só se pertencer a ele. */
  async findById(driverId: string, scope?: DriverScope): Promise<DriverRow | undefined> {
    const query = driversQuery(this.db).where('d.id', driverId);
    if (scope?.type === 'carrier') query.where('d.carrier_id', scope.carrierId);
    if (scope?.type === 'autonomous') query.whereNull('d.carrier_id');
    return (await query.first()) as DriverRow | undefined;
  }

  async listByCarrier(
    carrierId: string,
    filter: PageFilter<DriverStatus>,
  ): Promise<PagedRows<DriverRow>> {
    const applyFilter = (qb: Knex.QueryBuilder) => {
      qb.where('d.carrier_id', carrierId);
      if (filter.status) qb.where('d.status', filter.status);
    };

    const [rows, countRow] = await Promise.all([
      driversQuery(this.db)
        .modify(applyFilter)
        .orderBy('u.name')
        .limit(filter.limit)
        .offset(filter.offset),
      this.db('drivers as d').modify(applyFilter).count<{ count: string }>({ count: '*' }).first(),
    ]);
    return { rows, total: Number(countRow?.count ?? 0) };
  }

  async existsInScope(scope: DriverScope, driverId: string): Promise<boolean> {
    return (await this.scopedQuery(scope, driverId).first('id')) !== undefined;
  }

  /**
   * Altera o status só se o motorista não estiver EM_VIAGEM. O filtro no próprio UPDATE
   * evita corrida com uma coleta acontecendo ao mesmo tempo.
   */
  async updateStatusUnlessInTrip(
    scope: DriverScope,
    driverId: string,
    status: DriverStatus,
  ): Promise<DriverStatusRow | undefined> {
    const [row] = await this.scopedQuery(scope, driverId)
      .whereNot({ status: DriverStatus.EM_VIAGEM })
      .update({ status, updated_at: this.db.fn.now() })
      .returning(STATUS_COLUMNS);
    return row as DriverStatusRow | undefined;
  }

  /**
   * Cria o usuário (sem senha, pendente de convite) e o motorista da frota.
   * Escreve em duas tabelas: chame dentro de `transaction()`.
   */
  async createForCarrier(carrierId: string, input: CreateCarrierDriverInput): Promise<string> {
    const [user] = await this.db('users')
      .insert({
        name: input.name,
        email: input.email,
        role: Role.MOTORISTA,
        password_hash: null,
      })
      .returning<{ id: string }[]>('id');
    const [driver] = await this.db('drivers')
      .insert({
        user_id: (user as { id: string }).id,
        carrier_id: carrierId,
        cnh_number: input.cnhNumber,
        cnh_category: input.cnhCategory,
        phone: input.phone ?? null,
      })
      .returning<{ id: string }[]>('id');
    return (driver as { id: string }).id;
  }

  /**
   * Aplica a edição de perfil: nome fica em `users`, o resto em `drivers`.
   * Escreve em duas tabelas: chame dentro de `transaction()`.
   */
  async updateProfile(driver: DriverRow, input: UpdateAutonomousDriverInput): Promise<void> {
    if (input.name !== undefined) {
      await this.db('users')
        .where({ id: driver.user_id })
        .update({ name: input.name, updated_at: this.db.fn.now() });
    }

    const changes: Record<string, unknown> = { updated_at: this.db.fn.now() };
    if (input.cnhNumber !== undefined) changes.cnh_number = input.cnhNumber;
    if (input.cnhCategory !== undefined) changes.cnh_category = input.cnhCategory;
    if (input.phone !== undefined) changes.phone = input.phone ?? null;
    if (input.baseAddress !== undefined) {
      changes.base_address = input.baseAddress.address;
      changes.base_geo = toGeography(this.db, input.baseAddress);
    }
    await this.db('drivers').where({ id: driver.id }).update(changes);
  }

  /** Remove o motorista e o usuário dele. Chame dentro de `transaction()`. */
  async deleteWithUser(driver: DriverRow): Promise<void> {
    await this.db('drivers').where({ id: driver.id }).delete();
    await this.db('users').where({ id: driver.user_id }).delete();
  }

  private scopedQuery(scope: DriverScope, driverId: string) {
    const query = this.db('drivers').where({ id: driverId });
    return scope.type === 'carrier'
      ? query.where({ carrier_id: scope.carrierId })
      : query.whereNull('carrier_id');
  }
}
