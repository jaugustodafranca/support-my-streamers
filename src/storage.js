// Storage wrappers with defaults. Auth is session-scoped for better at-rest safety.

import { DEFAULT_SETTINGS, DEFAULT_ROTATION } from './config.js';

const localArea = () => chrome.storage.local;
const sessionArea = () => chrome.storage.session;
const optionalLocalArea = () =>
  typeof chrome !== 'undefined' ? chrome.storage.local : null;

export const getAuth = async (
  authStore = sessionArea(),
  legacyStore = optionalLocalArea(),
) => {
  const { auth } = await authStore.get('auth');
  if (auth) return auth;

  // One-time migration from old local storage location.
  if (!legacyStore) return null;
  const { auth: legacyAuth } = await legacyStore.get('auth');
  if (!legacyAuth) return null;
  await authStore.set({ auth: legacyAuth });
  await legacyStore.remove('auth');
  return legacyAuth;
};

export const setAuth = async (auth, authStore = sessionArea()) => {
  await authStore.set({ auth });
};

export const clearAuth = async (
  authStore = sessionArea(),
  legacyStore = optionalLocalArea(),
) => {
  await authStore.remove('auth');
  if (legacyStore) await legacyStore.remove('auth');
};

export const getSettings = async (store = localArea()) => {
  const { settings } = await store.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
};

export const setSettings = async (settings, store = localArea()) => {
  await store.set({ settings });
};

export const getRotation = async (store = localArea()) => {
  const { rotation } = await store.get('rotation');
  return { ...DEFAULT_ROTATION, ...(rotation || {}) };
};

export const setRotation = async (rotation, store = localArea()) => {
  await store.set({ rotation });
};

const DEFAULT_REVIEW_PROMPT = {
  playStarts: 0,
  dismissedAt: null,
  ratedAt: null,
};

export const getReviewPrompt = async (store = localArea()) => {
  const { reviewPrompt } = await store.get('reviewPrompt');
  return { ...DEFAULT_REVIEW_PROMPT, ...(reviewPrompt || {}) };
};

export const setReviewPrompt = async (reviewPrompt, store = localArea()) => {
  await store.set({ reviewPrompt });
};

export const recordPlayStart = async (store = localArea()) => {
  const current = await getReviewPrompt(store);
  await setReviewPrompt({ ...current, playStarts: current.playStarts + 1 }, store);
};
