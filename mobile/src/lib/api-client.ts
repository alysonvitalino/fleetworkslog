import type { ApiErrorBody } from '@fleetworkslog/shared';
import { env } from './env';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
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
  accessToken?: string | null;
  /** Status além de 2xx tratados como resposta válida (ex.: 503 do /health) */
  acceptStatus?: number[];
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;

  const response = await fetch(`${env.apiUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const data: unknown = await response.json().catch(() => undefined);

  if (response.ok || options.acceptStatus?.includes(response.status)) {
    return data as T;
  }
  if (isApiErrorBody(data)) {
    throw new ApiError(response.status, data.error.code, data.error.message);
  }
  throw new ApiError(response.status, 'HTTP_ERROR', `Falha na requisição (${response.status})`);
}
