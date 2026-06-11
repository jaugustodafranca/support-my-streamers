import { getSettings } from '../storage.js';
import { ROTATION_STEPS } from '../config.js';
import { t, formatInterval } from '../i18n.js';

const $ = (id) => document.getElementById(id);
let savedTimer = null;

const intervalToIndex = (minutes) => {
  const stepIndex = ROTATION_STEPS.indexOf(minutes);
  return stepIndex === -1 ? ROTATION_STEPS.indexOf(10) : stepIndex;
};

const applyI18n = (lang) => {
  $('t-tagline').textContent = t(lang, 'opt_tagline');
  $('t-about-title').textContent = t(lang, 'about_title');
  $('t-about-text').textContent = t(lang, 'about_text');
  $('t-lang-label').textContent = t(lang, 'lang_label');
  $('t-lang-hint').textContent = t(lang, 'lang_hint');
  $('t-time-label').textContent = t(lang, 'time_label');
  $('t-time-hint').textContent = t(lang, 'time_hint');
  $('t-audio-label').textContent = t(lang, 'audio_label');
  $('t-audio-hint').textContent = t(lang, 'audio_hint');
  $('t-audio-muted').textContent = t(lang, 'audio_muted');
  $('t-audio-on').textContent = t(lang, 'audio_on');
  $('t-powered-by').textContent = t(lang, 'powered_by');
  updateTimeLabel(lang);
};

const updateTimeLabel = (lang) => {
  $('time-val').textContent = formatInterval(lang, ROTATION_STEPS[Number($('interval').value)]);
};

const flashSaved = (lang) => {
  $('saved').textContent = t(lang, 'saved');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => {
    $('saved').textContent = '';
  }, 1500);
};

const persist = async (partial, lang) => {
  const state = await chrome.runtime.sendMessage({ type: 'SET_SETTINGS', settings: partial });
  if (state?.error) {
    $('saved').textContent = t(lang, 'save_error');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      $('saved').textContent = '';
    }, 3000);
    return;
  }
  flashSaved(lang);
};

const load = async () => {
  const settings = await getSettings();
  $('lang').value = settings.lang;
  $('audio').value = settings.audio;
  $('interval').value = String(intervalToIndex(settings.intervalMinutes));
  applyI18n(settings.lang);
};

const handleLangChange = () => {
  const lang = $('lang').value;
  applyI18n(lang);
  persist({ lang }, lang);
};

const handleIntervalInput = () => updateTimeLabel($('lang').value);

const handleIntervalChange = () => {
  const lang = $('lang').value;
  persist({ intervalMinutes: ROTATION_STEPS[Number($('interval').value)] }, lang);
};

const handleAudioChange = () => {
  persist({ audio: $('audio').value }, $('lang').value);
};

$('lang').addEventListener('change', handleLangChange);
$('interval').addEventListener('input', handleIntervalInput);
$('interval').addEventListener('change', handleIntervalChange);
$('audio').addEventListener('change', handleAudioChange);

load();
