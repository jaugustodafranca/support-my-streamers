import { describe, it, expect, vi } from 'vitest';
import {
  parseStreams,
  parseFollowedChannels,
  buildHeaders,
  getFollowedLiveStreams,
  getFollowedChannels,
  getCurrentUser,
  ApiError,
} from '../src/twitchApi.js';

describe('buildHeaders', () => {
  it('builds Client-Id and Bearer headers', () => {
    expect(buildHeaders('cid', 'tok')).toEqual({
      'Client-Id': 'cid',
      Authorization: 'Bearer tok',
    });
  });
});

describe('parseStreams', () => {
  it('maps relevant fields', () => {
    const json = {
      data: [
        {
          user_login: 'foo',
          user_name: 'Foo',
          game_name: 'Chess',
          title: 'hello',
          viewer_count: 42,
          thumbnail_url: 'u',
        },
      ],
    };
    expect(parseStreams(json)).toEqual([
      { login: 'foo', displayName: 'Foo', game: 'Chess', title: 'hello', viewers: 42, thumbnail: 'u' },
    ]);
  });

  it('handles payload without data', () => {
    expect(parseStreams({})).toEqual([]);
    expect(parseStreams(null)).toEqual([]);
  });
});

describe('parseFollowedChannels', () => {
  it('maps broadcaster identity fields', () => {
    const json = {
      data: [
        {
          broadcaster_login: 'Foo',
          broadcaster_name: 'FooTV',
        },
      ],
    };

    expect(parseFollowedChannels(json)).toEqual([
      {
        login: 'foo',
        displayName: 'FooTV',
      },
    ]);
  });

  it('handles payload without data', () => {
    expect(parseFollowedChannels({})).toEqual([]);
    expect(parseFollowedChannels(null)).toEqual([]);
  });
});

describe('getFollowedLiveStreams', () => {
  it('calls correct endpoint and parses response', async () => {
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

  it('throws ApiError on non-ok response', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 401 }));
    await expect(getFollowedLiveStreams(fetchImpl, 'c', 't', '1')).rejects.toBeInstanceOf(ApiError);
    await expect(getFollowedLiveStreams(fetchImpl, 'c', 't', '1')).rejects.toMatchObject({
      status: 401,
    });
  });
});

describe('getCurrentUser', () => {
  it('returns first user from payload', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ id: '99', login: 'me', display_name: 'Me' }] }),
    }));
    const user = await getCurrentUser(fetchImpl, 'cid', 'tok');
    expect(user).toEqual({ id: '99', login: 'me', display_name: 'Me' });
  });
});

describe('getFollowedChannels', () => {
  it('paginates and returns all followed channels', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ broadcaster_login: 'foo', broadcaster_name: 'Foo' }],
          pagination: { cursor: 'abc' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ broadcaster_login: 'bar', broadcaster_name: 'Bar' }],
          pagination: {},
        }),
      });

    const followed = await getFollowedChannels(fetchImpl, 'cid', 'tok', '123');

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://api.twitch.tv/helix/channels/followed?user_id=123&first=100',
      { headers: { 'Client-Id': 'cid', Authorization: 'Bearer tok' } },
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://api.twitch.tv/helix/channels/followed?user_id=123&first=100&after=abc',
      { headers: { 'Client-Id': 'cid', Authorization: 'Bearer tok' } },
    );
    expect(followed).toEqual([
      { login: 'foo', displayName: 'Foo' },
      { login: 'bar', displayName: 'Bar' },
    ]);
  });

  it('throws ApiError on non-ok response', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500 }));
    await expect(getFollowedChannels(fetchImpl, 'c', 't', '1')).rejects.toBeInstanceOf(ApiError);
    await expect(getFollowedChannels(fetchImpl, 'c', 't', '1')).rejects.toMatchObject({
      status: 500,
    });
  });
});
