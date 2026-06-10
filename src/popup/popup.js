const app = document.getElementById('app');
const toast = document.getElementById('toast');
let toastTimer = null;

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
  const selectedLive = rotation.channels.filter((c) => live.some((s) => s.login === c)).length;
  if (rotation.status === 'playing') {
    return `Rotacionando ${Math.min(settings.slots, selectedLive)} de ${selectedLive} ao vivo · troca a cada ${settings.intervalMinutes} min`;
  }
  if (rotation.status === 'paused') {
    return `Pausado · ${rotation.channels.length} canais na lista`;
  }
  return `${rotation.channels.length} canais selecionados`;
}

function render(state) {
  app.innerHTML = '';

  if (!state || (!('clientIdSet' in state) && !('authed' in state))) {
    if (state?.error) showToast(state.error);
    app.appendChild(el('<p class="muted pad">Algo deu errado. Tente reabrir o popup.</p>'));
    return;
  }

  if (!state.clientIdSet) {
    // Estado só visível ao desenvolvedor: CLIENT_ID não foi preenchido em config.js.
    app.appendChild(
      el(`<div class="pad">
        <h1>Support My Streamers</h1>
        <p class="muted">Extensão sem Client-ID configurado. Defina <b>CLIENT_ID</b> em <code>src/config.js</code>.</p>
      </div>`),
    );
    return;
  }

  if (!state.authed) {
    app.appendChild(
      el(`<div class="pad">
        <h1>Support My Streamers</h1>
        <p class="muted">Conecte sua conta da Twitch para ver quem você segue está ao vivo.</p>
        <button data-action="login" class="primary">Conectar com a Twitch</button>
      </div>`),
    );
    return;
  }

  const { rotation, user, live } = state;
  const selected = new Set(rotation.channels);

  app.appendChild(
    el(`<div class="header">
      <span>Olá, <b>${escapeHtml(user.displayName || user.login)}</b></span>
      <button data-action="logout" class="link">sair</button>
    </div>`),
  );

  const playLabel =
    rotation.status === 'paused' ? 'Retomar' : 'Iniciar';
  app.appendChild(
    el(`<div class="controls">
      ${
        rotation.status === 'playing'
          ? '<button data-action="pause" class="primary">⏸ Pausar</button>'
          : `<button data-action="play" class="primary">▶ ${playLabel}</button>`
      }
      <button data-action="stop" ${rotation.status === 'stopped' ? 'disabled' : ''}>⏹ Parar</button>
      <button data-action="options" class="link">opções</button>
    </div>`),
  );

  app.appendChild(el(`<p class="status">${escapeHtml(statusText(state))}</p>`));
  if (state.error) app.appendChild(el(`<p class="error">${escapeHtml(state.error)}</p>`));

  if (!live.length) {
    app.appendChild(el('<p class="muted pad">Nenhum dos seus follows está ao vivo agora.</p>'));
    return;
  }

  const list = el('<ul class="channels"></ul>');
  for (const s of live) {
    list.appendChild(
      el(`<li>
        <label>
          <input type="checkbox" data-toggle="${escapeHtml(s.login)}" ${selected.has(s.login) ? 'checked' : ''} />
          <span class="name">${escapeHtml(s.displayName || s.login)}</span>
          <span class="meta">${escapeHtml(s.game || 'Ao vivo')} · ${formatViewers(s.viewers)} 👀</span>
        </label>
      </li>`),
    );
  }
  app.appendChild(list);
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
  const login = e.target.dataset?.toggle;
  if (!login) return;
  const state = await send({ type: 'TOGGLE_CHANNEL', login });
  render(state);
});

async function init() {
  const state = await send({ type: 'GET_STATE' });
  render(state);
}

init();
