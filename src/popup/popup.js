import { t, formatCountdown } from '../i18n.js';
import { needsRotation, cycleProgress } from '../rotation.js';
import { SLOTS, HEALTH_CHECK_MINUTES } from '../config.js';
import { getSettings, getAuth, getReviewPrompt, setReviewPrompt } from '../storage.js';
import { storeReviewUrl } from '../reviewPrompt.js';

const app = document.getElementById('app');
const toast = document.getElementById('toast');
let toastTimer = null;
let listRevealed = false;
let countdownTimer = null;
let countdownState = null;
let countdownRefreshing = false;
let channelSearchQuery = '';
let currentState = null;

const GEAR_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const TV_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="m17 2-5 5-5-5"/></svg>`;

const send = (message) => chrome.runtime.sendMessage(message);

const escapeHtml = (str) =>
  String(str ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);

const formatViewers = (count) => {
  if (typeof count !== 'number') return '0';
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
};

const htmlElement = (html) => {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
};

const appendHtml = (parent, html) => {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  parent.append(...template.content.children);
};

const showToast = (message) => {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3000);
};

const selectedLiveCount = (rotation, channels) =>
  rotation.channels.filter((login) => channels.some((channel) => channel.login === login && channel.isLive)).length;

const isRotating = (state) => {
  const { rotation, settings, channels = [] } = state;
  if (rotation.status !== 'playing') return false;
  const count = selectedLiveCount(rotation, channels);
  return needsRotation(count, SLOTS) && settings.intervalMinutes > 0;
};

const cyclePeriodMs = (settings) => {
  const minutes =
    settings.intervalMinutes > 0 ? settings.intervalMinutes : HEALTH_CHECK_MINUTES;
  return minutes * 60_000;
};

const isInfiniteInterval = (settings) => settings.intervalMinutes === 0;

const cycleBarLabel = (state) => {
  const lang = state.settings?.lang || 'pt';
  if (isInfiniteInterval(state.settings)) return t(lang, 'time_never');
  if (isRotating(state)) return t(lang, 'cycle_bar_label');
  return t(lang, 'cycle_bar_check');
};

const cycleTimeLabel = (state, remainingMs) => {
  if (isInfiniteInterval(state.settings)) return '∞';
  if (!state.nextCycleAt || remainingMs <= 0) return '…';
  return formatCountdown(remainingMs);
};

const cycleBarAria = (state) => {
  const lang = state.settings?.lang || 'pt';
  return isInfiniteInterval(state.settings)
    ? t(lang, 'cycle_bar_infinite_aria')
    : t(lang, 'cycle_bar_aria');
};

const cycleBarHtml = (state) => {
  const periodMs = cyclePeriodMs(state.settings);
  const { progress, remainingMs } = cycleProgress(state.nextCycleAt, periodMs);
  const pct = Math.round(progress * 100);
  const infinite = isInfiniteInterval(state.settings);
  const timeLabel = cycleTimeLabel(state, remainingMs);
  const timeClass = infinite
    ? 'cycle-bar__time cycle-bar__time--infinite'
    : 'cycle-bar__time';

  return `<div class="cycle-bar${infinite ? ' cycle-bar--infinite' : ''}" data-cycle-bar>
    <div class="cycle-bar__track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHtml(cycleBarAria(state))}">
      <div class="cycle-bar__fill" data-cycle-fill style="width:${pct}%"></div>
    </div>
    <div class="cycle-bar__meta">
      <span class="cycle-bar__label">${escapeHtml(cycleBarLabel(state))}</span>
      <span class="${timeClass}" data-cycle-time>${escapeHtml(timeLabel)}</span>
    </div>
  </div>`;
};

const stopCountdown = () => {
  clearInterval(countdownTimer);
  countdownTimer = null;
  countdownState = null;
  countdownRefreshing = false;
};

const refreshCountdownState = async () => {
  if (countdownRefreshing) return;
  countdownRefreshing = true;
  try {
    const state = await send({ type: 'GET_STATE' });
    render(state);
  } finally {
    countdownRefreshing = false;
  }
};

const updateCycleBar = () => {
  const root = document.querySelector('[data-cycle-bar]');
  if (!root || !countdownState) return;

  const periodMs = cyclePeriodMs(countdownState.settings);
  const { progress, remainingMs } = cycleProgress(
    countdownState.nextCycleAt,
    periodMs,
  );
  const pct = Math.round(progress * 100);
  const fill = root.querySelector('[data-cycle-fill]');
  const timeEl = root.querySelector('[data-cycle-time]');
  const track = root.querySelector('.cycle-bar__track');

  if (fill) fill.style.width = `${pct}%`;
  if (track) track.setAttribute('aria-valuenow', String(pct));
  if (timeEl) timeEl.textContent = cycleTimeLabel(countdownState, remainingMs);

  if (countdownState.nextCycleAt && remainingMs <= 0) refreshCountdownState();
};

const startCycleBar = (state) => {
  stopCountdown();
  if (state.rotation?.status !== 'playing') return;
  countdownState = state;
  updateCycleBar();
  countdownTimer = setInterval(updateCycleBar, 1000);
};

const displayNameForLogin = (login, channels) => {
  const channel = channels.find((item) => item.login === login);
  return channel?.displayName || login;
};

const statusText = (state) => {
  const { rotation, settings, channels = [] } = state;
  const lang = settings.lang || 'pt';
  if (rotation.status === 'playing') {
    const logins =
      state.playingLogins?.filter(Boolean).length
        ? state.playingLogins
        : rotation.queueOrder?.slice(0, SLOTS) ?? [];
    const names = logins.map((login) => displayNameForLogin(login, channels));
    const interval = isRotating(state) ? settings.intervalMinutes : 0;
    return t(lang, 'status_playing', names, interval);
  }
  if (rotation.status === 'paused') {
    return t(lang, 'status_paused', rotation.channels.length);
  }
  return t(lang, 'selected', rotation.channels.length);
};

const setDocumentLang = (lang) => {
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
};

const langSelect = (lang) =>
  `<select class="lang-select" data-lang aria-label="${escapeHtml(t(lang, 'lang_aria'))}">
    <option value="pt" ${lang === 'pt' ? 'selected' : ''}>🇧🇷 PT</option>
    <option value="en" ${lang === 'en' ? 'selected' : ''}>🇺🇸 EN</option>
  </select>`;

const topbar = (lang) =>
  `<header class="topbar">
    <h1 class="wordmark">support<em>my</em>streamers</h1>
    <div class="topbar-actions">
      ${langSelect(lang)}
      <button class="icon-btn" data-action="options" aria-label="${escapeHtml(t(lang, 'options_aria'))}">${GEAR_ICON}</button>
    </div>
  </header>`;

const reviewBanner = (lang) =>
  `<div class="review-banner" role="region" aria-label="${escapeHtml(t(lang, 'review_aria'))}">
    <p class="review-banner__text">${escapeHtml(t(lang, 'review_prompt'))}</p>
    <div class="review-banner__actions">
      <button type="button" class="review-banner__rate" data-action="review-rate">${escapeHtml(t(lang, 'review_rate'))}</button>
      <button type="button" class="review-banner__later textlink" data-action="review-dismiss">${escapeHtml(t(lang, 'review_later'))}</button>
    </div>
  </div>`;

const renderLoading = (lang, messageKey = 'loading') => {
  app.innerHTML = '';
  setDocumentLang(lang);
  appendHtml(
    app,
    `${topbar(lang)}
      <div class="loading-body">
        <p class="loading-text" role="status" aria-live="polite">
          <span class="loading-indicator" aria-hidden="true">
            <span class="loading-dot"></span>
          </span>
          ${escapeHtml(t(lang, messageKey))}
        </p>
      </div>`,
  );
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const matchesChannelQuery = (channel, query) => {
  if (!query) return true;
  const login = normalizeText(channel.login);
  const displayName = normalizeText(channel.displayName);
  return login.includes(query) || displayName.includes(query);
};

const sortChannels = (channels, selected) =>
  [...channels].sort((left, right) => {
    const leftSelected = selected.has(left.login) ? 1 : 0;
    const rightSelected = selected.has(right.login) ? 1 : 0;
    if (leftSelected !== rightSelected) return rightSelected - leftSelected;

    const leftLive = left.isLive ? 1 : 0;
    const rightLive = right.isLive ? 1 : 0;
    if (leftLive !== rightLive) return rightLive - leftLive;

    const leftName = (left.displayName || left.login).toLowerCase();
    const rightName = (right.displayName || right.login).toLowerCase();
    return leftName.localeCompare(rightName);
  });

const selectedChannelsList = (channels, selectedLogins) => {
  const byLogin = new Map(channels.map((channel) => [channel.login, channel]));
  const fallbackChannel = (login) => ({
    login,
    displayName: login,
    game: '',
    viewers: 0,
    isLive: false,
  });
  return selectedLogins
    .map((login) => byLogin.get(login) || fallbackChannel(login))
    .filter(Boolean);
};

const availableChannelsList = (channels, selected) =>
  sortChannels(
    channels.filter((channel) => !selected.has(channel.login)),
    selected,
  );

const buildSelectedQueueItems = (state) => {
  const channels = state.channels || [];
  const rotation = state.rotation || { channels: [], queueOrder: [], status: 'stopped' };
  const byLogin = new Map(channels.map((channel) => [channel.login, channel]));
  const fallbackChannel = (login) => ({
    login,
    displayName: login,
    game: '',
    viewers: 0,
    isLive: false,
  });
  const selectedLogins = rotation.channels || [];
  const selectedSet = new Set(selectedLogins);
  const activeSet =
    rotation.status === 'playing'
      ? new Set((state.playingLogins || []).filter(Boolean))
      : new Set();

  const liveSelected = selectedLogins.filter((login) => byLogin.get(login)?.isLive);
  const liveSet = new Set(liveSelected);
  const queueSource =
    rotation.status === 'playing' && rotation.queueOrder?.length
      ? rotation.queueOrder
      : liveSelected;
  const queueLive = [];
  const queueSeen = new Set();

  for (const login of queueSource) {
    if (!selectedSet.has(login) || !liveSet.has(login) || queueSeen.has(login)) continue;
    queueLive.push(login);
    queueSeen.add(login);
  }

  for (const login of liveSelected) {
    if (queueSeen.has(login)) continue;
    queueLive.push(login);
    queueSeen.add(login);
  }

  const queuePositionByLogin = new Map(
    queueLive.map((login, index) => [login, index + 1]),
  );
  const offline = selectedLogins.filter((login) => !liveSet.has(login));
  const orderedLogins = [...queueLive, ...offline];

  return orderedLogins
    .map((login) => {
      const channel = byLogin.get(login) || fallbackChannel(login);
      return {
        channel,
        login,
        queuePosition: queuePositionByLogin.get(login) || null,
        isActive: activeSet.has(login),
      };
    })
    .filter(Boolean);
};

const applyChannelSearchFilter = (queryValue) => {
  const query = normalizeText(queryValue);
  const channelItems = app.querySelectorAll('[data-available-item]');
  let visibleCount = 0;

  for (const item of channelItems) {
    const login = item.dataset.channelLogin || '';
    const displayName = item.dataset.channelName || '';
    const matches = matchesChannelQuery({ login, displayName }, query);
    item.hidden = !matches;
    if (matches) visibleCount += 1;
  }

  const emptyState = app.querySelector('[data-search-empty]');
  if (emptyState) emptyState.hidden = visibleCount > 0;
};

const render = (state) => {
  currentState = state;
  stopCountdown();
  window.scrollTo(0, 0);
  app.innerHTML = '';
  app.classList.remove('app--guest');
  document.body.classList.remove('body--guest');
  const lang = state?.settings?.lang || 'pt';
  setDocumentLang(lang);

  if (!state || (!('clientIdSet' in state) && !('authed' in state))) {
    if (state?.error) showToast(state.error);
    app.appendChild(htmlElement(topbar(lang)));
    app.appendChild(
      htmlElement(`<div class="dev-note"><p>${escapeHtml(t(lang, 'popup_error'))}</p></div>`),
    );
    return;
  }

  if (!state.clientIdSet) {
    app.appendChild(
      htmlElement(`<div class="dev-note">
        <h1 class="wordmark" style="font-size:22px">support<em>my</em>streamers</h1>
        <p style="color:var(--text-faint);font-size:13px;line-height:1.5">${escapeHtml(t(lang, 'dev_client_id_note'))}</p>
      </div>`),
    );
    return;
  }

  if (!state.authed) {
    app.classList.add('app--guest');
    document.body.classList.add('body--guest');
    app.appendChild(htmlElement(topbar(lang)));
    app.appendChild(
      htmlElement(`<div class="hero">
        <p class="hero-sub">${escapeHtml(t(lang, 'hero_sub'))}</p>
        <button class="play-btn wide" data-action="login">${escapeHtml(t(lang, 'connect'))}</button>
      </div>`),
    );
    return;
  }

  const { rotation, user, channels = [] } = state;
  const selected = new Set(rotation.channels);
  const playing = rotation.status === 'playing';
  const liveCount = channels.filter((channel) => channel.isLive).length;
  const selectedChannels = selectedChannelsList(channels, rotation.channels);
  const selectedQueueItems = buildSelectedQueueItems(state);
  const selectedLiveCountValue = selectedChannels.filter((channel) => channel.isLive).length;
  const availableChannels = availableChannelsList(channels, selected);

  app.appendChild(htmlElement(topbar(lang)));
  app.appendChild(
    htmlElement(`<p class="greeting">${escapeHtml(t(lang, 'hi'))} <strong>${escapeHtml(user.displayName || user.login)}</strong> · <button class="textlink" data-action="logout">${escapeHtml(t(lang, 'logout'))}</button></p>`),
  );

  const playLabel = rotation.status === 'paused' ? t(lang, 'resume') : t(lang, 'start');
  const dockControls = playing
    ? `<button class="play-btn wide" data-action="stop">⏹ ${escapeHtml(t(lang, 'stop'))}</button>`
    : `<button class="play-btn wide" data-action="play">▶ ${escapeHtml(playLabel)}</button>`;

  app.appendChild(
    htmlElement(`<div class="dock dock--single">
      ${dockControls}
      <div class="ticker">${playing ? '<span class="pulse"></span>' : ''}${escapeHtml(statusText(state))}</div>
      ${playing ? cycleBarHtml(state) : ''}
    </div>`),
  );
  startCycleBar(state);

  if (state.showReviewPrompt) {
    app.appendChild(htmlElement(reviewBanner(lang)));
  }

  if (state.error) app.appendChild(htmlElement(`<p class="error-line">${escapeHtml(state.error)}</p>`));

  if (!channels.length) {
    app.appendChild(
      htmlElement(`<div class="empty">
        <div class="empty-glyph">${TV_ICON}</div>
        <p class="empty-title">${escapeHtml(t(lang, 'empty_following_title'))}</p>
        <p class="empty-sub">${escapeHtml(t(lang, 'empty_following_sub'))}</p>
      </div>`),
    );
    return;
  }

  const main = htmlElement('<div class="popup-main"></div>');
  const lists = htmlElement('<div class="dual-lists"></div>');
  const selectedHint = selectedChannels.length
    ? `<p class="panel-hint">${escapeHtml(t(lang, 'selected_queue_hint'))}</p>`
    : '';

  const selectedPanel = htmlElement(`<section class="panel panel-static">
    <div class="panel-summary panel-summary--static">
      <span class="panel-title">${escapeHtml(t(lang, 'selected_panel_title'))}</span>
      <span class="panel-count"><span class="panel-count-live"><span class="panel-count-live-dot"></span>${selectedLiveCountValue}</span> / ${selectedChannels.length}</span>
    </div>
    <div class="panel-body panel-body--fixed">
      ${selectedHint}
      ${selectedChannels.length ? '<ul class="selected-list" data-selected-list></ul>' : `<p class="panel-empty">${escapeHtml(t(lang, 'selected_empty'))}</p>`}
    </div>
  </section>`);

  if (selectedChannels.length) {
    const selectedList = selectedPanel.querySelector('[data-selected-list]');
    selectedQueueItems.forEach((item, index) => {
      const { channel, queuePosition, isActive } = item;
      const stateClass = channel.isLive ? 'ch-state--live' : 'ch-state--offline';
      const stateLabel = channel.isLive ? t(lang, 'live_badge') : t(lang, 'offline_badge');
      const metaLabel = channel.isLive
        ? channel.game || t(lang, 'live_fallback')
        : t(lang, 'offline_meta');
      const queueBadge = queuePosition
        ? `<span class="ch-badge ch-badge--queue">#${queuePosition}</span>`
        : '';
      const activeBadge = isActive
        ? `<span class="ch-badge ch-badge--active">${escapeHtml(t(lang, 'active_badge'))}</span>`
        : '';

      selectedList.appendChild(
        htmlElement(`<li class="ch ch--selected${isActive ? ' ch--active' : ''}" style="--i:${index}">
          <button type="button" class="ch-row ch-row--button" data-toggle="${escapeHtml(channel.login)}" aria-label="${escapeHtml(t(lang, 'remove_from_selected_aria', channel.displayName || channel.login))}">
            <span class="ch-info">
              <span class="ch-headline">
                <span class="ch-name">${escapeHtml(channel.displayName || channel.login)}</span>
                ${queueBadge}
                ${activeBadge}
                <span class="ch-state ${stateClass}">${escapeHtml(stateLabel)}</span>
              </span>
              <span class="ch-meta">${escapeHtml(metaLabel)}</span>
            </span>
            ${channel.isLive ? `<span class="ch-viewers">${formatViewers(channel.viewers)}</span>` : ''}
          </button>
        </li>`),
      );
    });
  }
  lists.appendChild(selectedPanel);

  const availablePanel = htmlElement(`<section class="panel panel-static panel--channels">
    <div class="panel-summary panel-summary--static">
      <span class="panel-title"><span class="live-dot"></span>${escapeHtml(t(lang, 'channels_panel_title'))}</span>
      <span class="panel-count"><span class="panel-count-live"><span class="panel-count-live-dot"></span>${liveCount}</span> / ${channels.length}</span>
    </div>
    <div class="panel-body panel-body--fixed">
      <div class="search-wrap">
        <input
          class="search-input"
          type="search"
          data-search
          value="${escapeHtml(channelSearchQuery)}"
          placeholder="${escapeHtml(t(lang, 'search_channels_placeholder'))}"
          aria-label="${escapeHtml(t(lang, 'search_channels_aria'))}"
        />
      </div>
      <ul class="channels${listRevealed ? '' : ' reveal'}" data-available-list></ul>
      <div class="empty empty--compact" data-search-empty hidden>
        <p class="empty-title">${escapeHtml(t(lang, 'search_empty_title'))}</p>
        <p class="empty-sub">${escapeHtml(t(lang, 'search_empty_sub'))}</p>
      </div>
    </div>
  </section>`);

  const availableList = availablePanel.querySelector('[data-available-list]');
  availableChannels.forEach((channel, index) => {
    const stateClass = channel.isLive ? 'ch-state--live' : 'ch-state--offline';
    const stateLabel = channel.isLive ? t(lang, 'live_badge') : t(lang, 'offline_badge');
    const metaLabel = channel.isLive
      ? channel.game || t(lang, 'live_fallback')
      : t(lang, 'offline_meta');

    availableList.appendChild(
      htmlElement(`<li class="ch" style="--i:${index}" data-available-item data-channel-login="${escapeHtml(channel.login)}" data-channel-name="${escapeHtml(channel.displayName || channel.login)}">
        <button type="button" class="ch-row ch-row--button" data-toggle="${escapeHtml(channel.login)}" aria-label="${escapeHtml(t(lang, 'add_to_selected_aria', channel.displayName || channel.login))}">
          <span class="ch-info">
            <span class="ch-headline">
              <span class="ch-name">${escapeHtml(channel.displayName || channel.login)}</span>
              <span class="ch-state ${stateClass}">${escapeHtml(stateLabel)}</span>
            </span>
            <span class="ch-meta">${escapeHtml(metaLabel)}</span>
          </span>
          ${channel.isLive ? `<span class="ch-viewers">${formatViewers(channel.viewers)}</span>` : ''}
        </button>
      </li>`),
    );
  });

  lists.appendChild(availablePanel);
  main.appendChild(lists);
  app.appendChild(main);
  listRevealed = true;
  applyChannelSearchFilter(channelSearchQuery);
};

const ACTION_TO_MSG = {
  login: 'LOGIN',
  logout: 'LOGOUT',
  play: 'PLAY',
  stop: 'STOP',
};

const handleAppClick = async (event) => {
  const toggleTarget = event.target.closest('[data-toggle]');
  if (toggleTarget) {
    const login = toggleTarget.dataset.toggle;
    const selectedList = app.querySelector('[data-selected-list]');
    const availableList = app.querySelector('[data-available-list]');
    const selectedScrollTop = selectedList?.scrollTop ?? 0;
    const availableScrollTop = availableList?.scrollTop ?? 0;
    const previousState = currentState;

    toggleTarget.disabled = true;
    try {
      const result = await send({ type: 'TOGGLE_CHANNEL', login });
      if (result?.error) {
        showToast(result.error);
        return;
      }

      const mergedState =
        previousState && result?.rotation
          ? {
              ...previousState,
              rotation: result.rotation,
              playingLogins:
                result.playingLogins ?? previousState.playingLogins ?? [],
            }
          : await send({ type: 'GET_STATE' });

      render(mergedState);
      const nextSelectedList = app.querySelector('[data-selected-list]');
      const nextAvailableList = app.querySelector('[data-available-list]');
      if (nextSelectedList) nextSelectedList.scrollTop = selectedScrollTop;
      if (nextAvailableList) nextAvailableList.scrollTop = availableScrollTop;
    } catch (error) {
      if (previousState) render(previousState);
      showToast(String(error.message || error));
    } finally {
      toggleTarget.disabled = false;
    }
    return;
  }

  const trigger = event.target.closest('[data-action]');
  if (!trigger) return;
  const action = trigger.dataset.action;

  if (action === 'options') {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (action === 'review-dismiss') {
    const current = await getReviewPrompt();
    await setReviewPrompt({ ...current, dismissedAt: Date.now() });
    const state = await send({ type: 'GET_STATE' });
    render(state);
    return;
  }

  if (action === 'review-rate') {
    const current = await getReviewPrompt();
    await setReviewPrompt({ ...current, ratedAt: Date.now() });
    chrome.tabs.create({ url: storeReviewUrl(chrome.runtime.id) });
    const state = await send({ type: 'GET_STATE' });
    render(state);
    return;
  }

  const settings = await getSettings();
  const lang = settings.lang || 'pt';

  if (action === 'login') {
    renderLoading(lang, 'loading_auth');
  }

  trigger.disabled = true;
  try {
    const state = await send({ type: ACTION_TO_MSG[action] });
    if (state?.error) showToast(state.error);
    render(state);
  } catch (error) {
    showToast(String(error.message || error));
    try {
      const state = await send({ type: 'GET_STATE' });
      render(state);
    } catch {
      render({ settings: { lang: 'pt' }, clientIdSet: true, authed: false });
    }
  } finally {
    trigger.disabled = false;
  }
};

const handleAppChange = async (event) => {
  if (event.target.dataset?.lang !== undefined) {
    const state = await send({ type: 'SET_SETTINGS', settings: { lang: event.target.value } });
    render(state);
  }
};

const handleAppInput = (event) => {
  if (event.target.dataset?.search === undefined) return;
  channelSearchQuery = event.target.value;
  applyChannelSearchFilter(channelSearchQuery);
};

const init = async () => {
  const settings = await getSettings();
  const lang = settings.lang || 'pt';
  const auth = await getAuth();
  renderLoading(lang, auth ? 'loading_channels' : 'loading');
  try {
    const state = await send({ type: 'GET_STATE' });
    render(state);
  } catch (error) {
    showToast(String(error.message || error));
    render({ settings, clientIdSet: true, authed: false });
  }
};

app.addEventListener('click', handleAppClick);
app.addEventListener('change', handleAppChange);
app.addEventListener('input', handleAppInput);

init();
