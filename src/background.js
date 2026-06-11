// Service worker: auth, live follows, tab rotation. All chrome.* side effects live here.

import { CLIENT_ID, TAB_GROUP_TITLE, SLOTS, HEALTH_CHECK_MINUTES } from './config.js';
import { launchTwitchAuth, isAuthExpired } from './auth.js';
import { getCurrentUser, getFollowedLiveStreams } from './twitchApi.js';
import {
  windowAt,
  nextCursor,
  parseChannelLogin,
  decideTabAction,
  unshownLive,
  needsRotation,
} from './rotation.js';
import * as store from './storage.js';

// Internal Chrome timer — silent, no user notification.
const CYCLE_TIMER = 'cycle';

const RUNTIME_KEY = 'smsRuntime';

// Tab state mirrored in chrome.storage.session to survive service worker restarts.
let runtime = { tabIds: [], tabLogins: [], groupId: null };

async function persistRuntime() {
  await chrome.storage.session.set({ [RUNTIME_KEY]: runtime });
}

async function restoreRuntime() {
  const stored = await chrome.storage.session.get(RUNTIME_KEY);
  const saved = stored[RUNTIME_KEY];
  if (!saved?.tabIds?.length) return;

  const tabIds = [];
  const tabLogins = [];
  for (let i = 0; i < saved.tabIds.length; i++) {
    try {
      await chrome.tabs.get(saved.tabIds[i]);
      tabIds.push(saved.tabIds[i]);
      tabLogins.push(saved.tabLogins[i] ?? null);
    } catch {
      // tab closed by user
    }
  }

  runtime = {
    tabIds,
    tabLogins,
    groupId: tabIds.length ? saved.groupId : null,
  };
}

async function syncOpenTabs(live, settings) {
  await reconcileTabs(live, settings);
  await fillEmptySlots(live, settings);
  await persistRuntime();
}

function watchUrl(login) {
  return `https://www.twitch.tv/${login}`;
}

function tabMuted(settings) {
  return settings.audio === 'muted';
}

async function injectPlayerScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/twitchPlayer.js'],
    });
  } catch {
    // page still loading or tab closed
  }
}

async function applyTabAudio(tabId, settings) {
  await chrome.tabs.update(tabId, { muted: tabMuted(settings) });
  await injectPlayerScript(tabId);
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'ENSURE_PLAYER' });
  } catch {
    // content script not injected yet
  }
}

async function applyAudioToAllTabs(settings) {
  for (const tabId of runtime.tabIds) {
    try {
      await applyTabAudio(tabId, settings);
    } catch {
      // tab closed by user
    }
  }
}

async function ensureUserId(auth, clientId) {
  if (auth.userId) return auth;
  const user = await getCurrentUser(fetch, clientId, auth.accessToken);
  if (!user) throw new Error('Could not resolve Twitch user.');
  const next = {
    ...auth,
    userId: user.id,
    login: user.login,
    displayName: user.display_name,
  };
  await store.setAuth(next);
  return next;
}

async function fetchLiveFollows() {
  const auth = await store.getAuth();
  if (!auth || !CLIENT_ID) return [];
  if (isAuthExpired(auth)) {
    await store.clearAuth();
    return [];
  }
  const withId = await ensureUserId(auth, CLIENT_ID);
  return getFollowedLiveStreams(fetch, CLIENT_ID, withId.accessToken, withId.userId);
}

async function liveSelected() {
  const rotation = await store.getRotation();
  const live = await fetchLiveFollows();
  const liveLogins = new Set(live.map((s) => s.login));
  return rotation.channels.filter((c) => liveLogins.has(c));
}

async function closeTabs() {
  for (const id of runtime.tabIds) {
    try {
      await chrome.tabs.remove(id);
    } catch {
      // tab already closed by user
    }
  }
  runtime = { tabIds: [], tabLogins: [], groupId: null };
  await persistRuntime();
}

async function openWindow(logins, settings) {
  await closeTabs();
  const tabIds = [];
  for (const login of logins) {
    const tab = await chrome.tabs.create({ url: watchUrl(login), active: false });
    await applyTabAudio(tab.id, settings);
    tabIds.push(tab.id);
  }
  let groupId = null;
  if (tabIds.length) {
    groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, { title: TAB_GROUP_TITLE, color: 'purple' });
  }
  runtime = { tabIds, tabLogins: [...logins], groupId };
  await persistRuntime();
}

async function assignWindow(logins, settings) {
  if (runtime.tabIds.length !== logins.length) {
    return openWindow(logins, settings);
  }
  for (let i = 0; i < logins.length; i++) {
    try {
      await chrome.tabs.update(runtime.tabIds[i], {
        url: watchUrl(logins[i]),
        muted: tabMuted(settings),
      });
    } catch {
      return openWindow(logins, settings);
    }
  }
  runtime.tabLogins = [...logins];
  await persistRuntime();
}

async function reconcileTabs(live, settings) {
  const newTabIds = [];
  const newTabLogins = [];
  const taken = [];

  for (let i = 0; i < runtime.tabIds.length; i++) {
    const tabId = runtime.tabIds[i];
    const supportedLogin = runtime.tabLogins[i];
    let tab;
    try {
      tab = await chrome.tabs.get(tabId);
    } catch {
      continue;
    }

    const currentLogin = parseChannelLogin(tab.url);
    const decision = decideTabAction({
      supportedLogin,
      currentLogin,
      live,
      taken,
    });

    if (decision.action === 'close') {
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        // already closed
      }
      continue;
    }

    taken.push(decision.login);
    newTabIds.push(tabId);
    newTabLogins.push(decision.login);

    if (decision.action === 'navigate' || currentLogin !== decision.login) {
      try {
        await chrome.tabs.update(tabId, {
          url: watchUrl(decision.login),
          muted: tabMuted(settings),
        });
      } catch {
        // tab closed during cycle
      }
    }
  }

  runtime.tabIds = newTabIds;
  runtime.tabLogins = newTabLogins;
  if (!runtime.tabIds.length) runtime.groupId = null;
  await persistRuntime();
}

async function fillEmptySlots(live, settings) {
  const toOpen = unshownLive(live, runtime.tabLogins, SLOTS);
  for (const login of toOpen) {
    const tab = await chrome.tabs.create({ url: watchUrl(login), active: false });
    await applyTabAudio(tab.id, settings);
    runtime.tabIds.push(tab.id);
    runtime.tabLogins.push(login);

    if (runtime.groupId) {
      try {
        await chrome.tabs.group({ tabIds: tab.id, groupId: runtime.groupId });
      } catch {
        runtime.groupId = null;
      }
    }
  }

  if (runtime.tabIds.length && !runtime.groupId) {
    runtime.groupId = await chrome.tabs.group({ tabIds: runtime.tabIds });
    await chrome.tabGroups.update(runtime.groupId, { title: TAB_GROUP_TITLE, color: 'purple' });
  }
  await persistRuntime();
}

// Future: send per-cycle stats to VPS backend.
async function recordCycleEnd(_live, _tabLogins) {}

async function scheduleCycle() {
  const settings = await store.getSettings();
  const rotation = await store.getRotation();
  if (rotation.status !== 'playing') {
    chrome.alarms.clear(CYCLE_TIMER);
    return;
  }
  const period =
    settings.intervalMinutes > 0 ? settings.intervalMinutes : HEALTH_CHECK_MINUTES;
  chrome.alarms.create(CYCLE_TIMER, { periodInMinutes: period });
}

async function start() {
  const settings = await store.getSettings();
  const rotation = await store.getRotation();
  const selected = await liveSelected();
  if (!selected.length) {
    throw new Error('No selected channel is live right now.');
  }
  await openWindow(windowAt(selected, 0, SLOTS), settings);
  await store.setRotation({ ...rotation, cursor: 0, status: 'playing' });
  await scheduleCycle();
}

async function resume() {
  const settings = await store.getSettings();
  const rotation = await store.getRotation();
  if (!runtime.tabIds.length) await restoreRuntime();
  if (runtime.tabIds.length) {
    const live = await liveSelected();
    await syncOpenTabs(live, settings);
  }
  await applyAudioToAllTabs(settings);
  await store.setRotation({ ...rotation, status: 'playing' });
  await scheduleCycle();
}

async function play() {
  const rotation = await store.getRotation();
  if (rotation.status === 'paused' && runtime.tabIds.length) {
    return resume();
  }
  return start();
}

async function pause() {
  await chrome.alarms.clear(CYCLE_TIMER);
  const rotation = await store.getRotation();
  await store.setRotation({ ...rotation, status: 'paused' });
}

async function stop() {
  await chrome.alarms.clear(CYCLE_TIMER);
  await closeTabs();
  const rotation = await store.getRotation();
  await store.setRotation({ ...rotation, status: 'stopped', cursor: 0 });
}

async function syncCycle() {
  const rotation = await store.getRotation();
  if (rotation.status !== 'playing') return;
  const settings = await store.getSettings();

  if (!runtime.tabIds.length) await restoreRuntime();

  // Selected + followed channels that are live per Twitch API.
  const live = await liveSelected();

  await syncOpenTabs(live, settings);

  // Rotate only with interval > 0 and more live channels than slots.
  if (settings.intervalMinutes > 0 && needsRotation(live.length, SLOTS)) {
    const cursor = nextCursor(rotation.cursor, SLOTS, live.length);
    await assignWindow(windowAt(live, cursor, SLOTS), settings);
    await store.setRotation({ ...rotation, cursor });
  }

  await recordCycleEnd(live, runtime.tabLogins);
  await scheduleCycle();
}

async function toggleChannel(login) {
  const rotation = await store.getRotation();
  const set = new Set(rotation.channels);
  if (set.has(login)) set.delete(login);
  else set.add(login);
  await store.setRotation({ ...rotation, channels: [...set] });

  if (rotation.status === 'playing' && runtime.tabIds.length) {
    const settings = await store.getSettings();
    const live = await liveSelected();
    await syncOpenTabs(live, settings);
  }
}

async function applySettings(partial) {
  const current = await store.getSettings();
  const settings = { ...current, ...partial };
  await store.setSettings(settings);
  const rotation = await store.getRotation();
  if (rotation.status === 'playing') {
    await applyAudioToAllTabs(settings);
    await scheduleCycle();
  }
}

async function getNextCycleAt() {
  const alarm = await chrome.alarms.get(CYCLE_TIMER);
  return alarm?.scheduledTime ?? null;
}

async function getState() {
  const auth = await store.getAuth();
  const settings = await store.getSettings();
  const rotation = await store.getRotation();
  const nextCycleAt = rotation.status === 'playing' ? await getNextCycleAt() : null;
  const base = { clientIdSet: !!CLIENT_ID, settings, rotation, nextCycleAt };

  if (!auth || !CLIENT_ID) {
    return { ...base, authed: false, user: null, live: [] };
  }

  try {
    const live = await fetchLiveFollows();
    return {
      ...base,
      authed: true,
      user: { login: auth.login, displayName: auth.displayName },
      live,
    };
  } catch (e) {
    if (e.status === 401) {
      await store.clearAuth();
      return { ...base, authed: false, user: null, live: [] };
    }
    return {
      ...base,
      authed: true,
      user: { login: auth.login, displayName: auth.displayName },
      live: [],
      error: String(e.message || e),
    };
  }
}

// Runs fn (may throw) and always returns renderable state, attaching error on failure.
async function withState(fn) {
  let error;
  try {
    await fn();
  } catch (e) {
    error = String(e.message || e);
  }
  const state = await getState();
  return error ? { ...state, error } : state;
}

async function handle(msg) {
  switch (msg.type) {
    case 'GET_STATE':
      return getState();
    case 'LOGIN':
      return withState(async () => {
        if (!CLIENT_ID) throw new Error('CLIENT_ID is not configured in the extension.');
        const parsed = await launchTwitchAuth(CLIENT_ID);
        await store.setAuth(parsed);
        await ensureUserId(await store.getAuth(), CLIENT_ID);
      });
    case 'LOGOUT':
      return withState(async () => {
        await stop();
        await store.clearAuth();
      });
    case 'TOGGLE_CHANNEL':
      return withState(() => toggleChannel(msg.login));
    case 'SET_SETTINGS':
      return withState(() => applySettings(msg.settings));
    case 'PLAY':
      return withState(play);
    case 'PAUSE':
      return withState(pause);
    case 'STOP':
      return withState(stop);
    default:
      throw new Error(`Unknown message type: ${msg.type}`);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handle(msg)
    .then(sendResponse)
    .catch((e) => sendResponse({ error: String(e.message || e) }));
  return true; // async response
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CYCLE_TIMER) {
    syncCycle().catch((e) => console.error('syncCycle failed:', e));
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!runtime.tabIds.includes(tabId)) return;
  if (changeInfo.status !== 'complete') return;
  store.getSettings().then((settings) => applyTabAudio(tabId, settings));
});

restoreRuntime().catch((e) => console.error('restoreRuntime failed:', e));
