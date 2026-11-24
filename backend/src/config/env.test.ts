import { describe, expect, it } from 'vitest';
import { apiDocsEnabled, loadEnv } from './env.js';

const validEnv = {
  DATABASE_URL: 'postgres://user:pass@localhost:5437/db',
  REDIS_URL: 'redis://localhost:6382',
};

describe('loadEnv', () => {
  it('should apply defaults when optional variables are missing', () => {
    const env = loadEnv(validEnv);
    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
  });

  it('should coerce PORT from string to number', () => {
    expect(loadEnv({ ...validEnv, PORT: '4000' }).PORT).toBe(4000);
  });

  it('should throw an error listing the invalid variable when DATABASE_URL is missing', () => {
    expect(() => loadEnv({ REDIS_URL: validEnv.REDIS_URL })).toThrow(/DATABASE_URL/);
  });
});

describe('apiDocsEnabled', () => {
  it('should enable docs by default only in development', () => {
    expect(apiDocsEnabled(loadEnv(validEnv))).toBe(true);
    expect(apiDocsEnabled(loadEnv({ ...validEnv, NODE_ENV: 'production' }))).toBe(false);
  });

  it('should respect an explicit API_DOCS_ENABLED value', () => {
    expect(apiDocsEnabled(loadEnv({ ...validEnv, API_DOCS_ENABLED: 'false' }))).toBe(false);
    expect(
      apiDocsEnabled(loadEnv({ ...validEnv, NODE_ENV: 'staging', API_DOCS_ENABLED: 'true' })),
    ).toBe(true);
  });
});
