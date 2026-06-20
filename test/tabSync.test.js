import { describe, it, expect } from 'vitest';
import {
  parseChannelLogin,
  nextReplacement,
  decideTabAction,
  unshownLive,
} from '../src/rotation.js';

describe('parseChannelLogin', () => {
  it('extracts login from channel URL', () => {
    expect(parseChannelLogin('https://www.twitch.tv/StreamerOne')).toBe('streamerone');
    expect(parseChannelLogin('https://twitch.tv/StreamerOne/live')).toBe('streamerone');
  });

  it('returns null for non-channel URLs', () => {
    expect(parseChannelLogin('https://www.twitch.tv/directory')).toBeNull();
    expect(parseChannelLogin('https://google.com')).toBeNull();
  });
});

describe('nextReplacement', () => {
  it('returns first live channel not yet taken', () => {
    expect(nextReplacement(['a', 'b', 'c'], ['a'])).toBe('b');
    expect(nextReplacement(['a', 'b'], ['a', 'b'])).toBeNull();
  });
});

describe('decideTabAction', () => {
  it('keeps tab when supported channel is live on correct page', () => {
    expect(
      decideTabAction({ supportedLogin: 'a', currentLogin: 'a', live: ['a', 'b'], taken: [] }),
    ).toEqual({ action: 'keep', login: 'a' });
  });

  it('navigates back when supported is live but tab is on raid', () => {
    expect(
      decideTabAction({ supportedLogin: 'a', currentLogin: 'raid', live: ['a'], taken: [] }),
    ).toEqual({ action: 'navigate', login: 'a' });
  });

  it('swaps to another live channel when supported went offline', () => {
    expect(
      decideTabAction({ supportedLogin: 'a', currentLogin: 'a', live: ['b'], taken: [] }),
    ).toEqual({ action: 'navigate', login: 'b' });
  });

  it('keeps supported offline page when no replacement', () => {
    expect(
      decideTabAction({ supportedLogin: 'a', currentLogin: 'a', live: [], taken: [] }),
    ).toEqual({ action: 'keep', login: 'a' });
  });

  it('closes tab on raid when offline with no replacement', () => {
    expect(
      decideTabAction({ supportedLogin: 'a', currentLogin: 'raid', live: [], taken: [] }),
    ).toEqual({ action: 'close' });
  });

  it('avoids duplicate live channel assignments when already taken', () => {
    expect(
      decideTabAction({ supportedLogin: 'a', currentLogin: 'a', live: ['a', 'b'], taken: ['a'] }),
    ).toEqual({ action: 'navigate', login: 'b' });
  });

  it('closes duplicate live tab when no replacement exists', () => {
    expect(
      decideTabAction({ supportedLogin: 'a', currentLogin: 'a', live: ['a'], taken: ['a'] }),
    ).toEqual({ action: 'close' });
  });

  it('replaces removed selected channel when another live option exists', () => {
    expect(
      decideTabAction({
        supportedLogin: 'a',
        currentLogin: 'a',
        live: ['b', 'c'],
        taken: [],
        selectedChannels: ['b', 'c'],
      }),
    ).toEqual({ action: 'navigate', login: 'b' });
  });

  it('closes removed selected channel when no replacement exists', () => {
    expect(
      decideTabAction({
        supportedLogin: 'a',
        currentLogin: 'a',
        live: [],
        taken: [],
        selectedChannels: [],
      }),
    ).toEqual({ action: 'close' });
  });
});

describe('unshownLive', () => {
  it('returns live list channels without a tab yet', () => {
    expect(unshownLive(['a', 'b', 'c'], ['a'], 2)).toEqual(['b']);
    expect(unshownLive(['a', 'b'], ['a', 'b'], 2)).toEqual([]);
  });

  it('does not open extra tabs when shown contains duplicates', () => {
    expect(unshownLive(['a', 'b'], ['a', 'a'], 2)).toEqual([]);
  });
});
