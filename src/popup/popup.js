import { t } from '../i18n.js';
import { needsRotation } from '../rotation.js';
import { SLOTS } from '../config.js';
import { getSettings } from '../storage.js';

const app = document.getElementById('app');
const toast = document.getElementById('toast');
let toastTimer = null;
let listRevealed = false;

const GEAR_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
const TV_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="m17 2-5 5-5-5"/></svg>`;

function send(msg) {
  return chrome.runtime.sendMessage(msg);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

function formatViewers(n) {
  if (typeof n !== 'number') return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3000);
}

function statusText(state) {
  const { rotation, settings, live } = state;
  const lang = settings.lang || 'pt';
  const selectedLive = rotation.channels.filter((c) => live.some((s) => s.login === c)).length;
  if (rotation.status === 'playing') {
    const rotating =
      needsRotation(selectedLive, SLOTS) && settings.intervalMinutes > 0;
    const interval = rotating ? settings.intervalMinutes : 0;
    return t(lang, 'status_playing', Math.min(SLOTS, selectedLive), selectedLive, interval);
  }
  if (rotation.status === 'paused') {
    return t(lang, 'status_paused', rotation.channels.length);
  }
  return t(lang, 'selected', rotation.channels.length);
}

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

const renderLoading = (lang) => {
  app.innerHTML = '';
  setDocumentLang(lang);
  app.appendChild(
    el(`${topbar(lang)}
      <div class="loading-body">
        <p class="loading-text">
          <span class="loading-dot" aria-hidden="true"></span>
          ${escapeHtml(t(lang, 'loading'))}
        </p>
      </div>`),
  );
};

function render(state) {
  app.innerHTML = '';
  const lang = state?.settings?.lang || 'pt';
  setDocumentLang(lang);

  if (!state || (!('clientIdSet' in state) && !('authed' in state))) {
    if (state?.error) showToast(state.error);
    app.appendChild(el(topbar(lang)));
    app.appendChild(
      el(`<div class="dev-note"><p>${escapeHtml(t(lang, 'popup_error'))}</p></div>`),
    );
    return;
  }

  if (!state.clientIdSet) {
    app.appendChild(
      el(`<div class="dev-note">
        <h1 class="wordmark" style="font-size:22px">support<em>my</em>streamers</h1>
        <p style="color:var(--text-faint);font-size:13px;line-height:1.5">Sem Client-ID configurado. Defina <code>CLIENT_ID</code> em <code>src/config.js</code>.</p>
      </div>`),
    );
    return;
  }

  if (!state.authed) {
    app.appendChild(el(topbar(lang)));
    app.appendChild(
      el(`<div class="hero">
        <p class="hero-sub">${escapeHtml(t(lang, 'hero_sub'))}</p>
        <button class="play-btn wide" data-action="login">${escapeHtml(t(lang, 'connect'))}</button>
      </div>`),
    );
    return;
  }

  const { rotation, user, live } = state;
  const selected = new Set(rotation.channels);
  const playing = rotation.status === 'playing';

  app.appendChild(el(topbar(lang)));
  app.appendChild(
    el(`<p class="greeting">${escapeHtml(t(lang, 'hi'))} <strong>${escapeHtml(user.displayName || user.login)}</strong> · <button class="textlink" data-action="logout">${escapeHtml(t(lang, 'logout'))}</button></p>`),
  );

  const playLabel = rotation.status === 'paused' ? t(lang, 'resume') : t(lang, 'start');
  app.appendChild(
    el(`<div class="dock">
      ${
        playing
          ? `<button class="play-btn playing" data-action="pause">⏸ ${escapeHtml(t(lang, 'pause'))}</button>`
          : `<button class="play-btn" data-action="play">▶ ${escapeHtml(playLabel)}</button>`
      }
      <button class="ghost-btn" data-action="stop" ${rotation.status === 'stopped' ? 'disabled' : ''}>${escapeHtml(t(lang, 'stop'))}</button>
      <div class="ticker">${playing ? '<span class="pulse"></span>' : ''}${escapeHtml(statusText(state))}</div>
    </div>`),
  );

  if (state.error) app.appendChild(el(`<p class="error-line">${escapeHtml(state.error)}</p>`));

  if (!live.length) {
    app.appendChild(
      el(`<div class="empty">
        <div class="empty-glyph">${TV_ICON}</div>
        <p class="empty-title">${escapeHtml(t(lang, 'empty_title'))}</p>
        <p class="empty-sub">${escapeHtml(t(lang, 'empty_sub'))}</p>
      </div>`),
    );
    return;
  }

  app.appendChild(
    el(`<div class="section-head">
      <span class="label"><span class="live-dot"></span>${escapeHtml(t(lang, 'live_now'))}</span>
      <span class="count">${live.length}</span>
    </div>`),
  );

  const list = el(`<ul class="channels${listRevealed ? '' : ' reveal'}"></ul>`);
  live.forEach((s, i) => {
    list.appendChild(
      el(`<li class="ch" style="--i:${i}">
        <label class="ch-row">
          <input type="checkbox" class="vh" data-toggle="${escapeHtml(s.login)}" ${selected.has(s.login) ? 'checked' : ''} />
          <span class="switch"></span>
          <span class="ch-info">
            <span class="ch-name">${escapeHtml(s.displayName || s.login)}</span>
            <span class="ch-meta">${escapeHtml(s.game || t(lang, 'live_fallback'))}</span>
          </span>
          <span class="ch-viewers">${formatViewers(s.viewers)}</span>
        </label>
      </li>`),
    );
  });
  app.appendChild(list);
  listRevealed = true;
}

const ACTION_TO_MSG = {
  login: 'LOGIN',
  logout: 'LOGOUT',
  play: 'PLAY',
  pause: 'PAUSE',
  stop: 'STOP',
};

app.addEventListener('click', async (e) => {
  const trigger = e.target.closest('[data-action]');
  if (!trigger) return;
  const action = trigger.dataset.action;

  if (action === 'options') {
    chrome.runtime.openOptionsPage();
    return;
  }

  trigger.disabled = true;
  try {
    const state = await send({ type: ACTION_TO_MSG[action] });
    if (state?.error) showToast(state.error);
    render(state);
  } catch (err) {
    showToast(String(err.message || err));
  }
});

app.addEventListener('change', async (e) => {
  if (e.target.dataset?.lang !== undefined) {
    const state = await send({ type: 'SET_SETTINGS', settings: { lang: e.target.value } });
    render(state);
    return;
  }

  const login = e.target.dataset?.toggle;
  if (!login) return;
  const state = await send({ type: 'TOGGLE_CHANNEL', login });
  render(state);
});

async function init() {
  const settings = await getSettings();
  const lang = settings.lang || 'pt';
  renderLoading(lang);
  const state = await send({ type: 'GET_STATE' });
  render(state);
}

init();
