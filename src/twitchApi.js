// Twitch Helix API wrapper. fetchImpl is injected for tests (global fetch in production).

import { HELIX_BASE } from './config.js';

export class ApiError extends Error {
  constructor(status, where) {
    super(`Twitch API error (${status}) at ${where}`);
    this.name = 'ApiError';
    this.status = status;
    this.where = where;
  }
}

export const buildHeaders = (clientId, token) => ({
  'Client-Id': clientId,
  Authorization: `Bearer ${token}`,
});

export const parseStreams = (json) => {
  if (!json || !Array.isArray(json.data)) return [];
  return json.data.map((stream) => ({
    login: stream.user_login,
    displayName: stream.user_name,
    game: stream.game_name,
    title: stream.title,
    viewers: stream.viewer_count,
    thumbnail: stream.thumbnail_url,
  }));
};

export const getCurrentUser = async (fetchImpl, clientId, token) => {
  const res = await fetchImpl(`${HELIX_BASE}/users`, {
    headers: buildHeaders(clientId, token),
  });
  if (!res.ok) throw new ApiError(res.status, 'getCurrentUser');
  const json = await res.json();
  return json.data?.[0] ?? null;
};

export const getFollowedLiveStreams = async (fetchImpl, clientId, token, userId) => {
  const url = `${HELIX_BASE}/streams/followed?user_id=${encodeURIComponent(userId)}&first=100`;
  const res = await fetchImpl(url, { headers: buildHeaders(clientId, token) });
  if (!res.ok) throw new ApiError(res.status, 'getFollowedLiveStreams');
  return parseStreams(await res.json());
};

const FOLLOWED_CHANNELS_PAGE_SIZE = 100;
const FOLLOWED_CHANNELS_MAX_PAGES = 20;

export const parseFollowedChannels = (json) => {
  if (!json || !Array.isArray(json.data)) return [];
  return json.data.map((followed) => ({
    login: String(followed.broadcaster_login || '').toLowerCase(),
    displayName: followed.broadcaster_name || followed.broadcaster_login || '',
  }));
};

const appendAfterCursor = (baseUrl, cursor) => {
  if (!cursor) return baseUrl;
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}after=${encodeURIComponent(cursor)}`;
};

export const getFollowedChannels = async (fetchImpl, clientId, token, userId) => {
  const baseUrl = `${HELIX_BASE}/channels/followed?user_id=${encodeURIComponent(userId)}&first=${FOLLOWED_CHANNELS_PAGE_SIZE}`;
  const headers = buildHeaders(clientId, token);
  const channels = [];
  let cursor = null;

  for (let page = 0; page < FOLLOWED_CHANNELS_MAX_PAGES; page++) {
    const url = appendAfterCursor(baseUrl, cursor);
    const res = await fetchImpl(url, { headers });
    if (!res.ok) throw new ApiError(res.status, 'getFollowedChannels');
    const json = await res.json();
    channels.push(...parseFollowedChannels(json));
    cursor = json?.pagination?.cursor || null;
    if (!cursor) break;
  }

  return channels;
};
