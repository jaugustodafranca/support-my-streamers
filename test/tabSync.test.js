import { describe, it, expect } from 'vitest';
import {
  parseChannelLogin,
  nextReplacement,
  decideTabAction,
  unshownLive,
} from '../src/rotation.js';

describe('parseChannelLogin', () => {
  it('extrai login de URL de canal', () => {
    expect(parseChannelLogin('https://www.twitch.tv/StreamerOne')).toBe('streamerone');
    expect(parseChannelLogin('https://twitch.tv/StreamerOne/live')).toBe('streamerone');
  });

  it('retorna null para URLs que não são canal', () => {
    expect(parseChannelLogin('https://www.twitch.tv/directory')).toBeNull();
    expect(parseChannelLogin('https://google.com')).toBeNull();
  });
});

describe('nextReplacement', () => {
  it('retorna o primeiro ao vivo ainda não ocupado', () => {
    expect(nextReplacement(['a', 'b', 'c'], ['a'])).toBe('b');
    expect(nextReplacement(['a', 'b'], ['a', 'b'])).toBeNull();
  });
});

describe('decideTabAction', () => {
  it('mantém quando o apoiado ainda está ao vivo na aba certa', () => {
    expect(
      decideTabAction({ supportedLogin: 'a', currentLogin: 'a', live: ['a', 'b'], taken: [] }),
    ).toEqual({ action: 'keep', login: 'a' });
  });

  it('volta para o apoiado se ele ainda está ao vivo mas a aba foi de raid', () => {
    expect(
      decideTabAction({ supportedLogin: 'a', currentLogin: 'raid', live: ['a'], taken: [] }),
    ).toEqual({ action: 'navigate', login: 'a' });
  });

  it('troca para outro ao vivo quando o apoiado saiu do ar', () => {
    expect(
      decideTabAction({ supportedLogin: 'a', currentLogin: 'a', live: ['b'], taken: [] }),
    ).toEqual({ action: 'navigate', login: 'b' });
  });

  it('mantém na página do apoiado quando offline e sem substituto', () => {
    expect(
      decideTabAction({ supportedLogin: 'a', currentLogin: 'a', live: [], taken: [] }),
    ).toEqual({ action: 'keep', login: 'a' });
  });

  it('fecha quando offline, sem substituto e a aba está em raid', () => {
    expect(
      decideTabAction({ supportedLogin: 'a', currentLogin: 'raid', live: [], taken: [] }),
    ).toEqual({ action: 'close' });
  });
});

describe('unshownLive', () => {
  it('retorna ao vivo da lista que ainda não tem aba', () => {
    expect(unshownLive(['a', 'b', 'c'], ['a'], 2)).toEqual(['b']);
    expect(unshownLive(['a', 'b'], ['a', 'b'], 2)).toEqual([]);
  });
});
