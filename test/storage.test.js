import { describe, it, expect } from 'vitest';
import {
  getSettings,
  setSettings,
  getRotation,
  setRotation,
  getAuth,
  setAuth,
  clearAuth,
} from '../src/storage.js';

const fakeArea = () => {
  const data = {};
  return {
    async get(key) {
      return key in data ? { [key]: data[key] } : {};
    },
    async set(obj) {
      Object.assign(data, obj);
    },
    async remove(key) {
      delete data[key];
    },
  };
}

describe('settings', () => {
  it('returns defaults when empty', async () => {
    expect(await getSettings(fakeArea())).toEqual({
      intervalMinutes: 10,
      audio: 'muted',
      lang: 'pt',
    });
  });

  it('merges saved values over defaults', async () => {
    const area = fakeArea();
    await setSettings({ intervalMinutes: 5 }, area);
    const settings = await getSettings(area);
    expect(settings.intervalMinutes).toBe(5);
    expect(settings.audio).toBe('muted');
    expect(settings.lang).toBe('pt');
  });
});

describe('rotation', () => {
  it('defaults to stopped and empty channels', async () => {
    expect(await getRotation(fakeArea())).toEqual({
      channels: [],
      queueOrder: [],
      status: 'stopped',
    });
  });

  it('persists selected channels', async () => {
    const area = fakeArea();
    await setRotation({ channels: ['a', 'b'], status: 'playing' }, area);
    expect((await getRotation(area)).channels).toEqual(['a', 'b']);
  });
});

describe('auth', () => {
  it('is null by default, then saves and clears', async () => {
    const area = fakeArea();
    expect(await getAuth(area, null)).toBeNull();
    await setAuth({ accessToken: 't' }, area);
    expect((await getAuth(area, null)).accessToken).toBe('t');
    await clearAuth(area, null);
    expect(await getAuth(area, null)).toBeNull();
  });

  it('migrates auth from legacy local store to session store', async () => {
    const session = fakeArea();
    const legacy = fakeArea();
    await setAuth({ accessToken: 'legacy-token' }, legacy);

    const auth = await getAuth(session, legacy);
    expect(auth.accessToken).toBe('legacy-token');
    expect((await getAuth(session, null)).accessToken).toBe('legacy-token');
    expect(await getAuth(legacy, null)).toBeNull();
  });
});
