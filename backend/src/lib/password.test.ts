import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('should verify the right password and reject a wrong one', async () => {
    const hash = await hashPassword('senha-forte-123');
    expect(await verifyPassword('senha-forte-123', hash)).toBe(true);
    expect(await verifyPassword('senha-errada', hash)).toBe(false);
  });

  it('should never store the password in plain text and use a random salt', async () => {
    const [first, second] = await Promise.all([hashPassword('mesma'), hashPassword('mesma')]);
    expect(first).not.toContain('mesma');
    expect(first).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(first).not.toBe(second);
  });

  it('should reject malformed hashes instead of throwing', async () => {
    expect(await verifyPassword('qualquer', 'bcrypt$abc')).toBe(false);
    expect(await verifyPassword('qualquer', '')).toBe(false);
  });
});
