import type { Knex } from 'knex';

/**
 * Base dos repositories: guarda a conexão e permite executar várias operações
 * numa mesma transação sem que o service precise conhecer o Knex.
 *
 * `transaction(work)` entrega ao service uma cópia do repository ligada à transação;
 * se `work` lançar erro, tudo é desfeito (rollback).
 */
export abstract class BaseRepository<TRepository> {
  constructor(protected readonly db: Knex) {}

  /** Cria uma instância do mesmo repository usando outra conexão (a transação). */
  protected abstract withConnection(connection: Knex): TRepository;

  transaction<T>(work: (repository: TRepository) => Promise<T>): Promise<T> {
    return this.db.transaction((trx) => work(this.withConnection(trx)));
  }
}

/** Resultado de uma listagem paginada vinda do banco. */
export interface PagedRows<TRow> {
  rows: TRow[];
  total: number;
}

export interface PageFilter<TStatus> {
  status?: TStatus;
  limit: number;
  offset: number;
}
