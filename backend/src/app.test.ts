import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createLogger } from './lib/logger.js';

const logger = createLogger('silent');

function buildApp(postgresUp = true, redisUp = true) {
  return createApp({
    logger,
    corsOrigins: ['http://localhost:5173'],
    healthChecks: {
      postgres: () => (postgresUp ? Promise.resolve() : Promise.reject(new Error('down'))),
      redis: () => (redisUp ? Promise.resolve() : Promise.reject(new Error('down'))),
    },
  });
}

describe('GET /health', () => {
  it('should return 200 when all dependencies are up', async () => {
    const response = await request(buildApp()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('should return 503 when a dependency is down', async () => {
    const response = await request(buildApp(true, false)).get('/health');
    expect(response.status).toBe(503);
    expect(response.body.checks.redis).toBe('error');
  });
});

describe('request id', () => {
  it('should echo the incoming X-Request-Id header', async () => {
    const response = await request(buildApp()).get('/health').set('X-Request-Id', 'abc-123');
    expect(response.headers['x-request-id']).toBe('abc-123');
  });

  it('should generate a request id when none is sent', async () => {
    const response = await request(buildApp()).get('/health');
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('unknown routes', () => {
  it('should return 404 in the standard error format with the request id', async () => {
    const response = await request(buildApp()).get('/nao-existe');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });
});
