import { getSettings } from '../storage.js';
import { ROTATION_STEPS } from '../config.js';
import { t, formatInterval } from '../i18n.js';

const $ = (id) => document.getElementById(id);
let savedTimer = null;

function intervalToIndex(minutes) {
  const i = ROTATION_STEPS.indexOf(minutes);
  return i === -1 ? ROTATION_STEPS.indexOf(10) : i;
}

function applyI18n(lang) {
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
  updateTimeLabel(lang);
}

function updateTimeLabel(lang) {
  $('time-val').textContent = formatInterval(lang, ROTATION_STEPS[Number($('interval').value)]);
}

function flashSaved(lang) {
  $('saved').textContent = t(lang, 'saved');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => {
    $('saved').textContent = '';
  }, 1500);
}

async function persist(partial, lang) {
  await chrome.runtime.sendMessage({ type: 'SET_SETTINGS', settings: partial });
  flashSaved(lang);
}

async function load() {
  const s = await getSettings();
  $('lang').value = s.lang;
  $('audio').value = s.audio;
  $('interval').value = String(intervalToIndex(s.intervalMinutes));
  applyI18n(s.lang);
}

$('lang').addEventListener('change', () => {
  const lang = $('lang').value;
  applyI18n(lang);
  persist({ lang }, lang);
});

$('interval').addEventListener('input', () => updateTimeLabel($('lang').value));
$('interval').addEventListener('change', () => {
  const lang = $('lang').value;
  persist({ intervalMinutes: ROTATION_STEPS[Number($('interval').value)] }, lang);
});

$('audio').addEventListener('change', () => {
  persist({ audio: $('audio').value }, $('lang').value);
});

load();
