// Wrappers de chrome.storage.local com defaults. A área é injetável para teste.

import { DEFAULT_SETTINGS, DEFAULT_ROTATION } from './config.js';

const area = () => chrome.storage.local;

export async function getClientId(store = area()) {
  const { clientId } = await store.get('clientId');
  return clientId || '';
}

export async function setClientId(clientId, store = area()) {
  await store.set({ clientId });
}

export async function getAuth(store = area()) {
  const { auth } = await store.get('auth');
  return auth ?? null;
}

export async function setAuth(auth, store = area()) {
  await store.set({ auth });
}

export async function clearAuth(store = area()) {
  await store.remove('auth');
}

export async function getSettings(store = area()) {
  const { settings } = await store.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export async function setSettings(settings, store = area()) {
  await store.set({ settings });
}

export async function getRotation(store = area()) {
  const { rotation } = await store.get('rotation');
  return { ...DEFAULT_ROTATION, ...(rotation || {}) };
}

export async function setRotation(rotation, store = area()) {
  await store.set({ rotation });
}
