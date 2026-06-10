// Wrapper das chamadas à API Helix da Twitch. `fetchImpl` é injetado para
// facilitar os testes (em produção passamos o `fetch` global).

import { HELIX_BASE } from './config.js';

export class ApiError extends Error {
  constructor(status, where) {
    super(`Erro da API da Twitch (${status}) em ${where}`);
    this.name = 'ApiError';
    this.status = status;
    this.where = where;
  }
}

export function buildHeaders(clientId, token) {
  return {
    'Client-Id': clientId,
    Authorization: `Bearer ${token}`,
  };
}

export function parseStreams(json) {
  if (!json || !Array.isArray(json.data)) return [];
  return json.data.map((s) => ({
    login: s.user_login,
    displayName: s.user_name,
    game: s.game_name,
    title: s.title,
    viewers: s.viewer_count,
    thumbnail: s.thumbnail_url,
  }));
}

export async function getCurrentUser(fetchImpl, clientId, token) {
  const res = await fetchImpl(`${HELIX_BASE}/users`, {
    headers: buildHeaders(clientId, token),
  });
  if (!res.ok) throw new ApiError(res.status, 'getCurrentUser');
  const json = await res.json();
  return json.data?.[0] ?? null;
}

export async function getFollowedLiveStreams(fetchImpl, clientId, token, userId) {
  const url = `${HELIX_BASE}/streams/followed?user_id=${encodeURIComponent(userId)}&first=100`;
  const res = await fetchImpl(url, { headers: buildHeaders(clientId, token) });
  if (!res.ok) throw new ApiError(res.status, 'getFollowedLiveStreams');
  return parseStreams(await res.json());
}
