// Twitch OAuth implicit grant. Pure helpers are testable; launchTwitchAuth uses chrome.identity.

import { TWITCH_AUTH_BASE, SCOPES } from './config.js';

export function buildAuthUrl({ clientId, redirectUri, scopes = SCOPES, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: scopes.join(' '),
  });
  if (state) params.set('state', state);
  return `${TWITCH_AUTH_BASE}?${params.toString()}`;
}

export function parseAuthRedirect(redirectUrl) {
  const fragment = redirectUrl.includes('#') ? redirectUrl.split('#')[1] : '';
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  if (!accessToken) {
    const reason =
      params.get('error_description') || params.get('error') || 'missing access_token in response';
    throw new Error(`Authentication failed: ${reason}`);
  }
  const expiresIn = Number(params.get('expires_in') || 0);
  return {
    accessToken,
    scope: params.get('scope') || '',
    tokenType: params.get('token_type') || 'bearer',
    expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
  };
}

export function isAuthExpired(auth) {
  return Boolean(auth?.expiresAt && Date.now() >= auth.expiresAt);
}

export async function launchTwitchAuth(clientId) {
  const redirectUri = chrome.identity.getRedirectURL();
  const url = buildAuthUrl({ clientId, redirectUri });
  const redirect = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
  return parseAuthRedirect(redirect);
}
