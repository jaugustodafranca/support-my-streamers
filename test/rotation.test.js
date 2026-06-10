import { describe, it, expect } from 'vitest';
import { windowAt, nextCursor, needsRotation } from '../src/rotation.js';

describe('windowAt', () => {
  it('retorna os primeiros `slots` canais', () => {
    expect(windowAt(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['a', 'b']);
  });

  it('dá a volta (round-robin)', () => {
    expect(windowAt(['a', 'b', 'c'], 2, 2)).toEqual(['c', 'a']);
  });

  it('lida com menos canais do que slots', () => {
    expect(windowAt(['a'], 0, 2)).toEqual(['a']);
  });

  it('lista vazia retorna vazio', () => {
    expect(windowAt([], 0, 2)).toEqual([]);
  });
});

describe('nextCursor', () => {
  it('avança em `slots` posições', () => {
    expect(nextCursor(0, 2, 5)).toBe(2);
  });

  it('dá a volta', () => {
    expect(nextCursor(4, 2, 5)).toBe(1);
  });

  it('tamanho zero volta a 0', () => {
    expect(nextCursor(0, 2, 0)).toBe(0);
  });
});

describe('needsRotation', () => {
  it('true quando há mais canais do que abas', () => {
    expect(needsRotation(3, 2)).toBe(true);
  });

  it('false quando cabe tudo nas abas', () => {
    expect(needsRotation(2, 2)).toBe(false);
    expect(needsRotation(1, 2)).toBe(false);
  });
});
