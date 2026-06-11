import { describe, it, expect } from 'vitest';
import { buildAuthUrl, parseAuthRedirect, isAuthExpired } from '../src/auth.js';

describe('buildAuthUrl', () => {
  it('inclui os parâmetros obrigatórios do implicit grant', () => {
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
  it('extrai o token do fragmento', () => {
    const r = parseAuthRedirect(
      'https://x.chromiumapp.org/#access_token=abc&token_type=bearer&expires_in=3600&scope=user%3Aread%3Afollows',
    );
    expect(r.accessToken).toBe('abc');
    expect(r.tokenType).toBe('bearer');
    expect(r.scope).toBe('user:read:follows');
    expect(typeof r.expiresAt).toBe('number');
  });

  it('lança erro quando o redirect traz erro', () => {
    expect(() =>
      parseAuthRedirect('https://x.chromiumapp.org/#error=access_denied&error_description=no'),
    ).toThrow(/access_denied|no/);
  });

  it('lança erro quando não há access_token', () => {
    expect(() => parseAuthRedirect('https://x.chromiumapp.org/')).toThrow();
  });
});

describe('isAuthExpired', () => {
  it('retorna false sem expiresAt', () => {
    expect(isAuthExpired({ accessToken: 'x' })).toBe(false);
  });

  it('retorna true quando expiresAt já passou', () => {
    expect(isAuthExpired({ expiresAt: Date.now() - 1000 })).toBe(true);
  });

  it('retorna false quando expiresAt ainda é válido', () => {
    expect(isAuthExpired({ expiresAt: Date.now() + 60_000 })).toBe(false);
  });
});
