import type { HealthResponse } from '@fleetworkslog/shared';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { apiRequest } from '../../lib/api-client';
import { env } from '../../lib/env';

type Status = 'loading' | 'online' | 'degraded' | 'offline';

const labels: Record<Status, string> = {
  loading: 'Verificando API...',
  online: 'API online',
  degraded: 'API com falhas',
  offline: 'API offline',
};

const colors: Record<Status, string> = {
  loading: '#667085',
  online: '#12805c',
  degraded: '#b54708',
  offline: '#c01048',
};

export function ApiStatus() {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    apiRequest<HealthResponse>('/health', { acceptStatus: [503] })
      .then((health) => setStatus(health.status === 'ok' ? 'online' : 'degraded'))
      .catch(() => setStatus('offline'));
  }, []);

  return (
    <Text style={[styles.text, { color: colors[status] }]}>
      {labels[status]} ({env.apiUrl})
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 13 },
});
