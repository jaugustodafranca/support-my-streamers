// Manual i18n (PT/EN), user-selected in Options. Not chrome.i18n (browser locale).
// Values may be strings or functions for interpolated copy.

export const LANGS = ['pt', 'en'];

const MESSAGES = {
  pt: {
    hero_sub: 'Apoie quem você acompanha deixando a live rolando enquanto faz outras coisas.',
    connect: 'Conectar com a Twitch',
    hi: 'olá,',
    logout: 'sair',
    start: 'Iniciar',
    resume: 'Retomar',
    pause: 'Pausar',
    stop: 'Parar',
    options: 'opções',
    options_aria: 'Opções',
    lang_aria: 'Idioma',
    loading: 'Carregando…',
    live_fallback: 'Ao vivo',
    popup_error: 'Algo deu errado. Tente reabrir o popup.',
    save_error: 'Não foi possível salvar. Tente de novo.',
    live_now: 'ao vivo agora',
    empty_title: 'Ninguém ao vivo agora',
    empty_sub: 'Quando alguém que você segue abrir a live, aparece aqui pra você apoiar.',
    selected: (n) => `${n} selecionado${n === 1 ? '' : 's'}`,
    status_playing: (shown, total, min) =>
      min
        ? `rotacionando ${shown} de ${total} · troca a cada ${min} min`
        : `assistindo ${shown} de ${total} · sem trocar`,
    status_paused: (n) => `pausado · ${n} na lista`,
    next_rotation: (time) => `próxima troca em ${time}`,
    next_rotation_soon: 'próxima troca em breve',
    no_live_selected: 'Nenhum canal selecionado está ao vivo agora.',

    opt_tagline: 'configurações',
    about_title: 'O que a extensão faz',
    about_text:
      'Conecta na sua conta da Twitch, mostra quem você segue que está ao vivo e mantém alguns abertos em rotação — pra você apoiar vários streamers sem ficar trocando na mão.',
    lang_label: 'Idioma',
    lang_hint: 'Idioma da interface da extensão.',
    time_label: 'Tempo de rotação',
    time_hint: 'De quanto em quanto tempo a extensão troca os streamers abertos.',
    time_never: 'não trocar',
    audio_label: 'Áudio',
    audio_hint:
      '"Mudo" silencia a aba no navegador; o player da Twitch continua com volume alto pra contar como viewer.',
    audio_muted: 'Mudo',
    audio_on: 'Com som',
    save: 'Salvar',
    saved: 'Salvo!',
    minutes_unit: 'min',
    powered_by: 'powered by',
  },
  en: {
    hero_sub: 'Support the streamers you follow by keeping their live running while you do other things.',
    connect: 'Connect with Twitch',
    hi: 'hi,',
    logout: 'log out',
    start: 'Start',
    resume: 'Resume',
    pause: 'Pause',
    stop: 'Stop',
    options: 'options',
    options_aria: 'Options',
    lang_aria: 'Language',
    loading: 'Loading…',
    live_fallback: 'Live',
    popup_error: 'Something went wrong. Try reopening the popup.',
    save_error: 'Could not save. Try again.',
    live_now: 'live now',
    empty_title: 'No one live right now',
    empty_sub: 'When someone you follow goes live, they show up here for you to support.',
    selected: (n) => `${n} selected`,
    status_playing: (shown, total, min) =>
      min
        ? `rotating ${shown} of ${total} · switches every ${min} min`
        : `watching ${shown} of ${total} · no switching`,
    status_paused: (n) => `paused · ${n} in the list`,
    next_rotation: (time) => `next switch in ${time}`,
    next_rotation_soon: 'next switch soon',
    no_live_selected: 'None of the selected channels are live right now.',

    opt_tagline: 'settings',
    about_title: 'What this extension does',
    about_text:
      'Connects to your Twitch account, shows which channels you follow are live, and keeps a few open on rotation — so you support several streamers without switching by hand.',
    lang_label: 'Language',
    lang_hint: 'Language of the extension interface.',
    time_label: 'Rotation time',
    time_hint: 'How often the extension swaps the open streamers.',
    time_never: 'never switch',
    audio_label: 'Audio',
    audio_hint:
      '"Muted" silences the browser tab; the Twitch player stays at full volume so you count as a viewer.',
    audio_muted: 'Muted',
    audio_on: 'Sound on',
    save: 'Save',
    saved: 'Saved!',
    minutes_unit: 'min',
    powered_by: 'powered by',
  },
};

export function t(lang, key, ...args) {
  const dict = MESSAGES[lang] || MESSAGES.pt;
  let value = dict[key];
  if (value === undefined) value = MESSAGES.pt[key];
  return typeof value === 'function' ? value(...args) : value;
}

/** Rotation interval label: "10 min" or never-switch when 0/∞. */
export function formatInterval(lang, minutes) {
  if (!minutes) return t(lang, 'time_never');
  return `${minutes} ${t(lang, 'minutes_unit')}`;
}

/** Remaining time as m:ss or h:mm:ss. */
export function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}
