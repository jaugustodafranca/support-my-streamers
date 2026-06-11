import { describe, it, expect } from 'vitest';
import { t, formatInterval, formatCountdown, formatPlayingNames } from '../src/i18n.js';

describe('t', () => {
  it('returns simple string for locale', () => {
    expect(t('pt', 'start')).toBe('Iniciar');
    expect(t('en', 'start')).toBe('Start');
  });

  it('resolves function keys with arguments', () => {
    expect(t('pt', 'selected', 1)).toBe('1 selecionado');
    expect(t('pt', 'selected', 3)).toBe('3 selecionados');
    expect(t('en', 'selected', 3)).toBe('3 selected');
  });

  it('falls back to pt for unknown locale', () => {
    expect(t('xx', 'start')).toBe('Iniciar');
  });

  it('formats playing status with streamer names', () => {
    expect(t('pt', 'status_playing', ['Gaules', 'Cogu'], 5)).toBe(
      'Reproduzindo Gaules e Cogu por 5 min.',
    );
    expect(t('en', 'status_playing', ['Gaules', 'Cogu'], 5)).toBe(
      'Playing Gaules and Cogu for 5 min.',
    );
    expect(t('pt', 'status_playing', ['Gaules'], 0)).toBe('Reproduzindo Gaules.');
  });
});

describe('formatPlayingNames', () => {
  it('joins two names with locale conjunction', () => {
    expect(formatPlayingNames('pt', ['Gaules', 'Cogu'])).toBe('Gaules e Cogu');
    expect(formatPlayingNames('en', ['Gaules', 'Cogu'])).toBe('Gaules and Cogu');
  });
});

describe('formatInterval', () => {
  it('shows minutes when greater than zero', () => {
    expect(formatInterval('pt', 10)).toBe('10 min');
    expect(formatInterval('en', 30)).toBe('30 min');
  });

  it('shows never-switch label when zero', () => {
    expect(formatInterval('pt', 0)).toBe('Não trocar');
    expect(formatInterval('en', 0)).toBe('Never switch');
  });
});

describe('formatCountdown', () => {
  it('formats sub-hour remaining time', () => {
    expect(formatCountdown(125_000)).toBe('2:05');
    expect(formatCountdown(5_000)).toBe('0:05');
  });

  it('formats hour or longer remaining time', () => {
    expect(formatCountdown(3_661_000)).toBe('1:01:01');
  });

  it('never shows negative values', () => {
    expect(formatCountdown(-1_000)).toBe('0:00');
  });
});
