import { describe, it, expect } from 'vitest';
import { isValidAddonSlug } from '../src/handlers/addonViewResolver';

describe('isValidAddonSlug', () => {
  it('accepts well-formed slugs', () => {
    expect(isValidAddonSlug('demo-addon')).toBe(true);
    expect(isValidAddonSlug('a')).toBe(true);
    expect(isValidAddonSlug('my-addon-123')).toBe(true);
  });

  it('rejects unsafe or malformed slugs', () => {
    expect(isValidAddonSlug('..')).toBe(false);
    expect(isValidAddonSlug('.')).toBe(false);
    expect(isValidAddonSlug('a/../../etc')).toBe(false);
    expect(isValidAddonSlug('has spaces')).toBe(false);
    expect(isValidAddonSlug('UPPERCASE')).toBe(false);
    expect(isValidAddonSlug('')).toBe(false);
    expect(isValidAddonSlug('a'.repeat(49))).toBe(false);
    expect(isValidAddonSlug(42)).toBe(false);
    expect(isValidAddonSlug(null)).toBe(false);
  });
});
