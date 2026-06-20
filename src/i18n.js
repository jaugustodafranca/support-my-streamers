// Manual i18n (PT/EN), user-selected in Options. Not chrome.i18n (browser locale).
// Values may be strings or functions for interpolated copy.

export const LANGS = ['pt', 'en'];

/** Join streamer display names for status line (e.g. "Gaules e Cogu"). */
export const formatPlayingNames = (lang, names) => {
  const list = names?.filter(Boolean) ?? [];
  if (!list.length) return '…';
  const conj = lang === 'en' ? ' and ' : ' e ';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]}${conj}${list[1]}`;
  return `${list.slice(0, -1).join(', ')}${conj}${list[list.length - 1]}`;
};

const MESSAGES = {
  pt: {
    hero_sub: 'Apoie quem você acompanha deixando a live rolando enquanto faz outras coisas.',
    connect: 'Conectar com a Twitch',
    hi: 'Olá,',
    logout: 'Sair',
    start: 'Iniciar',
    resume: 'Retomar',
    pause: 'Pausar',
    stop: 'Parar',
    options: 'Opções',
    options_aria: 'Opções',
    lang_aria: 'Idioma',
    loading: 'Carregando…',
    loading_auth: 'Conectando com a Twitch…',
    loading_channels: 'Buscando quem está ao vivo…',
    live_fallback: 'Ao vivo',
    popup_error: 'Algo deu errado. Tente reabrir o popup.',
    dev_client_id_note: 'Sem Client-ID configurado.',
    oauth_redirect_hint:
      'Instalação local: cadastre a URL abaixo em dev.twitch.tv → seu app → OAuth Redirect URLs (pressione Enter após colar).',
    save_error: 'Não foi possível salvar. Tente de novo.',
    live_now: 'Ao vivo agora',
    following_now: 'Seguindo',
    channels_panel_title: 'Seus streamers',
    selected_panel_title: 'Selecionados',
    selected_count: (n) => `${n} selecionado${n === 1 ? '' : 's'}`,
    selected_empty: 'Nenhum streamer na rotacao ainda. Clique na lista da direita para adicionar.',
    selected_queue_hint: 'Fila da rotação: topo em cima · offline no final',
    following_count: (live, total) => `${live} online · ${total} seguidos`,
    add_to_selected_aria: (name) => `Adicionar ${name} aos selecionados`,
    remove_from_selected_aria: (name) => `Remover ${name} dos selecionados`,
    active_badge: 'ATIVO',
    search_channels_placeholder: 'Buscar canal...',
    search_channels_aria: 'Buscar canais seguidos',
    live_badge: 'Ao vivo',
    offline_badge: 'Offline',
    offline_meta: 'Sem transmissão agora',
    empty_title: 'Ninguém ao vivo agora',
    empty_sub: 'Quando alguém que você segue abrir a live, aparece aqui pra você apoiar.',
    empty_following_title: 'Você ainda não segue canais suficientes.',
    empty_following_sub: 'Siga canais na Twitch para montar sua rotação.',
    search_empty_title: 'Nenhum canal encontrado',
    search_empty_sub: 'Tente buscar por outro nome ou login.',
    selected: (n) => `${n} selecionado${n === 1 ? '' : 's'}`,
    status_playing: (names, min) => {
      const list = formatPlayingNames('pt', names);
      return min ? `Reproduzindo ${list} por ${min} min.` : `Reproduzindo ${list}.`;
    },
    status_paused: (n) => `Pausado · ${n} na lista`,
    next_rotation: (time) => `Próxima troca em ${time}`,
    next_rotation_soon: 'Próxima troca em breve',
    cycle_bar_label: 'Próxima troca',
    cycle_bar_check: 'Próximo ciclo',
    cycle_bar_aria: 'Tempo até a próxima troca',
    cycle_bar_infinite_aria: 'Sem troca automática de streamers',
    no_live_selected: 'Nenhum canal selecionado está ao vivo agora.',

    opt_tagline: 'Configurações',
    about_title: 'O que a extensão faz',
    about_text:
      'Conecta na sua conta da Twitch, mostra quem você segue que está ao vivo e mantém alguns abertos em rotação — pra você apoiar vários streamers sem ficar trocando na mão.',
    lang_label: 'Idioma',
    lang_hint: 'Idioma da interface da extensão.',
    time_label: 'Tempo de rotação',
    time_hint: 'De quanto em quanto tempo a extensão troca os streamers abertos.',
    time_never: 'Não trocar',
    audio_label: 'Áudio',
    audio_hint:
      '"Mudo" silencia a aba no navegador; o player da Twitch continua com volume alto pra contar como viewer.',
    audio_muted: 'Mudo',
    audio_on: 'Com som',
    save: 'Salvar',
    saved: 'Salvo!',
    minutes_unit: 'min',
    powered_by: 'powered by',
    review_prompt:
      'Curtiu? Uma avaliação na loja ajuda outros streamers a nos encontrarem.',
    review_rate: 'Avaliar',
    review_later: 'Agora não',
    review_aria: 'Convite para avaliar a extensão',
  },
  en: {
    hero_sub: 'Support the streamers you follow by keeping their live running while you do other things.',
    connect: 'Connect with Twitch',
    hi: 'Hi,',
    logout: 'Log out',
    start: 'Start',
    resume: 'Resume',
    pause: 'Pause',
    stop: 'Stop',
    options: 'Options',
    options_aria: 'Options',
    lang_aria: 'Language',
    loading: 'Loading…',
    loading_auth: 'Connecting with Twitch…',
    loading_channels: 'Fetching live channels…',
    live_fallback: 'Live',
    popup_error: 'Something went wrong. Try reopening the popup.',
    dev_client_id_note: 'No Client-ID configured.',
    oauth_redirect_hint:
      'Local install: register the URL below at dev.twitch.tv → your app → OAuth Redirect URLs (press Enter after pasting).',
    save_error: 'Could not save. Try again.',
    live_now: 'Live now',
    following_now: 'Following',
    channels_panel_title: 'Your streamers',
    selected_panel_title: 'Selected',
    selected_count: (n) => `${n} selected`,
    selected_empty: 'No streamer in rotation yet. Click on the right list to add one.',
    selected_queue_hint: 'Rotation queue: top first · offline at the end',
    following_count: (live, total) => `${live} live · ${total} followed`,
    add_to_selected_aria: (name) => `Add ${name} to selected`,
    remove_from_selected_aria: (name) => `Remove ${name} from selected`,
    active_badge: 'ACTIVE',
    search_channels_placeholder: 'Search channel...',
    search_channels_aria: 'Search followed channels',
    live_badge: 'Live',
    offline_badge: 'Offline',
    offline_meta: 'Not streaming right now',
    empty_title: 'No one live right now',
    empty_sub: 'When someone you follow goes live, they show up here for you to support.',
    empty_following_title: 'You are not following enough channels yet.',
    empty_following_sub: 'Follow channels on Twitch to build your rotation.',
    search_empty_title: 'No channels found',
    search_empty_sub: 'Try searching by another name or login.',
    selected: (n) => `${n} selected`,
    status_playing: (names, min) => {
      const list = formatPlayingNames('en', names);
      return min ? `Playing ${list} for ${min} min.` : `Playing ${list}.`;
    },
    status_paused: (n) => `Paused · ${n} in the list`,
    next_rotation: (time) => `Next switch in ${time}`,
    next_rotation_soon: 'Next switch soon',
    cycle_bar_label: 'Next switch',
    cycle_bar_check: 'Next cycle',
    cycle_bar_aria: 'Time until next switch',
    cycle_bar_infinite_aria: 'No automatic streamer switching',
    no_live_selected: 'None of the selected channels are live right now.',

    opt_tagline: 'Settings',
    about_title: 'What this extension does',
    about_text:
      'Connects to your Twitch account, shows which channels you follow are live, and keeps a few open on rotation — so you support several streamers without switching by hand.',
    lang_label: 'Language',
    lang_hint: 'Language of the extension interface.',
    time_label: 'Rotation time',
    time_hint: 'How often the extension swaps the open streamers.',
    time_never: 'Never switch',
    audio_label: 'Audio',
    audio_hint:
      '"Muted" silences the browser tab; the Twitch player stays at full volume so you count as a viewer.',
    audio_muted: 'Muted',
    audio_on: 'Sound on',
    save: 'Save',
    saved: 'Saved!',
    minutes_unit: 'min',
    powered_by: 'powered by',
    review_prompt: 'Enjoying it? A quick store review helps other streamers find us.',
    review_rate: 'Rate us',
    review_later: 'Not now',
    review_aria: 'Extension review invite',
  },
};

export const t = (lang, key, ...args) => {
  const dict = MESSAGES[lang] || MESSAGES.pt;
  let value = dict[key];
  if (value === undefined) value = MESSAGES.pt[key];
  return typeof value === 'function' ? value(...args) : value;
};

/** Rotation interval label: "10 min" or never-switch when 0/∞. */
export const formatInterval = (lang, minutes) => {
  if (!minutes) return t(lang, 'time_never');
  return `${minutes} ${t(lang, 'minutes_unit')}`;
};

/** Remaining time as m:ss or h:mm:ss. */
export const formatCountdown = (ms) => {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};
