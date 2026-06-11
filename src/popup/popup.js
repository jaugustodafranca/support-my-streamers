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

const selectedLiveCount = (rotation, live) =>
  rotation.channels.filter((channel) => live.some((stream) => stream.login === channel)).length;

const isRotating = (state) => {
  const { rotation, settings, live } = state;
  if (rotation.status !== 'playing') return false;
  const count = selectedLiveCount(rotation, live);
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

const displayNameForLogin = (login, live) => {
  const stream = live.find((item) => item.login === login);
  return stream?.displayName || login;
};

const statusText = (state) => {
  const { rotation, settings, live } = state;
  const lang = settings.lang || 'pt';
  if (rotation.status === 'playing') {
    const logins =
      state.playingLogins?.filter(Boolean).length
        ? state.playingLogins
        : rotation.queueOrder?.slice(0, SLOTS) ?? [];
    const names = logins.map((login) => displayNameForLogin(login, live));
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

const render = (state) => {
  stopCountdown();
  window.scrollTo(0, 0);
  app.innerHTML = '';
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
    app.appendChild(htmlElement(topbar(lang)));
    app.appendChild(
      htmlElement(`<div class="hero">
        <p class="hero-sub">${escapeHtml(t(lang, 'hero_sub'))}</p>
        <button class="play-btn wide" data-action="login">${escapeHtml(t(lang, 'connect'))}</button>
      </div>`),
    );
    return;
  }

  const { rotation, user, live } = state;
  const selected = new Set(rotation.channels);
  const playing = rotation.status === 'playing';

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

  if (!live.length) {
    app.appendChild(
      htmlElement(`<div class="empty">
        <div class="empty-glyph">${TV_ICON}</div>
        <p class="empty-title">${escapeHtml(t(lang, 'empty_title'))}</p>
        <p class="empty-sub">${escapeHtml(t(lang, 'empty_sub'))}</p>
      </div>`),
    );
    return;
  }

  const main = htmlElement('<div class="popup-main"></div>');
  main.appendChild(
    htmlElement(`<div class="section-head">
      <span class="label"><span class="live-dot"></span>${escapeHtml(t(lang, 'live_now'))}</span>
      <span class="count">${live.length}</span>
    </div>`),
  );

  const list = htmlElement(`<ul class="channels${listRevealed ? '' : ' reveal'}"></ul>`);
  live.forEach((stream, index) => {
    list.appendChild(
      htmlElement(`<li class="ch" style="--i:${index}">
        <label class="ch-row">
          <input type="checkbox" class="vh" data-toggle="${escapeHtml(stream.login)}" ${selected.has(stream.login) ? 'checked' : ''} />
          <span class="switch"></span>
          <span class="ch-info">
            <span class="ch-name">${escapeHtml(stream.displayName || stream.login)}</span>
            <span class="ch-meta">${escapeHtml(stream.game || t(lang, 'live_fallback'))}</span>
          </span>
          <span class="ch-viewers">${formatViewers(stream.viewers)}</span>
        </label>
      </li>`),
    );
  });
  main.appendChild(list);
  app.appendChild(main);
  listRevealed = true;
};

const ACTION_TO_MSG = {
  login: 'LOGIN',
  logout: 'LOGOUT',
  play: 'PLAY',
  stop: 'STOP',
};

const handleAppClick = async (event) => {
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
    return;
  }

  const login = event.target.dataset?.toggle;
  if (!login) return;

  const checkbox = event.target;
  try {
    const state = await send({ type: 'TOGGLE_CHANNEL', login });
    if (state?.error) {
      checkbox.checked = !checkbox.checked;
      showToast(state.error);
    }
    // Keep layout stable: checkbox already reflects the toggle; no full re-render.
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    showToast(String(error.message || error));
  }
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

init();
