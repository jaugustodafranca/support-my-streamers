// Application constants.

// Twitch public OAuth Client ID (implicit grant — visible in the extension package).
export const CLIENT_ID = '4zyirev8jnklp5qy6wje4wo2mijjxn';

// Chrome extension IDs — register both OAuth redirect URLs in the Twitch Developer app.
export const CHROME_EXTENSION_ID_STORE = 'bpjhjcekcenklbleioenphdccfengmmd';
// Pinned via manifest.json "key" — stable across machines (not path-derived).
export const CHROME_EXTENSION_ID_DEV = 'oolehnbhbkfbcalfbcfhgdpnpedcfnnf';

export const OAUTH_REDIRECT_URI_STORE = `https://${CHROME_EXTENSION_ID_STORE}.chromiumapp.org/`;
export const OAUTH_REDIRECT_URI_DEV = `https://${CHROME_EXTENSION_ID_DEV}.chromiumapp.org/`;

/** All redirect URIs to allow in Twitch OAuth settings. */
export const TWITCH_OAUTH_REDIRECT_URIS = [OAUTH_REDIRECT_URI_STORE, OAUTH_REDIRECT_URI_DEV];

export const SCOPES = ['user:read:follows'];
export const HELIX_BASE = 'https://api.twitch.tv/helix';
export const TWITCH_AUTH_BASE = 'https://id.twitch.tv/oauth2/authorize';
export const TAB_GROUP_TITLE = 'Support My Streamers';

// Fixed concurrent tab count (not user-configurable): 2, or fewer if fewer channels.
export const SLOTS = 2;

// When rotation interval is ∞ (0), still run health checks every N minutes.
export const HEALTH_CHECK_MINUTES = 5;

// Rotation interval options (minutes). 0 = never switch (∞).
export const ROTATION_STEPS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 0];

export const DEFAULT_SETTINGS = {
  intervalMinutes: 10,
  audio: 'muted', // 'muted' | 'on'
  lang: 'pt', // 'pt' | 'en'
};

export const DEFAULT_ROTATION = {
  channels: [], // user-selected logins, in list order
  queueOrder: [], // FIFO: shuffled once at play start, then strict queue order
  status: 'stopped', // 'stopped' | 'playing' | 'paused'
};

/** Successful play starts before showing the store review invite. */
export const REVIEW_PROMPT_MIN_PLAYS = 3;

/** Days to wait after "Not now" before asking again. */
export const REVIEW_PROMPT_SNOOZE_DAYS = 14;
