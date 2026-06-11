// Content script injected on rotation tabs. Keeps the Twitch player at full
// volume and playing so the stream counts as a viewer, while Chrome tab mute
// (set by the background worker) silences output for the user. Also dismisses
// mature-content and content-classification overlays (e.g. "Concordo").

const MAX_VOLUME = 1;
const RETRY_MS = 1000;
const WATCH_MS = 5000;

const OVERLAY_BUTTONS = [
  'button[data-a-target="player-overlay-mature-accept"]',
  'button[data-a-target="content-classification-gate-overlay-start-watching-button"]',
  'button[data-a-target="consent-banner-accept"]',
];

const findVideo = () => document.querySelector('video');

const clickIfVisible = (el) => {
  if (!el) return false;
  const { width, height } = el.getBoundingClientRect();
  if (width === 0 || height === 0) return false;
  el.click();
  return true;
};

const dismissOverlays = () => {
  for (const selector of OVERLAY_BUTTONS) {
    const button = document.querySelector(selector);
    clickIfVisible(button);
  }
};

const ensurePlayback = (video) => {
  if (video.muted) video.muted = false;
  if (video.volume < MAX_VOLUME) video.volume = MAX_VOLUME;
  if (video.paused) video.play().catch(() => {});
};

const setupPlayer = () => {
  const video = findVideo();
  if (!video) return false;
  ensurePlayback(video);
  return true;
};

let retryTimer = null;

const tick = () => {
  dismissOverlays();
  if (setupPlayer()) return;
  scheduleRetry();
};

const scheduleRetry = () => {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    tick();
  }, RETRY_MS);
};

const initPlayerWatch = () => {
  tick();

  const observer = new MutationObserver(tick);

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener(
      'DOMContentLoaded',
      () => observer.observe(document.body, { childList: true, subtree: true }),
      { once: true },
    );
  }

  setInterval(tick, WATCH_MS);
};

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'ENSURE_PLAYER') tick();
});

if (!globalThis.__smsPlayerActive) {
  globalThis.__smsPlayerActive = true;
  initPlayerWatch();
}
