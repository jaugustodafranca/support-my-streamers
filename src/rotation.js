// Pure rotation logic. No chrome.* dependency — easy to test.

/** Rotation applies only when there are more channels than tab slots. */
export function needsRotation(length, slots) {
  return length > slots;
}

/** Fisher–Yates shuffle. Only used once when play starts. */
export function shuffleLogins(logins, random = Math.random) {
  const arr = [...logins];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** FIFO queue at play start: shuffle once, then strict queue order. */
export function initFifoRotation(liveLogins, slots, random = Math.random) {
  const queueOrder = shuffleLogins(liveLogins, random);
  const showing = queueOrder.slice(0, Math.min(slots, queueOrder.length));
  return { queueOrder, showing };
}

/** Move channels that just finished showing to the back of the queue. */
export function rotateQueueOrder(queueOrder, showing) {
  const showingSet = new Set(showing);
  const waiting = queueOrder.filter((login) => !showingSet.has(login));
  const finished = queueOrder.filter((login) => showingSet.has(login));
  return [...waiting, ...finished];
}

/** Drop offline channels; append newly live channels at the end (FIFO). */
export function syncFifoQueue(queueOrder, liveLogins) {
  const liveSet = new Set(liveLogins);
  const nextOrder = queueOrder.filter((login) => liveSet.has(login));
  for (const login of liveLogins) {
    if (!nextOrder.includes(login)) nextOrder.push(login);
  }
  return nextOrder;
}

/** First-in-first-out: next slots live channels from the front of the queue. */
export function pickFifoWindow(queueOrder, liveLogins, slots) {
  const liveSet = new Set(liveLogins);
  const picked = [];
  for (const login of queueOrder) {
    if (!liveSet.has(login)) continue;
    picked.push(login);
    if (picked.length === slots) break;
  }
  return picked;
}

/**
 * Next FIFO window after a rotation tick.
 * Refreshes live status each cycle; returns null when rotation does not apply.
 */
export function tickFifoRotation({ liveLogins, showing, queueOrder, slots }) {
  if (!needsRotation(liveLogins.length, slots)) return null;

  const rotated = rotateQueueOrder(queueOrder, showing);
  const synced = syncFifoQueue(rotated, liveLogins);
  const nextShowing = pickFifoWindow(synced, liveLogins, slots);
  const changed =
    nextShowing.length === showing.length &&
    nextShowing.every((login, i) => login === showing[i])
      ? false
      : true;

  return { showing: nextShowing, queueOrder: synced, changed };
}

/** Progress through a timed cycle (0–1) from scheduled end time and period length. */
export function cycleProgress(nextCycleAt, periodMs, now = Date.now()) {
  if (!periodMs || periodMs <= 0) return { progress: 0, remainingMs: 0 };
  if (!nextCycleAt) return { progress: 0, remainingMs: periodMs };
  const remainingMs = Math.max(0, nextCycleAt - now);
  const progress = Math.min(1, Math.max(0, 1 - remainingMs / periodMs));
  return { progress, remainingMs };
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
