// Constantes da aplicação. O Client-ID NÃO fica aqui — ele é configurado pelo
// usuário na página de Opções e guardado em chrome.storage.local.

export const SCOPES = ['user:read:follows'];
export const HELIX_BASE = 'https://api.twitch.tv/helix';
export const TWITCH_AUTH_BASE = 'https://id.twitch.tv/oauth2/authorize';
export const TAB_GROUP_TITLE = 'Rotacionando';

export const DEFAULT_SETTINGS = {
  intervalMinutes: 10,
  slots: 2,
  audio: 'muted', // 'muted' | 'on'
};

export const DEFAULT_ROTATION = {
  channels: [], // logins selecionados, em ordem
  cursor: 0,
  status: 'stopped', // 'stopped' | 'playing' | 'paused'
};
