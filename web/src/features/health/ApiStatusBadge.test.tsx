import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiStatusBadge } from './ApiStatusBadge';

function renderBadge() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ApiStatusBadge />
    </QueryClientProvider>,
  );
}

function mockHealth(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

describe('ApiStatusBadge', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should show online when the API reports ok', async () => {
    mockHealth(200, { status: 'ok', uptimeSeconds: 1, checks: { postgres: 'ok', redis: 'ok' } });
    renderBadge();
    expect(await screen.findByText('API online')).toBeInTheDocument();
  });

  it('should show degraded when the API answers 503', async () => {
    mockHealth(503, {
      status: 'error',
      uptimeSeconds: 1,
      checks: { postgres: 'ok', redis: 'error' },
    });
    renderBadge();
    expect(await screen.findByText('API com falhas')).toBeInTheDocument();
  });

  it('should show offline when the API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderBadge();
    expect(await screen.findByText('API offline')).toBeInTheDocument();
  });
});
