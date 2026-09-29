import type { Knex } from 'knex';
import type { Role } from '@fleetworkslog/shared';
import { isUniqueViolation } from '../db/pg-errors.js';
import { AppError } from '../errors/app-error.js';

const UNIQUE_MESSAGES: Record<string, string> = {
  users_email_lower_unique: 'E-mail já cadastrado',
  companies_document_unique: 'CNPJ já cadastrado',
  drivers_cnh_number_unique: 'CNH já cadastrada',
};

/** Troca violação de unicidade conhecida (e-mail, CNPJ, CNH) por um 409 legível. */
export function translateUniqueViolation(error: unknown): unknown {
  for (const [constraint, message] of Object.entries(UNIQUE_MESSAGES)) {
    if (isUniqueViolation(error, constraint)) return AppError.conflict(message);
  }
  return error;
}

/** `passwordHash` nulo = motorista convidado que ainda vai definir a senha pelo convite. */
export async function insertUser(
  trx: Knex.Transaction,
  user: { name: string; email: string; role: Role; passwordHash: string | null },
): Promise<string> {
  const [row] = await trx('users')
    .insert({
      name: user.name,
      email: user.email,
      role: user.role,
      password_hash: user.passwordHash,
    })
    .returning<{ id: string }[]>('id');
  return (row as { id: string }).id;
}
