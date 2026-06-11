import { describe, it, expect } from 'vitest';
import { t, formatInterval } from '../src/i18n.js';

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
});

describe('formatInterval', () => {
  it('shows minutes when greater than zero', () => {
    expect(formatInterval('pt', 10)).toBe('10 min');
    expect(formatInterval('en', 30)).toBe('30 min');
  });

  it('shows never-switch label when zero', () => {
    expect(formatInterval('pt', 0)).toBe('não trocar');
    expect(formatInterval('en', 0)).toBe('never switch');
  });
});
