import { useApiHealth } from './use-api-health';

type BadgeState = 'loading' | 'online' | 'degraded' | 'offline';

const labels: Record<BadgeState, string> = {
  loading: 'Verificando API...',
  online: 'API online',
  degraded: 'API com falhas',
  offline: 'API offline',
};

export function ApiStatusBadge() {
  const { data, isPending, isError } = useApiHealth();

  let state: BadgeState = 'loading';
  if (isError) state = 'offline';
  else if (!isPending) state = data?.status === 'ok' ? 'online' : 'degraded';

  return (
    <span className={`status-badge status-badge--${state}`} role="status">
      {labels[state]}
    </span>
  );
}
