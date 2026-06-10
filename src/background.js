// Service worker: orquestra autenticação, busca de follows ao vivo e a rotação
// das abas. Concentra todo o efeito colateral de chrome.* aqui.

import { TAB_GROUP_TITLE } from './config.js';
import { launchTwitchAuth } from './auth.js';
import { getCurrentUser, getFollowedLiveStreams } from './twitchApi.js';
import { windowAt, nextCursor } from './rotation.js';
import * as store from './storage.js';

const ALARM = 'rotate';

// Estado em memória das abas da rotação (recuperável; some se o SW reiniciar).
let runtime = { tabIds: [], groupId: null };

function watchUrl(login) {
  return `https://www.twitch.tv/${login}`;
}

async function ensureUserId(auth, clientId) {
  if (auth.userId) return auth;
  const user = await getCurrentUser(fetch, clientId, auth.accessToken);
  if (!user) throw new Error('Não consegui identificar o usuário da Twitch.');
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
  const clientId = await store.getClientId();
  if (!auth || !clientId) return [];
  const withId = await ensureUserId(auth, clientId);
  return getFollowedLiveStreams(fetch, clientId, withId.accessToken, withId.userId);
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
      // aba já fechada pelo usuário — segue o jogo
    }
  }
  runtime = { tabIds: [], groupId: null };
}

async function openWindow(logins, settings) {
  await closeTabs();
  const muted = settings.audio === 'muted';
  const tabIds = [];
  for (const login of logins) {
    const tab = await chrome.tabs.create({ url: watchUrl(login), active: false });
    if (muted) await chrome.tabs.update(tab.id, { muted: true });
    tabIds.push(tab.id);
  }
  let groupId = null;
  if (tabIds.length) {
    groupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(groupId, { title: TAB_GROUP_TITLE, color: 'purple' });
  }
  runtime = { tabIds, groupId };
}

async function updateWindow(logins, settings) {
  if (runtime.tabIds.length !== logins.length) {
    return openWindow(logins, settings);
  }
  const muted = settings.audio === 'muted';
  for (let i = 0; i < logins.length; i++) {
    try {
      await chrome.tabs.update(runtime.tabIds[i], { url: watchUrl(logins[i]), muted });
    } catch {
      // alguma aba foi fechada — recria a janela inteira
      return openWindow(logins, settings);
    }
  }
}

async function start() {
  const settings = await store.getSettings();
  const rotation = await store.getRotation();
  const selected = await liveSelected();
  if (!selected.length) {
    throw new Error('Nenhum canal selecionado está ao vivo agora.');
  }
  await openWindow(windowAt(selected, 0, settings.slots), settings);
  await store.setRotation({ ...rotation, cursor: 0, status: 'playing' });
  if (selected.length > settings.slots) {
    chrome.alarms.create(ALARM, { periodInMinutes: settings.intervalMinutes });
  }
}

async function resume() {
  const settings = await store.getSettings();
  const rotation = await store.getRotation();
  await store.setRotation({ ...rotation, status: 'playing' });
  chrome.alarms.create(ALARM, { periodInMinutes: settings.intervalMinutes });
}

async function play() {
  const rotation = await store.getRotation();
  if (rotation.status === 'paused' && runtime.tabIds.length) {
    return resume();
  }
  return start();
}

async function pause() {
  await chrome.alarms.clear(ALARM);
  const rotation = await store.getRotation();
  await store.setRotation({ ...rotation, status: 'paused' });
}

async function stop() {
  await chrome.alarms.clear(ALARM);
  await closeTabs();
  const rotation = await store.getRotation();
  await store.setRotation({ ...rotation, status: 'stopped', cursor: 0 });
}

async function rotate() {
  const rotation = await store.getRotation();
  if (rotation.status !== 'playing') return;
  const settings = await store.getSettings();
  const selected = await liveSelected();
  if (selected.length <= settings.slots) return; // nada a rotacionar
  const cursor = nextCursor(rotation.cursor, settings.slots, selected.length);
  await updateWindow(windowAt(selected, cursor, settings.slots), settings);
  await store.setRotation({ ...rotation, cursor });
}

async function toggleChannel(login) {
  const rotation = await store.getRotation();
  const set = new Set(rotation.channels);
  if (set.has(login)) set.delete(login);
  else set.add(login);
  await store.setRotation({ ...rotation, channels: [...set] });
}

async function applySettings(partial) {
  const current = await store.getSettings();
  const settings = { ...current, ...partial };
  await store.setSettings(settings);
  const rotation = await store.getRotation();
  if (rotation.status === 'playing') {
    chrome.alarms.create(ALARM, { periodInMinutes: settings.intervalMinutes });
  }
}

async function getState() {
  const auth = await store.getAuth();
  const settings = await store.getSettings();
  const rotation = await store.getRotation();
  const clientId = await store.getClientId();
  const base = { clientIdSet: !!clientId, settings, rotation };

  if (!auth || !clientId) {
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

// Executa `fn` (que pode lançar) e SEMPRE devolve um estado renderizável,
// anexando `error` se algo falhar.
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
        const clientId = await store.getClientId();
        if (!clientId) throw new Error('Configure o Client-ID nas Opções antes de conectar.');
        const parsed = await launchTwitchAuth(clientId);
        await store.setAuth(parsed);
        await ensureUserId(await store.getAuth(), clientId);
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
      throw new Error(`Mensagem desconhecida: ${msg.type}`);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handle(msg)
    .then(sendResponse)
    .catch((e) => sendResponse({ error: String(e.message || e) }));
  return true; // resposta assíncrona
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) rotate().catch((e) => console.error('rotate falhou:', e));
});
