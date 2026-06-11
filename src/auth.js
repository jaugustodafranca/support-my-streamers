// Twitch OAuth implicit grant — pure helpers only (chrome.identity lives in background.js).

import { TWITCH_AUTH_BASE, SCOPES } from './config.js';

export const buildAuthUrl = ({ clientId, redirectUri, scopes = SCOPES, state }) => {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: scopes.join(' '),
  });
  if (state) params.set('state', state);
  return `${TWITCH_AUTH_BASE}?${params.toString()}`;
};

export const parseAuthRedirect = (redirectUrl) => {
  if (!redirectUrl) {
    throw new Error(
      'Authentication was cancelled or the redirect URL is missing. If this keeps happening after reinstalling, add the extension Redirect URL in the Twitch Developer Console.',
    );
  }
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
};

export const isAuthExpired = (auth) => Boolean(auth?.expiresAt && Date.now() >= auth.expiresAt);
