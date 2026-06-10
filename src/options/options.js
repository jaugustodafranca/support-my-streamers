import { getSettings } from '../storage.js';

const $ = (id) => document.getElementById(id);

function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

async function load() {
  const s = await getSettings();
  $('interval').value = s.intervalMinutes;
  $('slots').value = s.slots;
  $('audio').value = s.audio;
}

$('save').addEventListener('click', async () => {
  const settings = {
    intervalMinutes: clampInt($('interval').value, 1, 120, 10),
    slots: clampInt($('slots').value, 1, 4, 2),
    audio: $('audio').value === 'on' ? 'on' : 'muted',
  };
  await chrome.runtime.sendMessage({ type: 'SET_SETTINGS', settings });

  // Reflete os valores normalizados de volta na tela.
  $('interval').value = settings.intervalMinutes;
  $('slots').value = settings.slots;

  $('saved').textContent = 'Salvo!';
  setTimeout(() => {
    $('saved').textContent = '';
  }, 1500);
});

load();
