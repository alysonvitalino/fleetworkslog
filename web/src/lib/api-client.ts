import type { ApiErrorBody } from '@fleetworkslog/shared';
import { env } from './env';

/** Erro de chamada à API com o corpo padrão ({ error: { code, message } }) quando disponível. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body: unknown;

  constructor(status: number, code: string, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ApiErrorBody).error?.code === 'string'
  );
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Status além de 2xx que devem ser tratados como resposta válida (ex.: 503 do /health) */
  acceptStatus?: number[];
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await fetch(`${env.apiUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'include',
    signal: options.signal,
  });

  const data: unknown = await response.json().catch(() => undefined);

  if (response.ok || options.acceptStatus?.includes(response.status)) {
    return data as T;
  }

  if (isApiErrorBody(data)) {
    throw new ApiError(response.status, data.error.code, data.error.message, data);
  }
  throw new ApiError(
    response.status,
    'HTTP_ERROR',
    `Falha na requisição (${response.status})`,
    data,
  );
}
