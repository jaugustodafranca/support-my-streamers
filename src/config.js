// Constantes da aplicação.
//
// CLIENT_ID é o ID do app que VOCÊ (desenvolvedor) registrou em
// dev.twitch.tv/console/apps. Vai embutido na extensão de propósito — Client-ID
// é público por natureza. O usuário final NÃO precisa criar nada: só clica em
// "Conectar com a Twitch" e autoriza.
//
// Client-ID do app "support-my-streamers" registrado em dev.twitch.tv.
export const CLIENT_ID = '4zyirev8jnklp5qy6wje4wo2mijjxn';

export const SCOPES = ['user:read:follows'];
export const HELIX_BASE = 'https://api.twitch.tv/helix';
export const TWITCH_AUTH_BASE = 'https://id.twitch.tv/oauth2/authorize';
export const TAB_GROUP_TITLE = 'Support My Streamers';

// Número fixo de abas simultâneas. Não é configurável: sempre 2 (ou 1 quando só
// há 1 canal marcado, porque a janela usa min(SLOTS, nº de canais)).
export const SLOTS = 2;

// Quando rotação está em ∞ (0), ainda verificamos offline/raid a cada N min.
export const HEALTH_CHECK_MINUTES = 5;

// Opções de tempo de rotação (minutos). 0 = não trocar (∞).
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
