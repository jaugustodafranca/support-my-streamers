import { describe, it, expect } from 'vitest';
import { shouldShowReviewPrompt, storeReviewUrl } from '../src/reviewPrompt.js';
import { REVIEW_PROMPT_MIN_PLAYS, REVIEW_PROMPT_SNOOZE_DAYS } from '../src/config.js';

const DAY = 24 * 60 * 60 * 1000;

describe('shouldShowReviewPrompt', () => {
  it('shows after enough play starts', () => {
    expect(
      shouldShowReviewPrompt({ playStarts: REVIEW_PROMPT_MIN_PLAYS, dismissedAt: null, ratedAt: null }),
    ).toBe(true);
  });

  it('hides before minimum play starts', () => {
    expect(
      shouldShowReviewPrompt({
        playStarts: REVIEW_PROMPT_MIN_PLAYS - 1,
        dismissedAt: null,
        ratedAt: null,
      }),
    ).toBe(false);
  });

  it('never shows after user rated', () => {
    expect(
      shouldShowReviewPrompt({
        playStarts: 99,
        dismissedAt: null,
        ratedAt: Date.now(),
      }),
    ).toBe(false);
  });

  it('snoozes after dismiss until snooze window passes', () => {
    const now = Date.now();
    const dismissedAt = now - REVIEW_PROMPT_SNOOZE_DAYS * DAY + 1000;
    expect(
      shouldShowReviewPrompt(
        { playStarts: 5, dismissedAt, ratedAt: null },
        now,
      ),
    ).toBe(false);

    const oldDismiss = now - REVIEW_PROMPT_SNOOZE_DAYS * DAY - 1000;
    expect(
      shouldShowReviewPrompt(
        { playStarts: 5, dismissedAt: oldDismiss, ratedAt: null },
        now,
      ),
    ).toBe(true);
  });
});

describe('storeReviewUrl', () => {
  it('builds Chrome Web Store reviews URL from extension id', () => {
    expect(storeReviewUrl('abcdefghijklmnop')).toBe(
      'https://chromewebstore.google.com/detail/abcdefghijklmnop/reviews',
    );
  });
});
