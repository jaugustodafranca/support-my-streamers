import { describe, it, expect } from 'vitest';
import { windowAt, nextCursor, needsRotation } from '../src/rotation.js';

describe('windowAt', () => {
  it('returns the first slots channels', () => {
    expect(windowAt(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['a', 'b']);
  });

  it('wraps round-robin', () => {
    expect(windowAt(['a', 'b', 'c'], 2, 2)).toEqual(['c', 'a']);
  });

  it('handles fewer channels than slots', () => {
    expect(windowAt(['a'], 0, 2)).toEqual(['a']);
  });

  it('returns empty for empty list', () => {
    expect(windowAt([], 0, 2)).toEqual([]);
  });
});

describe('nextCursor', () => {
  it('advances by slots positions', () => {
    expect(nextCursor(0, 2, 5)).toBe(2);
  });

  it('wraps around', () => {
    expect(nextCursor(4, 2, 5)).toBe(1);
  });

  it('returns 0 for zero length', () => {
    expect(nextCursor(0, 2, 0)).toBe(0);
  });
});

describe('needsRotation', () => {
  it('is true when there are more channels than slots', () => {
    expect(needsRotation(3, 2)).toBe(true);
  });

  it('is false when all channels fit in slots', () => {
    expect(needsRotation(2, 2)).toBe(false);
    expect(needsRotation(1, 2)).toBe(false);
  });
});
