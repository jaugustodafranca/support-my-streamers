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

const persistRuntime = async () => {
  await chrome.storage.session.set({ [RUNTIME_KEY]: runtime });
};

const restoreRuntime = async () => {
  const stored = await chrome.storage.session.get(RUNTIME_KEY);
  const saved = stored[RUNTIME_KEY];
  if (!saved?.tabIds?.length) return;

  const tabIds = [];
  const tabLogins = [];
  for (let index = 0; index < saved.tabIds.length; index++) {
    try {
      await chrome.tabs.get(saved.tabIds[index]);
      tabIds.push(saved.tabIds[index]);
      tabLogins.push(saved.tabLogins[index] ?? null);
    } catch {
      // tab closed by user
    }
  }

  runtime = {
    tabIds,
    tabLogins,
    groupId: tabIds.length ? saved.groupId : null,
  };
};

const reconcileTabs = async (live, settings) => {
  const newTabIds = [];
  const newTabLogins = [];
  const taken = [];

  for (let index = 0; index < runtime.tabIds.length; index++) {
    const tabId = runtime.tabIds[index];
    const supportedLogin = runtime.tabLogins[index];
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
};

const fillEmptySlots = async (live, settings) => {
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
};

const syncOpenTabs = async (live, settings) => {
  await reconcileTabs(live, settings);
  await fillEmptySlots(live, settings);
  await persistRuntime();
};

const watchUrl = (login) => `https://www.twitch.tv/${login}`;

const labelTabGroup = async (groupId) => {
  await chrome.tabGroups.update(groupId, { title: TAB_GROUP_TITLE, color: 'purple' });
};

const launchTwitchAuth = async (clientId) => {
  const redirectUri = chrome.identity.getRedirectURL();
  const url = buildAuthUrl({ clientId, redirectUri });
  let redirect;
  try {
    redirect = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
  } catch (error) {
    const message = String(error?.message || error);
    const redirectHint =
      /redirect|authorization|oauth/i.test(message)
        ? ` Twitch OAuth Redirect URL must include: ${redirectUri}`
        : '';
    throw new Error(`${message}${redirectHint}`);
  }
  return parseAuthRedirect(redirect);
};

const tabMuted = (settings) => settings.audio === 'muted';

const injectPlayerScript = async (tabId) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/twitchPlayer.js'],
    });
  } catch {
    // page still loading or tab closed
  }
};

const applyTabAudio = async (tabId, settings) => {
  await chrome.tabs.update(tabId, { muted: tabMuted(settings) });
  await injectPlayerScript(tabId);
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'ENSURE_PLAYER' });
  } catch {
    // content script not injected yet
  }
};

const applyAudioToAllTabs = async (settings) => {
  for (const tabId of runtime.tabIds) {
    try {
      await applyTabAudio(tabId, settings);
    } catch {
      // tab closed by user
    }
  }
};

const ensureUserId = async (auth, clientId) => {
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
};

const fetchLiveFollows = async () => {
  const auth = await store.getAuth();
  if (!auth || !CLIENT_ID) return [];
  if (isAuthExpired(auth)) {
    await store.clearAuth();
    return [];
  }
  const withId = await ensureUserId(auth, CLIENT_ID);
  return getFollowedLiveStreams(fetch, CLIENT_ID, withId.accessToken, withId.userId);
};

const liveSelected = async () => {
  const rotation = await store.getRotation();
  const live = await fetchLiveFollows();
  const liveLogins = new Set(live.map((stream) => stream.login));
  return rotation.channels.filter((channel) => liveLogins.has(channel));
};

const closeTabs = async () => {
  for (const tabId of runtime.tabIds) {
    try {
      await chrome.tabs.remove(tabId);
    } catch {
      // tab already closed by user
    }
  }
  runtime = { tabIds: [], tabLogins: [], groupId: null };
  await persistRuntime();
};

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

const loadIconImageData = async (relativePath, size) => {
  const response = await fetch(chrome.runtime.getURL(relativePath));
  if (!response.ok) {
    throw new Error(`Failed to fetch icon ${relativePath}`);
  }
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, 0, 0, size, size);
  bitmap.close();
  return context.getImageData(0, 0, size, size);
};

/** Red dot on toolbar icon while rotation is playing (pre-rendered PNGs). */
const syncActionIcon = async () => {
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
    } catch (error) {
      console.error('syncActionIcon failed:', error);
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
};

const closeSmsGroupsExcept = async (keepGroupId = null) => {
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
};

const createFreshWindow = async (logins, settings) => {
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
};

const adoptGroup = async (groupId, logins, settings) => {
  const tabs = await chrome.tabs.query({ groupId });
  const tabIds = tabs.map((tab) => tab.id).slice(0, SLOTS);

  for (let index = SLOTS; index < tabs.length; index++) {
    try {
      await chrome.tabs.remove(tabs[index].id);
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

  for (let index = 0; index < logins.length; index++) {
    await chrome.tabs.update(tabIds[index], {
      url: watchUrl(logins[index]),
      muted: tabMuted(settings),
    });
    await applyTabAudio(tabIds[index], settings);
  }

  await labelTabGroup(groupId);
  runtime = { tabIds: tabIds.slice(0, logins.length), tabLogins: [...logins], groupId };
  await persistRuntime();
};

const assignWindowToTabs = async (logins, settings) => {
  const tabIds = [];
  for (const tabId of runtime.tabIds) {
    try {
      await chrome.tabs.get(tabId);
      tabIds.push(tabId);
    } catch {
      // tab closed by user
    }
  }

  if (!tabIds.length) {
    throw new Error('No tracked tabs');
  }

  if (tabIds.length > logins.length) {
    for (let index = logins.length; index < tabIds.length; index++) {
      try {
        await chrome.tabs.remove(tabIds[index]);
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

  for (let index = 0; index < logins.length; index++) {
    await chrome.tabs.update(tabIds[index], {
      url: watchUrl(logins[index]),
      muted: tabMuted(settings),
    });
    await applyTabAudio(tabIds[index], settings);
  }

  if (tabIds.length && !runtime.groupId) {
    runtime.groupId = await chrome.tabs.group({ tabIds });
    await labelTabGroup(runtime.groupId);
  }

  runtime.tabIds = tabIds;
  runtime.tabLogins = [...logins];
  await persistRuntime();
};

const ensureWindow = async (logins, settings) => {
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
};

const assignWindow = async (logins, settings) => {
  try {
    await assignWindowToTabs(logins, settings);
    if (runtime.groupId) await closeSmsGroupsExcept(runtime.groupId);
  } catch {
    runtime = { tabIds: [], tabLogins: [], groupId: null };
    await ensureWindow(logins, settings);
  }
};

// Future: send per-cycle stats to VPS backend.
const recordCycleEnd = async (_live, _tabLogins) => {};

const scheduleCycle = async () => {
  const settings = await store.getSettings();
  const rotation = await store.getRotation();
  if (rotation.status !== 'playing') {
    chrome.alarms.clear(CYCLE_TIMER);
    return;
  }
  const period =
    settings.intervalMinutes > 0 ? settings.intervalMinutes : HEALTH_CHECK_MINUTES;
  chrome.alarms.create(CYCLE_TIMER, { periodInMinutes: period });
};

const start = async () => {
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
};

const resume = async () => {
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
};

const play = async () => {
  if (!runtime.tabIds.length) await restoreRuntime();
  const rotation = await store.getRotation();
  if (rotation.status === 'paused') {
    return resume();
  }
  return start();
};

const pause = async () => {
  await chrome.alarms.clear(CYCLE_TIMER);
  const rotation = await store.getRotation();
  await store.setRotation({ ...rotation, status: 'paused' });
  await syncActionIcon();
};

const stop = async () => {
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
};

const syncCycle = async () => {
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
};

const toggleChannel = async (login) => {
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
};

const applySettings = async (partial) => {
  const current = await store.getSettings();
  const settings = { ...current, ...partial };
  await store.setSettings(settings);
  const rotation = await store.getRotation();
  if (rotation.status === 'playing') {
    await applyAudioToAllTabs(settings);
    await scheduleCycle();
  }
};

const getNextCycleAt = async () => {
  const alarm = await chrome.alarms.get(CYCLE_TIMER);
  return alarm?.scheduledTime ?? null;
};

/** Recreate cycle alarm after SW restart if rotation is still playing. */
const ensureCycleAlarm = async () => {
  const rotation = await store.getRotation();
  if (rotation.status !== 'playing') return;
  const alarm = await chrome.alarms.get(CYCLE_TIMER);
  if (!alarm) await scheduleCycle();
};

/** Logins currently open in tracked tabs (restores session / reads tab URLs if needed). */
const getPlayingLogins = async () => {
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
};

const getState = async () => {
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
  } catch (error) {
    if (error.status === 401) {
      await store.clearAuth();
      return { ...base, authed: false, user: null, live: [] };
    }
    return {
      ...base,
      authed: true,
      user: { login: auth.login, displayName: auth.displayName },
      live: [],
      error: String(error.message || error),
    };
  }
};

// Runs fn (may throw) and always returns renderable state, attaching error on failure.
const withState = async (fn) => {
  let error;
  try {
    await fn();
  } catch (caught) {
    error = String(caught.message || caught);
  }
  const state = await getState();
  return error ? { ...state, error } : state;
};

const handle = async (message) => {
  switch (message.type) {
    case 'GET_STATE':
      return getState();
    case 'LOGIN':
      return withState(async () => {
        if (!CLIENT_ID) throw new Error('CLIENT_ID is not configured in the extension.');
        const parsed = await launchTwitchAuth(CLIENT_ID);
        await store.setAuth(parsed);
        try {
          await ensureUserId(await store.getAuth(), CLIENT_ID);
        } catch (error) {
          await store.clearAuth();
          throw error;
        }
      });
    case 'LOGOUT':
      return withState(async () => {
        await stop();
        await store.clearAuth();
      });
    case 'TOGGLE_CHANNEL':
      return withState(() => toggleChannel(message.login));
    case 'SET_SETTINGS':
      return withState(() => applySettings(message.settings));
    case 'PLAY':
      return withState(play);
    case 'PAUSE':
      return withState(pause);
    case 'STOP':
      return withState(stop);
    default:
      throw new Error(`Unknown message type: ${message.type}`);
  }
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handle(message)
    .then(sendResponse)
    .catch((error) => sendResponse({ error: String(error.message || error) }));
  return true; // async response
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CYCLE_TIMER) {
    syncCycle().catch((error) => console.error('syncCycle failed:', error));
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
  .catch((error) => console.error('restoreRuntime failed:', error));
