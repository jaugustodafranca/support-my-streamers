// Service worker: auth, live follows, tab rotation. All chrome.* side effects live here.

import { CLIENT_ID, TAB_GROUP_TITLE, SLOTS, HEALTH_CHECK_MINUTES } from './config.js';
import { buildAuthUrl, parseAuthRedirect, isAuthExpired } from './auth.js';
import { getCurrentUser, getFollowedLiveStreams } from './twitchApi.js';
import {
  parseChannelLogin,
  decideTabAction,
  unshownLive,
  needsRotation,
  initFifoRotation,
  tickFifoRotation,
} from './rotation.js';
import { shouldShowReviewPrompt } from './reviewPrompt.js';
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

async function labelTabGroup(groupId) {
  await chrome.tabGroups.update(groupId, { title: TAB_GROUP_TITLE, color: 'purple' });
}

async function launchTwitchAuth(clientId) {
  const redirectUri = chrome.identity.getRedirectURL();
  const url = buildAuthUrl({ clientId, redirectUri });
  let redirect;
  try {
    redirect = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
  } catch (e) {
    const message = String(e?.message || e);
    const redirectHint =
      /redirect|authorization|oauth/i.test(message)
        ? ` Twitch OAuth Redirect URL must include: ${redirectUri}`
        : '';
    throw new Error(`${message}${redirectHint}`);
  }
  return parseAuthRedirect(redirect);
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

const ICON_PATHS = {
  16: 'icons/icon16.png',
  32: 'icons/icon32.png',
  48: 'icons/icon48.png',
  128: 'icons/icon128.png',
};

const ACTIVE_ICON_PATHS = {
  16: 'icons/icon16-active.png',
  32: 'icons/icon32-active.png',
  48: 'icons/icon48-active.png',
  128: 'icons/icon128-active.png',
};

let iconSyncInFlight = null;

async function loadIconImageData(relativePath, size) {
  const response = await fetch(chrome.runtime.getURL(relativePath));
  if (!response.ok) {
    throw new Error(`Failed to fetch icon ${relativePath}`);
  }
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();
  return ctx.getImageData(0, 0, size, size);
}

/** Red dot on toolbar icon while rotation is playing (pre-rendered PNGs). */
async function syncActionIcon() {
  if (iconSyncInFlight) return iconSyncInFlight;

  iconSyncInFlight = (async () => {
    const rotation = await store.getRotation();
    const active = rotation.status === 'playing';
    const paths = active ? ACTIVE_ICON_PATHS : ICON_PATHS;

    try {
      await chrome.action.setBadgeText({ text: '' });
      const imageData = {};
      for (const [size, path] of Object.entries(paths)) {
        imageData[size] = await loadIconImageData(path, Number(size));
      }
      await chrome.action.setIcon({ imageData });
    } catch (e) {
      console.error('syncActionIcon failed:', e);
      try {
        await chrome.action.setIcon({ path: paths });
      } catch (fallbackError) {
        console.error('syncActionIcon path fallback failed:', fallbackError);
      }
    }
  })().finally(() => {
    iconSyncInFlight = null;
  });

  return iconSyncInFlight;
}

async function closeSmsGroupsExcept(keepGroupId = null) {
  const groups = await chrome.tabGroups.query({ title: TAB_GROUP_TITLE });
  for (const group of groups) {
    if (keepGroupId !== null && group.id === keepGroupId) continue;
    const tabs = await chrome.tabs.query({ groupId: group.id });
    for (const tab of tabs) {
      try {
        await chrome.tabs.remove(tab.id);
      } catch {
        // tab already closed by user
      }
    }
  }
}

async function createFreshWindow(logins, settings) {
  await closeTabs();
  await closeSmsGroupsExcept();
  const tabIds = [];
  for (const login of logins) {
    const tab = await chrome.tabs.create({ url: watchUrl(login), active: false });
    await applyTabAudio(tab.id, settings);
    tabIds.push(tab.id);
  }
  let groupId = null;
  if (tabIds.length) {
    groupId = await chrome.tabs.group({ tabIds });
    await labelTabGroup(groupId);
  }
  runtime = { tabIds, tabLogins: [...logins], groupId };
  await persistRuntime();
}

async function adoptGroup(groupId, logins, settings) {
  const tabs = await chrome.tabs.query({ groupId });
  const tabIds = tabs.map((tab) => tab.id).slice(0, SLOTS);

  for (let i = SLOTS; i < tabs.length; i++) {
    try {
      await chrome.tabs.remove(tabs[i].id);
    } catch {
      // tab already closed by user
    }
  }

  while (tabIds.length < logins.length) {
    const login = logins[tabIds.length];
    const tab = await chrome.tabs.create({
      url: watchUrl(login),
      active: false,
      groupId,
    });
    tabIds.push(tab.id);
  }

  for (let i = 0; i < logins.length; i++) {
    await chrome.tabs.update(tabIds[i], {
      url: watchUrl(logins[i]),
      muted: tabMuted(settings),
    });
    await applyTabAudio(tabIds[i], settings);
  }

  await labelTabGroup(groupId);
  runtime = { tabIds: tabIds.slice(0, logins.length), tabLogins: [...logins], groupId };
  await persistRuntime();
}

async function assignWindowToTabs(logins, settings) {
  const tabIds = [];
  for (const id of runtime.tabIds) {
    try {
      await chrome.tabs.get(id);
      tabIds.push(id);
    } catch {
      // tab closed by user
    }
  }

  if (!tabIds.length) {
    throw new Error('No tracked tabs');
  }

  if (tabIds.length > logins.length) {
    for (let i = logins.length; i < tabIds.length; i++) {
      try {
        await chrome.tabs.remove(tabIds[i]);
      } catch {
        // tab already closed
      }
    }
    tabIds.length = logins.length;
  }

  while (tabIds.length < logins.length) {
    const login = logins[tabIds.length];
    const createProps = { url: watchUrl(login), active: false };
    if (runtime.groupId) createProps.groupId = runtime.groupId;
    const tab = await chrome.tabs.create(createProps);
    tabIds.push(tab.id);
  }

  for (let i = 0; i < logins.length; i++) {
    await chrome.tabs.update(tabIds[i], {
      url: watchUrl(logins[i]),
      muted: tabMuted(settings),
    });
    await applyTabAudio(tabIds[i], settings);
  }

  if (tabIds.length && !runtime.groupId) {
    runtime.groupId = await chrome.tabs.group({ tabIds });
    await labelTabGroup(runtime.groupId);
  }

  runtime.tabIds = tabIds;
  runtime.tabLogins = [...logins];
  await persistRuntime();
}

async function assignWindow(logins, settings) {
  try {
    await assignWindowToTabs(logins, settings);
    if (runtime.groupId) await closeSmsGroupsExcept(runtime.groupId);
  } catch {
    runtime = { tabIds: [], tabLogins: [], groupId: null };
    await ensureWindow(logins, settings);
  }
}

/** Reuse tracked tabs or an existing SMS group; navigate URLs instead of opening duplicates. */
async function ensureWindow(logins, settings) {
  if (!runtime.tabIds.length) await restoreRuntime();

  if (runtime.tabIds.length) {
    return assignWindow(logins, settings);
  }

  const groups = await chrome.tabGroups.query({ title: TAB_GROUP_TITLE });
  if (groups.length) {
    const keepId = groups[0].id;
    await adoptGroup(keepId, logins, settings);
    await closeSmsGroupsExcept(keepId);
    return;
  }

  await createFreshWindow(logins, settings);
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
    const createProps = { url: watchUrl(login), active: false };
    if (runtime.groupId) createProps.groupId = runtime.groupId;
    const tab = await chrome.tabs.create(createProps);
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
    await labelTabGroup(runtime.groupId);
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
  const fifo = initFifoRotation(selected, SLOTS);
  await ensureWindow(fifo.showing, settings);
  await store.setRotation({
    ...rotation,
    queueOrder: fifo.queueOrder,
    status: 'playing',
  });
  await store.recordPlayStart();
  await scheduleCycle();
  await syncActionIcon();
}

async function resume() {
  const settings = await store.getSettings();
  const rotation = await store.getRotation();
  if (!runtime.tabIds.length) await restoreRuntime();
  const live = await liveSelected();
  if (!runtime.tabIds.length && live.length) {
    if (rotation.queueOrder?.length) {
      const showing = rotation.queueOrder.slice(0, Math.min(SLOTS, rotation.queueOrder.length));
      await ensureWindow(showing, settings);
    } else {
      const fifo = initFifoRotation(live, SLOTS);
      await ensureWindow(fifo.showing, settings);
      await store.setRotation({
        ...rotation,
        queueOrder: fifo.queueOrder,
      });
    }
  } else if (runtime.tabIds.length) {
    await syncOpenTabs(live, settings);
  }
  await applyAudioToAllTabs(settings);
  await store.setRotation({ ...rotation, status: 'playing' });
  await scheduleCycle();
  await syncActionIcon();
}

async function play() {
  if (!runtime.tabIds.length) await restoreRuntime();
  const rotation = await store.getRotation();
  if (rotation.status === 'paused') {
    return resume();
  }
  return start();
}

async function pause() {
  await chrome.alarms.clear(CYCLE_TIMER);
  const rotation = await store.getRotation();
  await store.setRotation({ ...rotation, status: 'paused' });
  await syncActionIcon();
}

async function stop() {
  await chrome.alarms.clear(CYCLE_TIMER);
  await closeTabs();
  await closeSmsGroupsExcept();
  const rotation = await store.getRotation();
  await store.setRotation({
    ...rotation,
    status: 'stopped',
    queueOrder: [],
  });
  await syncActionIcon();
}

async function syncCycle() {
  const rotation = await store.getRotation();
  if (rotation.status !== 'playing') return;
  const settings = await store.getSettings();

  if (!runtime.tabIds.length) await restoreRuntime();

  // Selected + followed channels that are live per Twitch API.
  const live = await liveSelected();

  await syncOpenTabs(live, settings);

  // FIFO rotation: shuffle once at start, then queue order; live check each cycle.
  if (settings.intervalMinutes > 0 && needsRotation(live.length, SLOTS)) {
    const showing = [...runtime.tabLogins];
    const next = tickFifoRotation({
      liveLogins: live,
      showing,
      queueOrder: rotation.queueOrder?.length ? rotation.queueOrder : live,
      slots: SLOTS,
    });
    if (next) {
      if (next.changed) {
        await assignWindow(next.showing, settings);
      }
      await store.setRotation({ ...rotation, queueOrder: next.queueOrder });
    }
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

/** Recreate cycle alarm after SW restart if rotation is still playing. */
async function ensureCycleAlarm() {
  const rotation = await store.getRotation();
  if (rotation.status !== 'playing') return;
  const alarm = await chrome.alarms.get(CYCLE_TIMER);
  if (!alarm) await scheduleCycle();
}

/** Logins currently open in tracked tabs (restores session / reads tab URLs if needed). */
async function getPlayingLogins() {
  if (!runtime.tabIds.length) await restoreRuntime();

  const fromRuntime = runtime.tabLogins.filter(Boolean);
  if (fromRuntime.length) return fromRuntime;

  const fromTabs = [];
  for (const tabId of runtime.tabIds) {
    try {
      const tab = await chrome.tabs.get(tabId);
      const login = parseChannelLogin(tab.url);
      if (login) fromTabs.push(login);
    } catch {
      // tab closed by user
    }
  }

  if (fromTabs.length) {
    runtime.tabLogins = fromTabs;
    await persistRuntime();
  }

  return fromTabs;
}

async function getState() {
  const auth = await store.getAuth();
  const settings = await store.getSettings();
  const rotation = await store.getRotation();
  if (rotation.status === 'playing') await ensureCycleAlarm();
  syncActionIcon();
  const nextCycleAt = rotation.status === 'playing' ? await getNextCycleAt() : null;
  const playingLogins =
    rotation.status === 'playing' ? await getPlayingLogins() : [];
  const reviewPrompt = await store.getReviewPrompt();
  const base = {
    clientIdSet: !!CLIENT_ID,
    settings,
    rotation,
    nextCycleAt,
    playingLogins,
    showReviewPrompt: shouldShowReviewPrompt(reviewPrompt),
  };

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
        try {
          await ensureUserId(await store.getAuth(), CLIENT_ID);
        } catch (e) {
          await store.clearAuth();
          throw e;
        }
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

restoreRuntime()
  .then(() => ensureCycleAlarm())
  .then(() => syncActionIcon())
  .catch((e) => console.error('restoreRuntime failed:', e));
