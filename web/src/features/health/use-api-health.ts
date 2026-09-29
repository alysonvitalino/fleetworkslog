import type { HealthResponse } from '@fleetworkslog/shared';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';

export function useApiHealth() {
  return useQuery({
    queryKey: ['health'],
    // 503 também é uma resposta válida do /health (API no ar, dependência fora)
    queryFn: ({ signal }) => apiRequest<HealthResponse>('/health', { acceptStatus: [503], signal }),
    refetchInterval: 30_000,
    retry: false,
  });
}
