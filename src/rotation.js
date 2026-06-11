// Pure rotation logic. No chrome.* dependency — easy to test.

/**
 * Visible channel window starting at cursor with slots positions (round-robin wrap).
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

/** Advance cursor by slots positions with wrap-around. */
export function nextCursor(cursor, slots, length) {
  if (length <= 0) return 0;
  return (cursor + slots) % length;
}

/** Rotation applies only when there are more channels than tab slots. */
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

/** Extract channel login from tab URL (e.g. twitch.tv/name). */
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

/** First live channel not already assigned to another tab. */
export function nextReplacement(live, taken) {
  const takenSet = new Set(taken);
  return live.find((login) => !takenSet.has(login)) ?? null;
}

/** Live list channels without a tab yet, up to slot limit. */
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
 * Decide tab action at end of sync cycle. Only user list channels (`live`).
 * Raid with no replacement → close.
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

  // Offline with no replacement: keep only if still on supported channel page.
  if (onSupportedPage) {
    return { action: 'keep', login: supportedLogin };
  }

  return { action: 'close' };
}
