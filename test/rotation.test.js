import { describe, it, expect } from 'vitest';
import {
  needsRotation,
  cycleProgress,
  initFifoRotation,
  tickFifoRotation,
  syncFifoQueue,
  pickFifoWindow,
} from '../src/rotation.js';

describe('needsRotation', () => {
  it('is true when there are more channels than slots', () => {
    expect(needsRotation(3, 2)).toBe(true);
  });

  it('is false when all channels fit in slots', () => {
    expect(needsRotation(2, 2)).toBe(false);
    expect(needsRotation(1, 2)).toBe(false);
  });
});

describe('cycleProgress', () => {
  const periodMs = 10 * 60_000;
  const now = 1_000_000;

  it('returns zero progress when alarm is missing', () => {
    expect(cycleProgress(null, periodMs, now)).toEqual({
      progress: 0,
      remainingMs: periodMs,
    });
  });

  it('computes progress from scheduled end time', () => {
    const nextCycleAt = now + 4 * 60_000;
    expect(cycleProgress(nextCycleAt, periodMs, now)).toEqual({
      progress: 0.6,
      remainingMs: 240_000,
    });
  });

  it('clamps at full progress when overdue', () => {
    expect(cycleProgress(now - 1_000, periodMs, now)).toEqual({
      progress: 1,
      remainingMs: 0,
    });
  });
});

describe('FIFO rotation', () => {
  // Fisher–Yates: j = floor(random * (i + 1)); returning ~1 keeps j = i (no swaps).
  const identityShuffle = () => 0.99999;

  it('shuffles once at start and shows the first slots', () => {
    const fifo = initFifoRotation(['1', '2', '3', '4'], 2, identityShuffle);
    expect(fifo.queueOrder).toEqual(['1', '2', '3', '4']);
    expect(fifo.showing).toEqual(['1', '2']);
  });

  it('drops offline channels and appends new live at the end', () => {
    expect(syncFifoQueue(['1', '2', '3'], ['2', '3', '4'])).toEqual(['2', '3', '4']);
  });

  it('picks the next live channels from the front of the queue', () => {
    expect(pickFifoWindow(['3', '4', '1', '2', '5'], ['1', '2', '3', '4', '5'], 2)).toEqual([
      '3',
      '4',
    ]);
  });

  it('advances FIFO after each cycle', () => {
    const fifo = initFifoRotation(['1', '2', '3', '4'], 2, identityShuffle);
    const next = tickFifoRotation({
      liveLogins: ['1', '2', '3', '4', '5'],
      showing: fifo.showing,
      queueOrder: fifo.queueOrder,
      slots: 2,
    });
    expect(next.showing).toEqual(['3', '4']);
    expect(next.queueOrder).toEqual(['3', '4', '1', '2', '5']);
    expect(next.changed).toBe(true);
  });

  it('skips rotation when at most slots channels are live', () => {
    const fifo = initFifoRotation(['1', '2'], 2, identityShuffle);
    expect(
      tickFifoRotation({
        liveLogins: ['1', '2'],
        showing: fifo.showing,
        queueOrder: fifo.queueOrder,
        slots: 2,
      }),
    ).toBeNull();
  });
});
