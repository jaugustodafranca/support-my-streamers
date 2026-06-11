// chrome.storage.local wrappers with defaults. Storage area is injectable for tests.

import { DEFAULT_SETTINGS, DEFAULT_ROTATION } from './config.js';

const area = () => chrome.storage.local;

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

const DEFAULT_REVIEW_PROMPT = {
  playStarts: 0,
  dismissedAt: null,
  ratedAt: null,
};

export async function getReviewPrompt(store = area()) {
  const { reviewPrompt } = await store.get('reviewPrompt');
  return { ...DEFAULT_REVIEW_PROMPT, ...(reviewPrompt || {}) };
}

export async function setReviewPrompt(reviewPrompt, store = area()) {
  await store.set({ reviewPrompt });
}

export async function recordPlayStart(store = area()) {
  const current = await getReviewPrompt(store);
  await setReviewPrompt({ ...current, playStarts: current.playStarts + 1 }, store);
}
