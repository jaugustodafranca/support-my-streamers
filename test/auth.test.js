import { describe, it, expect } from 'vitest';
import { buildAuthUrl, parseAuthRedirect, isAuthExpired } from '../src/auth.js';

describe('buildAuthUrl', () => {
  it('includes required implicit grant parameters', () => {
    const url = buildAuthUrl({
      clientId: 'cid',
      redirectUri: 'https://x.chromiumapp.org/',
      scopes: ['user:read:follows'],
    });
    expect(url).toContain('https://id.twitch.tv/oauth2/authorize?');
    expect(url).toContain('client_id=cid');
    expect(url).toContain('response_type=token');
    expect(url).toContain('scope=user%3Aread%3Afollows');
    expect(url).toContain('redirect_uri=https%3A%2F%2Fx.chromiumapp.org%2F');
  });
});

describe('parseAuthRedirect', () => {
  it('extracts token from fragment', () => {
    const r = parseAuthRedirect(
      'https://x.chromiumapp.org/#access_token=abc&token_type=bearer&expires_in=3600&scope=user%3Aread%3Afollows',
    );
    expect(r.accessToken).toBe('abc');
    expect(r.tokenType).toBe('bearer');
    expect(r.scope).toBe('user:read:follows');
    expect(typeof r.expiresAt).toBe('number');
  });

  it('throws when redirect contains error', () => {
    expect(() =>
      parseAuthRedirect('https://x.chromiumapp.org/#error=access_denied&error_description=no'),
    ).toThrow(/access_denied|no/);
  });

  it('throws when access_token is missing', () => {
    expect(() => parseAuthRedirect('https://x.chromiumapp.org/')).toThrow();
  });

  it('throws when redirect URL is missing', () => {
    expect(() => parseAuthRedirect(undefined)).toThrow(/cancelled|redirect/i);
  });
});

describe('isAuthExpired', () => {
  it('returns false without expiresAt', () => {
    expect(isAuthExpired({ accessToken: 'x' })).toBe(false);
  });

  it('returns true when expiresAt is in the past', () => {
    expect(isAuthExpired({ expiresAt: Date.now() - 1000 })).toBe(true);
  });

  it('returns false when expiresAt is still valid', () => {
    expect(isAuthExpired({ expiresAt: Date.now() + 60_000 })).toBe(false);
  });
});
