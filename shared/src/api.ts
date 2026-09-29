// Contratos HTTP compartilhados (request/response).

export type ServiceStatus = 'ok' | 'error';

export interface HealthResponse {
  status: ServiceStatus;
  uptimeSeconds: number;
  checks: {
    postgres: ServiceStatus;
    redis: ServiceStatus;
  };
}

/** Formato padrão de erro devolvido pela API em qualquer status 4xx/5xx. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
  };
}

/** Resposta padrão das listagens paginadas (`?limit=&offset=`). */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
