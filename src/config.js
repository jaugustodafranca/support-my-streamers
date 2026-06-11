// Application constants.
//
// CLIENT_ID is the app registered at dev.twitch.tv/console/apps. It is embedded
// on purpose — Client-ID is public. End users only click "Connect with Twitch".
//
// App "support-my-streamers" registered at dev.twitch.tv.
export const CLIENT_ID = '4zyirev8jnklp5qy6wje4wo2mijjxn';

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
  channels: [], // logins selecionados, em ordem
  cursor: 0,
  status: 'stopped', // 'stopped' | 'playing' | 'paused'
};
