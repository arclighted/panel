import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  authValidationErrorCode,
} from '../src/modules/auth/schemas';

describe('loginSchema', () => {
  it('accepts a valid identifier + password', () => {
    const r = loginSchema.safeParse({ identifier: 'admin@example.com', password: 'secret' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({ identifier: 'admin@example.com', password: 'secret' });
    }
  });

  it('rejects missing fields', () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
    expect(loginSchema.safeParse({ identifier: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ password: 'x' }).success).toBe(false);
  });

  it('rejects empty strings', () => {
    const r = loginSchema.safeParse({ identifier: '', password: '' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.every((i) => i.message === 'missing')).toBe(true);
    }
  });
});

describe('registerSchema', () => {
  it('accepts valid credentials', () => {
    const r = registerSchema.safeParse({
      email: 'user@example.com',
      username: 'alice',
      password: 'password1',
    });
    expect(r.success).toBe(true);
  });

  it('rejects missing credentials with the missing code', () => {
    const r = registerSchema.safeParse({ email: 'a@b.co' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(authValidationErrorCode(r.error.issues)).toBe('missing');
    }
  });

  it('rejects invalid email or password with invalid_input', () => {
    const r = registerSchema.safeParse({
      email: 'not-an-email',
      username: 'alice',
      password: 'password1',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(authValidationErrorCode(r.error.issues)).toBe('invalid_input');
    }

    const r2 = registerSchema.safeParse({
      email: 'user@example.com',
      username: 'alice',
      password: 'short',
    });
    expect(r2.success).toBe(false);
    if (!r2.success) {
      expect(authValidationErrorCode(r2.error.issues)).toBe('invalid_input');
    }
  });

  it('rejects invalid username with invalid_username', () => {
    const r = registerSchema.safeParse({
      email: 'user@example.com',
      username: 'a b c',
      password: 'password1',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(authValidationErrorCode(r.error.issues)).toBe('invalid_username');
    }
  });

  it('prefers the missing code over format codes', () => {
    const r = registerSchema.safeParse({ email: 'not-an-email', username: 'alice' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(authValidationErrorCode(r.error.issues)).toBe('missing');
    }
  });
});
