import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

function readHtml(): string {
  // We don't start the server here; instead we verify the helmet config
  // in app.ts directly by inspecting the source. For runtime CSP tests
  // the Playwright smoke suite covers header assertions.
  return fs.readFileSync(path.join(ROOT, 'src/app.ts'), 'utf8');
}

describe('CSP configuration in app.ts', () => {
  const src = readHtml();

  it('uses nonce-based script-src in production', () => {
    expect(src).toContain('\'nonce-${nonce}\'');
    expect(src).toContain('\'strict-dynamic\'');
  });

  it('sets script-src-attr to unsafe-inline (documented fallback for inline handlers)', () => {
    expect(src).toMatch(/scriptSrcAttr:\s*\[[^\]]*\bunsafe-inline\b[^\]]*\]/);
  });

  it('sets frame-ancestors to none', () => {
    expect(src).toMatch(/frameAncestors:\s*\[[^\]]*\bnone\b[^\]]*\]/);
  });

  it('sets object-src to none', () => {
    expect(src).toMatch(/objectSrc:\s*\[[^\]]*\bnone\b[^\]]*\]/);
  });

  it('sets base-uri to self', () => {
    expect(src).toMatch(/baseUri:\s*\[[^\]]*\bself\b[^\]]*\]/);
  });

  it('sets form-action to self', () => {
    expect(src).toMatch(/formAction:\s*\[[^\]]*\bself\b[^\]]*\]/);
  });

  it('only applies CSP in production mode', () => {
    expect(src).toContain('contentSecurityPolicy: isProduction');
  });

  it('generates a fresh nonce per request', () => {
    expect(src).toContain('crypto.randomBytes(16).toString');
  });
});

// The daemon is a sibling repository. Skip these checks when it is not
// checked out next to the panel (e.g. in CI, which only has the panel repo).
const DAEMON_HMAC_PATH = path.join(ROOT, '..', 'daemon', 'src', 'security', 'hmac.ts');

describe.skipIf(!fs.existsSync(DAEMON_HMAC_PATH))(
  'Security headers in daemon hmac.ts',
  () => {
    // Skipped suites still run their callback during collection, so the
    // read itself must be guarded (no throw when the daemon is absent).
    const hmacSrc = fs.existsSync(DAEMON_HMAC_PATH)
      ? fs.readFileSync(DAEMON_HMAC_PATH, 'utf8')
      : '';

    it('sets X-Content-Type-Options to nosniff', () => {
      expect(hmacSrc).toContain('\'X-Content-Type-Options\'');
      expect(hmacSrc).toContain('\'nosniff\'');
    });

    it('sets X-Frame-Options to DENY', () => {
      expect(hmacSrc).toContain('\'X-Frame-Options\'');
      expect(hmacSrc).toContain('\'DENY\'');
    });

    it('sets Referrer-Policy to no-referrer', () => {
      expect(hmacSrc).toContain('\'Referrer-Policy\'');
      expect(hmacSrc).toContain('\'no-referrer\'');
    });

    it('sets Cache-Control to no-store', () => {
      expect(hmacSrc).toContain('\'Cache-Control\'');
      expect(hmacSrc).toContain('\'no-store\'');
    });
  },
);
