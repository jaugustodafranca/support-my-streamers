import { describe, it, expect } from 'vitest';
import {
  getSettings,
  setSettings,
  getRotation,
  setRotation,
  getClientId,
  setClientId,
  getAuth,
  setAuth,
  clearAuth,
} from '../src/storage.js';

// Fake da área de storage do Chrome (get aceita uma chave string).
function fakeArea() {
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
  it('retorna defaults quando vazio', async () => {
    expect(await getSettings(fakeArea())).toEqual({
      intervalMinutes: 10,
      slots: 2,
      audio: 'muted',
    });
  });

  it('mescla o salvo sobre os defaults', async () => {
    const area = fakeArea();
    await setSettings({ intervalMinutes: 5 }, area);
    const s = await getSettings(area);
    expect(s.intervalMinutes).toBe(5);
    expect(s.slots).toBe(2);
  });
});

describe('rotation', () => {
  it('default é stopped e vazio', async () => {
    expect(await getRotation(fakeArea())).toEqual({ channels: [], cursor: 0, status: 'stopped' });
  });

  it('persiste canais selecionados', async () => {
    const area = fakeArea();
    await setRotation({ channels: ['a', 'b'], cursor: 0, status: 'playing' }, area);
    expect((await getRotation(area)).channels).toEqual(['a', 'b']);
  });
});

describe('clientId', () => {
  it('vazio por padrão', async () => {
    expect(await getClientId(fakeArea())).toBe('');
  });

  it('salva e lê', async () => {
    const area = fakeArea();
    await setClientId('cid', area);
    expect(await getClientId(area)).toBe('cid');
  });
});

describe('auth', () => {
  it('null por padrão, salva e limpa', async () => {
    const area = fakeArea();
    expect(await getAuth(area)).toBeNull();
    await setAuth({ accessToken: 't' }, area);
    expect((await getAuth(area)).accessToken).toBe('t');
    await clearAuth(area);
    expect(await getAuth(area)).toBeNull();
  });
});
