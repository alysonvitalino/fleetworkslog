import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHealth } from './health.service.js';

const ok = () => Promise.resolve();
const fail = () => Promise.reject(new Error('down'));

describe('getHealth', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return ok when postgres and redis respond', async () => {
    const health = await getHealth({ postgres: ok, redis: ok });
    expect(health.status).toBe('ok');
    expect(health.checks).toEqual({ postgres: 'ok', redis: 'ok' });
  });

  it('should return error and point to the failing service when postgres is down', async () => {
    const health = await getHealth({ postgres: fail, redis: ok });
    expect(health.status).toBe('error');
    expect(health.checks).toEqual({ postgres: 'error', redis: 'ok' });
  });

  it('should mark a check as error when it hangs longer than the timeout', async () => {
    vi.useFakeTimers();
    const hanging = () => new Promise(() => {});
    const pending = getHealth({ postgres: ok, redis: hanging });
    await vi.advanceTimersByTimeAsync(2500);
    const health = await pending;
    expect(health.checks.redis).toBe('error');
  });
});
