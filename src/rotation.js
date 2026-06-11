// Lógica pura da rotação. Sem dependência de chrome.* — fácil de testar.

/**
 * Retorna a "janela" de canais visíveis começando em `cursor`, com `slots`
 * posições, dando a volta (round-robin) quando passa do fim da lista.
 */
export function windowAt(channels, cursor, slots) {
  if (!channels.length) return [];
  const count = Math.min(slots, channels.length);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(channels[(cursor + i) % channels.length]);
  }
  return out;
}

/** Avança o cursor em `slots` posições, dando a volta. */
export function nextCursor(cursor, slots, length) {
  if (length <= 0) return 0;
  return (cursor + slots) % length;
}

/** Só faz sentido rotacionar se há mais canais do que abas. */
export function needsRotation(length, slots) {
  return length > slots;
}

const NON_CHANNEL_SEGMENTS = new Set([
  'videos',
  'directory',
  'settings',
  'p',
  'clip',
  'collections',
]);

/** Extrai o login do canal a partir da URL da aba (ex.: twitch.tv/nome). */
export function parseChannelLogin(url) {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname !== 'www.twitch.tv' && hostname !== 'twitch.tv') return null;
    const segment = pathname.split('/').filter(Boolean)[0]?.toLowerCase();
    if (!segment || NON_CHANNEL_SEGMENTS.has(segment)) return null;
    return segment;
  } catch {
    return null;
  }
}

/** Primeiro canal ao vivo ainda não ocupado por outra aba. */
export function nextReplacement(live, taken) {
  const takenSet = new Set(taken);
  return live.find((login) => !takenSet.has(login)) ?? null;
}

/** Canais ao vivo da lista ainda sem aba, até o limite de slots. */
export function unshownLive(live, shown, slots) {
  const shownSet = new Set(shown);
  const limit = Math.min(slots, live.length);
  const out = [];
  for (const login of live) {
    if (out.length >= limit - shownSet.size) break;
    if (!shownSet.has(login)) out.push(login);
  }
  return out;
}

/**
 * Decide o que fazer com uma aba no fim do ciclo.
 * Só considera canais da lista do usuário (`live`). Raid sem substituto → fecha.
 * @returns {{ action: 'keep' | 'navigate' | 'close', login?: string }}
 */
export function decideTabAction({ supportedLogin, currentLogin, live, taken }) {
  const liveSet = new Set(live);
  const onSupportedPage = currentLogin === supportedLogin;

  if (liveSet.has(supportedLogin)) {
    return onSupportedPage
      ? { action: 'keep', login: supportedLogin }
      : { action: 'navigate', login: supportedLogin };
  }

  const replacement = nextReplacement(live, taken);
  if (replacement) {
    return { action: 'navigate', login: replacement };
  }

  // Offline sem ninguém na lista para trocar: mantém só se ainda está no canal apoiado.
  if (onSupportedPage) {
    return { action: 'keep', login: supportedLogin };
  }

  return { action: 'close' };
}
