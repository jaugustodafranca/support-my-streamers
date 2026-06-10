// Constantes da aplicação.
//
// CLIENT_ID é o ID do app que VOCÊ (desenvolvedor) registrou em
// dev.twitch.tv/console/apps. Vai embutido na extensão de propósito — Client-ID
// é público por natureza. O usuário final NÃO precisa criar nada: só clica em
// "Conectar com a Twitch" e autoriza.
//
// >>> COLE AQUI o Client-ID do app do projeto: <<<
export const CLIENT_ID = '';

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
