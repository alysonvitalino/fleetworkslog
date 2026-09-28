import type { HealthResponse, ServiceStatus } from '@fleetworkslog/shared';

export type HealthCheck = () => Promise<unknown>;

export interface HealthChecks {
  postgres: HealthCheck;
  redis: HealthCheck;
}

const CHECK_TIMEOUT_MS = 2000;

// Um check travado não pode travar o /health inteiro
async function runCheck(check: HealthCheck): Promise<ServiceStatus> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS);
  });
  try {
    await Promise.race([check(), timeout]);
    return 'ok';
  } catch {
    return 'error';
  } finally {
    clearTimeout(timer);
  }
}

export async function getHealth(checks: HealthChecks): Promise<HealthResponse> {
  const [postgres, redis] = await Promise.all([runCheck(checks.postgres), runCheck(checks.redis)]);
  return {
    status: postgres === 'ok' && redis === 'ok' ? 'ok' : 'error',
    uptimeSeconds: Math.round(process.uptime()),
    checks: { postgres, redis },
  };
}
