import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './api-client';

function mockFetch(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('apiRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return the parsed body on 2xx', async () => {
    mockFetch(200, { hello: 'world' });
    await expect(apiRequest('/x')).resolves.toEqual({ hello: 'world' });
  });

  it('should send JSON body and credentials on POST', async () => {
    const fetchMock = mockFetch(201, {});
    await apiRequest('/x', { method: 'POST', body: { a: 1 } });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.body).toBe('{"a":1}');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.credentials).toBe('include');
  });

  it('should throw ApiError with the API error code when the body follows the standard format', async () => {
    mockFetch(409, { error: { code: 'CONFLICT', message: 'Carga já aceita' } });
    await expect(apiRequest('/x')).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'Carga já aceita',
    });
  });

  it('should throw a generic ApiError when the error body is not in the standard format', async () => {
    mockFetch(502, { unexpected: true });
    const error = await apiRequest('/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('HTTP_ERROR');
  });

  it('should treat accepted non-2xx statuses as valid responses', async () => {
    mockFetch(503, { status: 'error' });
    await expect(apiRequest('/health', { acceptStatus: [503] })).resolves.toEqual({
      status: 'error',
    });
  });
});
