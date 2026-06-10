import { describe, it, expect } from 'vitest';
import { t, formatInterval } from '../src/i18n.js';

describe('t', () => {
  it('retorna string simples no idioma', () => {
    expect(t('pt', 'start')).toBe('Iniciar');
    expect(t('en', 'start')).toBe('Start');
  });

  it('resolve funções com argumentos', () => {
    expect(t('pt', 'selected', 1)).toBe('1 selecionado');
    expect(t('pt', 'selected', 3)).toBe('3 selecionados');
    expect(t('en', 'selected', 3)).toBe('3 selected');
  });

  it('faz fallback para pt em idioma desconhecido', () => {
    expect(t('xx', 'start')).toBe('Iniciar');
  });
});

describe('formatInterval', () => {
  it('mostra minutos quando > 0', () => {
    expect(formatInterval('pt', 10)).toBe('10 min');
    expect(formatInterval('en', 30)).toBe('30 min');
  });

  it('mostra "não trocar"/"never switch" quando 0 (∞)', () => {
    expect(formatInterval('pt', 0)).toBe('não trocar');
    expect(formatInterval('en', 0)).toBe('never switch');
  });
});
