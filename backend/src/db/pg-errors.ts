// Códigos de erro do Postgres que a API traduz em 409 em vez de deixar virar 500.
// https://www.postgresql.org/docs/current/errcodes-appendix.html
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

interface PgError {
  code?: string;
  constraint?: string;
}

function asPgError(error: unknown): PgError | undefined {
  return typeof error === 'object' && error !== null ? (error as PgError) : undefined;
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const pgError = asPgError(error);
  return (
    pgError?.code === UNIQUE_VIOLATION &&
    (constraint === undefined || pgError.constraint === constraint)
  );
}

export function isForeignKeyViolation(error: unknown): boolean {
  return asPgError(error)?.code === FOREIGN_KEY_VIOLATION;
}
