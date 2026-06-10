import { describe, it, expect, vi } from 'vitest';
import {
  parseStreams,
  buildHeaders,
  getFollowedLiveStreams,
  getCurrentUser,
  ApiError,
} from '../src/twitchApi.js';

describe('buildHeaders', () => {
  it('monta Client-Id e Bearer', () => {
    expect(buildHeaders('cid', 'tok')).toEqual({
      'Client-Id': 'cid',
      Authorization: 'Bearer tok',
    });
  });
});

describe('parseStreams', () => {
  it('mapeia os campos relevantes', () => {
    const json = {
      data: [
        {
          user_login: 'foo',
          user_name: 'Foo',
          game_name: 'Chess',
          title: 'oi',
          viewer_count: 42,
          thumbnail_url: 'u',
        },
      ],
    };
    expect(parseStreams(json)).toEqual([
      { login: 'foo', displayName: 'Foo', game: 'Chess', title: 'oi', viewers: 42, thumbnail: 'u' },
    ]);
  });

  it('lida com payload sem data', () => {
    expect(parseStreams({})).toEqual([]);
    expect(parseStreams(null)).toEqual([]);
  });
});

describe('getFollowedLiveStreams', () => {
  it('chama o endpoint certo e parseia', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ user_login: 'a', user_name: 'A', viewer_count: 1 }] }),
    }));
    const res = await getFollowedLiveStreams(fetchImpl, 'cid', 'tok', '123');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.twitch.tv/helix/streams/followed?user_id=123&first=100',
      { headers: { 'Client-Id': 'cid', Authorization: 'Bearer tok' } },
    );
    expect(res[0].login).toBe('a');
  });

  it('lança ApiError em resposta não-ok', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401 }));
    await expect(getFollowedLiveStreams(fetchImpl, 'c', 't', '1')).rejects.toBeInstanceOf(ApiError);
    await expect(getFollowedLiveStreams(fetchImpl, 'c', 't', '1')).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe('getCurrentUser', () => {
  it('retorna o primeiro usuário do payload', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ id: '99', login: 'me', display_name: 'Me' }] }),
    }));
    const user = await getCurrentUser(fetchImpl, 'cid', 'tok');
    expect(user).toEqual({ id: '99', login: 'me', display_name: 'Me' });
  });
});
