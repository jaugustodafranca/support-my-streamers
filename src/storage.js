// chrome.storage.local wrappers with defaults. Storage area is injectable for tests.

import { DEFAULT_SETTINGS, DEFAULT_ROTATION } from './config.js';

const area = () => chrome.storage.local;

export const getAuth = async (store = area()) => {
  const { auth } = await store.get('auth');
  return auth ?? null;
};

export const setAuth = async (auth, store = area()) => {
  await store.set({ auth });
};

export const clearAuth = async (store = area()) => {
  await store.remove('auth');
};

export const getSettings = async (store = area()) => {
  const { settings } = await store.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
};

export const setSettings = async (settings, store = area()) => {
  await store.set({ settings });
};

export const getRotation = async (store = area()) => {
  const { rotation } = await store.get('rotation');
  return { ...DEFAULT_ROTATION, ...(rotation || {}) };
};

export const setRotation = async (rotation, store = area()) => {
  await store.set({ rotation });
};

const DEFAULT_REVIEW_PROMPT = {
  playStarts: 0,
  dismissedAt: null,
  ratedAt: null,
};

export const getReviewPrompt = async (store = area()) => {
  const { reviewPrompt } = await store.get('reviewPrompt');
  return { ...DEFAULT_REVIEW_PROMPT, ...(reviewPrompt || {}) };
};

export const setReviewPrompt = async (reviewPrompt, store = area()) => {
  await store.set({ reviewPrompt });
};

export const recordPlayStart = async (store = area()) => {
  const current = await getReviewPrompt(store);
  await setReviewPrompt({ ...current, playStarts: current.playStarts + 1 }, store);
};
